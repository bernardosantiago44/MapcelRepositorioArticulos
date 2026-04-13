using SixLabors.ImageSharp;
using System.Data;
using System.Text.RegularExpressions;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Serilog;
using Constants =  MapcelRepositorioArticulos.Utils.Constants;

namespace MapcelRepositorioArticulos.DataService;

public sealed class ArticleAggregateService(IConfiguration configuration, IWebHostEnvironment env, DirectoryBuilder directoryBuilder)
    : BaseService(configuration), IArticleAggregateService
{
    private const string SqlInsertArticle = """
        INSERT INTO [RepositorioArticulos].[dbo].[articles]
        (
            article_id,
            company_code,
            title,
            external_link,
            client_comments,
            status
        )
        OUTPUT INSERTED.created_at
        VALUES
        (
            @ArticleId,
            @CompanyCode,
            @Title,
            @ExternalLink,
            @ClientComments,
            @Status
        );
    """;
    private const string SqlInsertArticleTagsFromCsv = """
        INSERT INTO [RepositorioArticulos].[dbo].[article_tags]
        (
            article_id,
            tag_id
        )
        SELECT
            @ArticleId,
            t.tag_id
        FROM string_split(@TagIdsCsv, ',') s
        INNER JOIN [RepositorioArticulos].[dbo].[tags] t
            ON t.tag_id = TRY_CAST(s.value AS int)
           AND t.company_code = @CompanyCode;

        SELECT @@ROWCOUNT;
    """;
    private const string SqlInsertFile = """
        INSERT INTO [RepositorioArticulos].[dbo].[files]
        (
            file_id,
            company_code,
            name,
            size_bytes,
            description,
            width,
            height,
            thumbnail_url,
            is_image,
            extension
        )
        VALUES
        (
            @FileId,
            @CompanyCode,
            @Name,
            @SizeBytes,
            @Description,
            @Width,
            @Height,
            @ThumbnailUrl,
            @IsImage,
            @Extension
        );
    """;
    private const string SqlInsertFileArticle = """
        INSERT INTO [RepositorioArticulos].[dbo].[file_articles]
        (
            file_id,
            article_id
        )
        VALUES
        (
            @FileId,
            @ArticleId
        );
    """;
    private const string SqlEnsureArticleExists = @"
        SELECT COUNT(1)
        FROM [RepositorioArticulos].[dbo].[articles]
        WHERE article_id = @ArticleId
          AND company_code = @CompanyCode;
    ";

    private const string SqlUpdateArticle = @"
        UPDATE [RepositorioArticulos].[dbo].[articles]
        SET
            title = @Title,
            external_link = @ExternalLink,
            client_comments = @ClientComments,
            status = @Status,
            updated_at = SYSDATETIME()
        WHERE article_id = @ArticleId
          AND company_code = @CompanyCode;

        SELECT updated_at
        FROM [RepositorioArticulos].[dbo].[articles]
        WHERE article_id = @ArticleId
          AND company_code = @CompanyCode;
    ";

    private const string SqlDeleteArticleTags = @"
        DELETE at
        FROM [RepositorioArticulos].[dbo].[article_tags] at
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a
            ON a.article_id = at.article_id
        WHERE at.article_id = @ArticleId
          AND a.company_code = @CompanyCode;
    ";

    private const string SqlLinkExistingFileToArticle = @"
        INSERT INTO [RepositorioArticulos].[dbo].[file_articles]
        (
            file_id,
            article_id
        )
        SELECT
            f.file_id,
            @ArticleId
        FROM [RepositorioArticulos].[dbo].[files] f
        WHERE f.file_id = @FileId
          AND f.company_code = @CompanyCode
          AND NOT EXISTS (
              SELECT 1
              FROM [RepositorioArticulos].[dbo].[file_articles] fa
              WHERE fa.file_id = f.file_id
                AND fa.article_id = @ArticleId
          );
    ";

    private const string SqlUnlinkFileFromArticle = @"
        DELETE fa
        FROM [RepositorioArticulos].[dbo].[file_articles] fa
        INNER JOIN [RepositorioArticulos].[dbo].[files] f
            ON f.file_id = fa.file_id
        WHERE fa.article_id = @ArticleId
          AND fa.file_id = @FileId
          AND f.company_code = @CompanyCode;
    ";

    public async Task<ArticleCreatedDto> CreateAggregateAsync(
        CreateArticleCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        command.Validate();
        ValidateCompany(command.CompanyCode);

        var articleId = Guid.NewGuid();
        directoryBuilder.EnsureArticlesDirectoryPathExists(command.CompanyCode);
        var articleRoot = directoryBuilder.EnsureArticleDirectoryStructureExists(command.CompanyCode, articleId);

        var filePlans = BuildUploadPlans(command.CompanyCode, articleId, command.Files, isImage: false);
        var imagePlans = BuildUploadPlans(command.CompanyCode, articleId, command.Images, isImage: true);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var createdAtUtc = await InsertArticleAsync(
                connection,
                transaction,
                articleId,
                command,
                cancellationToken);

            if (command.TagIds.Count > 0)
            {
                await InsertArticleTagsAsync(
                    connection,
                    transaction,
                    articleId,
                    command.CompanyCode,
                    command.TagIds,
                    cancellationToken);
            }

            foreach (var plan in filePlans)
            {
                await InsertFileAndLinkAsync(
                    connection,
                    transaction,
                    articleId,
                    command.CompanyCode,
                    plan,
                    cancellationToken);
            }

            foreach (var plan in imagePlans)
            {
                await InsertFileAndLinkAsync(
                    connection,
                    transaction,
                    articleId,
                    command.CompanyCode,
                    plan,
                    cancellationToken);
            }

            foreach (var plan in filePlans)
                await PersistPhysicalFileAsync(plan, cancellationToken);

            foreach (var plan in imagePlans)
                await PersistPhysicalFileAsync(plan, cancellationToken);

            var rewrittenHtml = RewriteDescriptionHtml(command.DescriptionHtml, imagePlans);
            await directoryBuilder.SaveArticleDescriptionHtml(command.CompanyCode, articleId, rewrittenHtml, cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            return new ArticleCreatedDto
            {
                Id = articleId,
                CompanyCode = command.CompanyCode,
                Title = command.Title,
                Status = command.Status,
                ExternalLink = command.ExternalLink,
                ClientComments = command.ClientComments,
                CreatedAtUtc = DateTime.SpecifyKind(createdAtUtc, DateTimeKind.Utc),
                TagIds = command.TagIds.ToArray(),
                Files = filePlans.Select(ToStoredAssetDto).ToArray(),
                Images = imagePlans.Select(ToStoredAssetDto).ToArray()
            };
        }
        catch (Exception ex)
        {
            await TryRollbackAsync(transaction, cancellationToken);
            TryDeleteDirectory(articleRoot);

            Log.Error(
                ex,
                "ArticleAggregateService.CreateAggregateAsync failed for companyCode={CompanyCode}, articleId={ArticleId}",
                command.CompanyCode,
                articleId);

            throw;
        }
    }

    private async Task<DateTime> InsertArticleAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Guid articleId,
        CreateArticleCommand command,
        CancellationToken cancellationToken)
    {
        await using var sql = new SqlCommand(SqlInsertArticle, connection, transaction);
        sql.CommandType = CommandType.Text;

        sql.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
        sql.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = command.CompanyCode });
        sql.Parameters.Add(new SqlParameter("@Title", SqlDbType.NVarChar, Constants.ArticleTitleCharacterLength)
        {
            Value = command.Title.Trim()
        });
        sql.Parameters.Add(new SqlParameter("@ExternalLink", SqlDbType.NVarChar, Constants.ArticleExternalUrlCharacterLength)
        {
            Value = (object?)command.ExternalLink ?? DBNull.Value
        });
        sql.Parameters.Add(new SqlParameter("@ClientComments", SqlDbType.NVarChar, -1)
        {
            Value = (object?)command.ClientComments ?? DBNull.Value
        });
        sql.Parameters.Add(new SqlParameter("@Status", SqlDbType.VarChar, Constants.ArticleStatusCharacterLength)
        {
            Value = command.Status.Trim()
        });

        var result = await sql.ExecuteScalarAsync(cancellationToken);
        if (result is null)
            throw new InvalidOperationException("Failed to insert article row.");

        return Convert.ToDateTime(result);
    }

    private async Task InsertArticleTagsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Guid articleId,
        Guid companyCode,
        IReadOnlyList<int> tagIds,
        CancellationToken cancellationToken)
    {
        var cleanTagIds = tagIds
            .Where(x => x > 0)
            .Distinct()
            .ToArray();

        if (cleanTagIds.Length == 0)
            return;

        await using var sql = new SqlCommand(SqlInsertArticleTagsFromCsv, connection, transaction);
        sql.CommandType = CommandType.Text;

        sql.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
        sql.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
        sql.Parameters.Add(new SqlParameter("@TagIdsCsv", SqlDbType.VarChar, -1) { Value = string.Join(",", cleanTagIds) });

        var result = await sql.ExecuteScalarAsync(cancellationToken);
        var insertedCount = result is null ? 0 : Convert.ToInt32(result);

        if (insertedCount != cleanTagIds.Length)
            throw new ArgumentException("One or more TagIds are invalid for the provided company.", nameof(tagIds));
    }

    private async Task InsertFileAndLinkAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Guid articleId,
        Guid companyCode,
        UploadPlan plan,
        CancellationToken cancellationToken)
    {
        await using (var insertFile = new SqlCommand(SqlInsertFile, connection, transaction))
        {
            insertFile.CommandType = CommandType.Text;

            insertFile.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = plan.FileId });
            insertFile.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            insertFile.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 255) { Value = plan.Name });
            insertFile.Parameters.Add(new SqlParameter("@SizeBytes", SqlDbType.BigInt) { Value = plan.SizeBytes });
            insertFile.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar, 500) { Value = (object?)plan.Description ?? DBNull.Value });
            insertFile.Parameters.Add(new SqlParameter("@Width", SqlDbType.Int) { Value = (object?)plan.Width ?? DBNull.Value });
            insertFile.Parameters.Add(new SqlParameter("@Height", SqlDbType.Int) { Value = (object?)plan.Height ?? DBNull.Value });
            insertFile.Parameters.Add(new SqlParameter("@ThumbnailUrl", SqlDbType.NVarChar, 500)
            {
                Value = plan.IsImage ? plan.RelativePath : DBNull.Value
            });
            insertFile.Parameters.Add(new SqlParameter("@IsImage", SqlDbType.Bit) { Value = plan.IsImage });
            insertFile.Parameters.Add(new SqlParameter("@Extension", SqlDbType.VarChar, 20) { Value = plan.Extension });

            var inserted = await insertFile.ExecuteNonQueryAsync(cancellationToken);
            if (inserted != 1)
                throw new InvalidOperationException($"Failed to insert file metadata for '{plan.OriginalFileName}'.");
        }

        await using (var insertLink = new SqlCommand(SqlInsertFileArticle, connection, transaction))
        {
            insertLink.CommandType = CommandType.Text;

            insertLink.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = plan.FileId });
            insertLink.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });

            var linked = await insertLink.ExecuteNonQueryAsync(cancellationToken);
            if (linked != 1)
                throw new InvalidOperationException($"Failed to link file '{plan.OriginalFileName}' to article.");
        }
    }

    private static async Task PersistPhysicalFileAsync(UploadPlan plan, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(
            plan.PhysicalPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 1024 * 1024,
            useAsync: true);

        await plan.FormFile.CopyToAsync(stream, cancellationToken);
    }

    private static string RewriteDescriptionHtml(
        string html,
        IReadOnlyList<UploadPlan> imagePlans)
    {
        if (string.IsNullOrWhiteSpace(html) || imagePlans.Count == 0)
            return html;

        var rewritten = html;

        foreach (var image in imagePlans)
        {
            var escapedTempId = Regex.Escape(image.ClientTempId);

            rewritten = Regex.Replace(
                rewritten,
                $"src=[\"']{escapedTempId}[\"']",
                $"src=\"{image.RelativePath}\"",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

            rewritten = Regex.Replace(
                rewritten,
                $"data-mapcel-temp-id=[\"']{escapedTempId}[\"']",
                $"data-mapcel-temp-id=\"{image.ClientTempId}\" src=\"{image.RelativePath}\"",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        }

        return rewritten;
    }

    private List<UploadPlan> BuildUploadPlans(
        Guid companyCode,
        Guid articleId,
        IReadOnlyList<CreateArticleUploadCommand> uploads,
        bool isImage)
    {
        var plans = new List<UploadPlan>(uploads.Count);

        foreach (var upload in uploads)
        {
            upload.Validate();

            var originalFileName = Path.GetFileName(upload.File.FileName);
            var extension = NormalizeExtension(Path.GetExtension(originalFileName));
            var fileId = Guid.NewGuid();
            var folderName = isImage ? "images" : "files";
            var physicalDir = isImage ? 
                directoryBuilder.GetArticleImageFilePath(companyCode, articleId, fileId + extension) : 
                directoryBuilder.GetArticleFilePath(companyCode, articleId, fileId + extension);
            var relativePath = $"/{companyCode:D}/{articleId:D}/{folderName}/{fileId:D}{extension}";
            var name = Path.GetFileNameWithoutExtension(originalFileName).Trim();
            int? width = null, height = null;

            if (isImage)
            {
                var dimensions = GetImageDimensions(upload.File);
                width = dimensions?.Width;
                height = dimensions?.Height;
            }

            if (string.IsNullOrWhiteSpace(name))
                name = fileId.ToString("D");

            plans.Add(new UploadPlan
            {
                FileId = fileId,
                ClientTempId = upload.ClientTempId,
                FormFile = upload.File,
                OriginalFileName = originalFileName,
                Name = name,
                Description = string.IsNullOrWhiteSpace(upload.Description) ? null : upload.Description.Trim(),
                Extension = extension,
                SizeBytes = upload.File.Length,
                IsImage = isImage,
                Width = width,
                Height = height,
                PhysicalPath = physicalDir,
                RelativePath = relativePath
            });
        }

        return plans;
    }
    
    private static (int Width, int Height)? GetImageDimensions(IFormFile? file)
    {
        if (file == null || file.Length == 0) return null;

        try
        {
            using var stream = file.OpenReadStream();
        
            // Image.Identify reads the metadata (header) only.
            // It's significantly faster and more memory-efficient than loading the image.
            var info = Image.Identify(stream);

            return (info.Width, info.Height);
        }
        catch (Exception ex)
        {
            // Log the error: The file might be a "polyglot" or corrupted
            Console.WriteLine($"Dimension extraction failed: {ex.Message}");
        }

        return null;
    }

    private static string NormalizeExtension(string extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
            return string.Empty;

        return extension.StartsWith('.') ? extension : "." + extension;
    }

    private static ArticleStoredAssetDto ToStoredAssetDto(UploadPlan plan) => new()
    {
        Id = plan.FileId,
        Name = plan.Name,
        Extension = plan.Extension,
        Description = plan.Description,
        SizeBytes = plan.SizeBytes,
        IsImage = plan.IsImage,
        Width = plan.Width,
        Height = plan.Height,
        RelativePath = plan.RelativePath
    };

    private static void ValidateCompany(Guid companyCode)
    {
        if (companyCode == Guid.Empty)
            throw new ArgumentException("CompanyCode is required.", nameof(companyCode));
    }

    private static async Task TryRollbackAsync(SqlTransaction transaction, CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch
        {
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
                Directory.Delete(path, recursive: true);
        }
        catch
        {
        }
    }
    
    public async Task<ArticleDetailsDto?> UpdateAggregateAsync(
        UpdateArticleCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        command.Validate();

        var newFilePlans = BuildUploadPlans(command.CompanyCode, command.ArticleId, command.Files, isImage: false);
        var newImagePlans = BuildUploadPlans(command.CompanyCode, command.ArticleId, command.Images, isImage: true);

        var createdPaths = new List<string>();

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var exists = await EnsureArticleExistsAsync(
                connection,
                transaction,
                command.ArticleId,
                command.CompanyCode,
                cancellationToken);

            if (!exists)
                throw new KeyNotFoundException("Article was not found for the provided company.");

            directoryBuilder.EnsureArticlesDirectoryPathExists(command.CompanyCode);
            directoryBuilder.EnsureArticleDirectoryStructureExists(command.CompanyCode, command.ArticleId);

            var updatedAt = await UpdateArticleRowAsync(
                connection,
                transaction,
                command,
                cancellationToken);

            await ReplaceArticleTagsAsync(
                connection,
                transaction,
                command.ArticleId,
                command.CompanyCode,
                command.TagIds,
                cancellationToken);

            foreach (var fileId in command.ExistingFileIdsToRemove)
            {
                await UnlinkExistingFileAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    fileId,
                    cancellationToken);
            }

            foreach (var fileId in command.ExistingFileIdsToAdd)
            {
                await LinkExistingFileAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    fileId,
                    cancellationToken);
            }

            foreach (var plan in newFilePlans)
            {
                await InsertFileAndLinkAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    plan,
                    cancellationToken);
            }

            foreach (var plan in newImagePlans)
            {
                await InsertFileAndLinkAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    plan,
                    cancellationToken);
            }

            foreach (var plan in newFilePlans)
            {
                await PersistPhysicalFileAsync(plan, cancellationToken);
                createdPaths.Add(plan.PhysicalPath);
            }

            foreach (var plan in newImagePlans)
            {
                await PersistPhysicalFileAsync(plan, cancellationToken);
                createdPaths.Add(plan.PhysicalPath);
            }

            var rewrittenHtml = RewriteDescriptionHtml(command.DescriptionHtml, newImagePlans);
            await directoryBuilder.SaveArticleDescriptionHtml(command.CompanyCode, command.ArticleId,
                command.DescriptionHtml, cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            return new ArticleDetailsDto
            {
                Id = command.ArticleId,
                CompanyCode = command.CompanyCode,
                CompanyName = "",
                Title = command.Title,
                Description = rewrittenHtml,
                ExternalLink = command.ExternalLink,
                ClientComments = command.ClientComments,
                Status = command.Status,
                Tags = command.TagIds.Select(x => x.ToString()).ToArray(),
                TagNames = Array.Empty<string>(),
                FileIds = command.ExistingFileIdsToAdd
                    .Concat(newFilePlans.Select(x => x.FileId))
                    .Concat(newImagePlans.Select(x => x.FileId))
                    .Select(x => x.ToString("D"))
                    .ToArray(),
                CreatedAt = default,
                UpdatedAt = DateOnly.FromDateTime(updatedAt)
            };
        }
        catch (Exception ex)
        {
            await TryRollbackAsync(transaction, cancellationToken);

            foreach (var path in createdPaths)
            {
                try
                {
                    if (File.Exists(path))
                        File.Delete(path);
                }
                catch
                {
                }
            }

            Log.Error(
                ex,
                "ArticleAggregateService.UpdateAggregateAsync failed for articleId={ArticleId}, companyCode={CompanyCode}",
                command.ArticleId,
                command.CompanyCode);

            throw;
        }
    }

    private static async Task<bool> EnsureArticleExistsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Guid articleId,
        Guid companyCode,
        CancellationToken cancellationToken)
    {
        await using var cmd = new SqlCommand(SqlEnsureArticleExists, connection, transaction);
        cmd.CommandType = CommandType.Text;
        cmd.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
        cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return result is not null && Convert.ToInt32(result) > 0;
    }

    private static async Task<DateTime> UpdateArticleRowAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        UpdateArticleCommand command,
        CancellationToken cancellationToken)
    {
        await using var cmd = new SqlCommand(SqlUpdateArticle, connection, transaction);
        cmd.CommandType = CommandType.Text;

        cmd.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = command.ArticleId });
        cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = command.CompanyCode });
        cmd.Parameters.Add(new SqlParameter("@Title", SqlDbType.NVarChar, 255) { Value = command.Title.Trim() });
        cmd.Parameters.Add(new SqlParameter("@ExternalLink", SqlDbType.NVarChar, 2000) { Value = (object?)command.ExternalLink ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@ClientComments", SqlDbType.NVarChar, -1) { Value = (object?)command.ClientComments ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Status", SqlDbType.VarChar, 50) { Value = command.Status.Trim() });

        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        if (result is null)
            throw new InvalidOperationException("Failed to update article row.");

        return Convert.ToDateTime(result);
    }

    private async Task ReplaceArticleTagsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Guid articleId,
        Guid companyCode,
        IReadOnlyList<int> tagIds,
        CancellationToken cancellationToken)
    {
        await using (var deleteCmd = new SqlCommand(SqlDeleteArticleTags, connection, transaction))
        {
            deleteCmd.CommandType = CommandType.Text;
            deleteCmd.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
            deleteCmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            await deleteCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        if (tagIds.Count == 0)
            return;

        await InsertArticleTagsAsync(
            connection,
            transaction,
            articleId,
            companyCode,
            tagIds,
            cancellationToken);
    }

    private static async Task UnlinkExistingFileAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Guid articleId,
        Guid companyCode,
        Guid fileId,
        CancellationToken cancellationToken)
    {
        await using var cmd = new SqlCommand(SqlUnlinkFileFromArticle, connection, transaction);
        cmd.CommandType = CommandType.Text;

        cmd.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
        cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
        cmd.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = fileId });

        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task LinkExistingFileAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        Guid articleId,
        Guid companyCode,
        Guid fileId,
        CancellationToken cancellationToken)
    {
        await using var cmd = new SqlCommand(SqlLinkExistingFileToArticle, connection, transaction);
        cmd.CommandType = CommandType.Text;

        cmd.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
        cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
        cmd.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = fileId });

        var affected = await cmd.ExecuteNonQueryAsync(cancellationToken);
        if (affected == 0)
            throw new ArgumentException($"FileId '{fileId}' is invalid for the provided company.", nameof(fileId));
    }

    private sealed class UploadPlan
    {
        public required Guid FileId { get; init; }
        public required string ClientTempId { get; init; }
        public required IFormFile FormFile { get; init; }
        public required string OriginalFileName { get; init; }
        public required string Name { get; init; }
        public required string? Description { get; init; }
        public required string Extension { get; init; }
        public required long SizeBytes { get; init; }
        public required bool IsImage { get; init; }
        public required int? Width { get; init; }
        public required int? Height { get; init; }
        public required string PhysicalPath { get; init; }
        public required string RelativePath { get; init; }
    }
}