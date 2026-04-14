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
    private const string SqlSelectArticlesWithQuery = """
            WITH ArticleBase AS (
                SELECT a.article_id
                FROM [RepositorioArticulos].[dbo].[articles] a
                WHERE a.company_code = @companyCode
                  AND (@status IS NULL OR a.status = @status)
                  AND (@articleId IS NULL OR a.article_id = @articleId)
                  AND (
                        @search IS NULL
                        OR a.title LIKE '%' + @search + '%'
                        OR a.description LIKE '%' + @search + '%'
                      )
                  AND (
                        @tagIds IS NULL OR EXISTS (
                            SELECT 1 FROM [RepositorioArticulos].[dbo].[article_tags] filter_at
                            WHERE filter_at.article_id = a.article_id
                            AND filter_at.tag_id IN (SELECT value FROM STRING_SPLIT(@tagIds, ','))
                        )
                      )
                ORDER BY a.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            )
            SELECT 
                a.article_id,
                a.title,
                a.description,
                a.status,
                a.created_at,
                a.updated_at,
                tag_data.tags,
                file_data.files,
                client_comments,
                external_link
            FROM ArticleBase b
            JOIN [RepositorioArticulos].[dbo].[articles] a ON b.article_id = a.article_id
            OUTER APPLY (
                SELECT STRING_AGG(t.tag_id, ',') AS tags
                FROM [RepositorioArticulos].[dbo].[article_tags] at
                JOIN [RepositorioArticulos].[dbo].[tags] t ON at.tag_id = t.tag_id
                WHERE at.article_id = a.article_id
            ) AS tag_data
            OUTER APPLY (
                SELECT STRING_AGG(CAST(fa.file_id AS NVARCHAR(36)), ',') AS files
                FROM [RepositorioArticulos].[dbo].[file_articles] fa
                WHERE fa.article_id = a.article_id
            ) as file_data
            ORDER BY a.created_at DESC;

            -- 2. Get the total count using the EXACT SAME filters
            SELECT COUNT(1)
            FROM [RepositorioArticulos].[dbo].[articles] a
            WHERE a.company_code = @companyCode
              AND (@status IS NULL OR a.status = @status)
              AND (@articleId IS NULL OR a.article_id = @articleId)
              AND (
                    @search IS NULL
                    OR a.title LIKE '%' + @search + '%'
                    OR a.description LIKE '%' + @search + '%'
                  )
              AND (
                    @tagIds IS NULL OR EXISTS (
                        SELECT 1 FROM [RepositorioArticulos].[dbo].[article_tags] filter_at
                        WHERE filter_at.article_id = a.article_id
                        AND filter_at.tag_id IN (SELECT value FROM STRING_SPLIT(@tagIds, ','))
                    )
                  );
        """;
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
    private const string SqlBulkAddTagToArticles = """
        IF NOT EXISTS (SELECT 1 FROM [RepositorioArticulos].[dbo].[tags] WHERE tag_id = @TagId AND company_code = @CompanyCode)
        BEGIN
            SELECT CAST(-1 AS int);
            RETURN;
        END;

        ;WITH ids AS
        (
            SELECT DISTINCT TRY_CAST(value AS uniqueidentifier) AS article_id
            FROM string_split(@ArticleIdsCsv, ',')
            WHERE TRY_CAST(value AS uniqueidentifier) IS NOT NULL
        )
        INSERT INTO [RepositorioArticulos].[dbo].[article_tags] (article_id, tag_id)
        SELECT a.article_id, @TagId
        FROM [RepositorioArticulos].[dbo].[articles] a
        INNER JOIN ids i ON i.article_id = a.article_id
        WHERE a.company_code = @CompanyCode
          AND NOT EXISTS
          (
              SELECT 1
              FROM [RepositorioArticulos].[dbo].[article_tags] at
              WHERE at.article_id = a.article_id
                AND at.tag_id = @TagId
          );

        SELECT @@ROWCOUNT;
    """;
    private const string SqlBulkRemoveTagFromArticles = """
        IF NOT EXISTS (SELECT 1 FROM [RepositorioArticulos].[dbo].[tags] WHERE tag_id = @TagId AND company_code = @CompanyCode)
        BEGIN
            SELECT CAST(-1 AS int);
            RETURN;
        END;

        ;WITH ids AS
        (
            SELECT DISTINCT TRY_CAST(value AS uniqueidentifier) AS article_id
            FROM string_split(@ArticleIdsCsv, ',')
            WHERE TRY_CAST(value AS uniqueidentifier) IS NOT NULL
        )
        DELETE at
        FROM [RepositorioArticulos].[dbo].[article_tags] at
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a ON a.article_id = at.article_id
        INNER JOIN ids i ON i.article_id = a.article_id
        WHERE a.company_code = @CompanyCode
          AND at.tag_id = @TagId;

        SELECT @@ROWCOUNT;
    """;
    private const string SqlDeleteFileArticles = """
        DELETE fa
        FROM [RepositorioArticulos].[dbo].[file_articles] fa
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a ON a.article_id = fa.article_id
        WHERE fa.article_id = @ArticleId
          AND a.company_code = @CompanyCode;
    """;
    private const string SqlDeleteArticle = """
        DELETE a
        FROM [RepositorioArticulos].[dbo].[articles] a
        WHERE a.article_id = @ArticleId
          AND a.company_code = @CompanyCode;
    """;

    public async Task<PagedResult<ArticleDetailsDto>> GetAsync(ArticleQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        query.ValidateQuery();

        var rows = new List<ArticleDetailsDto>();

        var offset = (query.Page - 1) * query.PageSize;

        var companyCode = query.CompanyCode;

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new SqlCommand(SqlSelectArticlesWithQuery, connection);
        command.CommandType = CommandType.Text;

        // Mandatory parameters
        command.Parameters.Add(new SqlParameter("@offset", SqlDbType.Int) { Value = offset });
        command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = query.PageSize });
        command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
        
        // Optional parameters
        command.Parameters.Add(new SqlParameter("@status", SqlDbType.VarChar, 50) { Value = string.IsNullOrWhiteSpace(query.Status) ? DBNull.Value : query.Status });
        command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, int.MaxValue) { Value = string.IsNullOrWhiteSpace(query.Search) ? DBNull.Value : query.Search });
        command.Parameters.Add(new SqlParameter("@tagIds", SqlDbType.VarChar) { Value = !query.IsTagsFilterAvailable() ? DBNull.Value : query.CleanTagFiltersString() });
        command.Parameters.Add(new SqlParameter("@articleId", SqlDbType.UniqueIdentifier) { Value = query.ArticleId == null ? DBNull.Value : query.ArticleId.Value });
        
        var total = 0;
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
        {
            var idPos = reader.GetOrdinal("article_id");
            var titlePos = reader.GetOrdinal("title");
            var descriptionPos = reader.GetOrdinal("description");
            var statusPos = reader.GetOrdinal("status");
            var createdAtPos = reader.GetOrdinal("created_at");
            var updatedAtPos = reader.GetOrdinal("updated_at");
            var tagsPos = reader.GetOrdinal("tags");
            var filesPos = reader.GetOrdinal("files");
            var externalLinkPos = reader.GetOrdinal("external_link");
            var clientCommentsPos = reader.GetOrdinal("client_comments");
            
            // Result set 1: page rows
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {

                rows.Add(new ArticleDetailsDto
                {
                    Id = reader.GetGuid(idPos),
                    CompanyCode = companyCode,
                    Title = reader.IsDBNull(titlePos) ? "" : reader.GetString(titlePos),
                    Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                    Status = reader.IsDBNull(statusPos) ? "" : reader.GetString(statusPos),
                    CreatedAt = DateOnly.FromDateTime(reader.IsDBNull(createdAtPos) ? DateTime.MinValue : reader.GetDateTime(createdAtPos)),
                    UpdatedAt = DateOnly.FromDateTime(reader.IsDBNull(updatedAtPos) ? DateTime.Now : reader.GetDateTime(updatedAtPos)),
                    Tags = reader.IsDBNull(tagsPos) ? [] : reader.GetString(tagsPos).Split(','),
                    FileIds = reader.IsDBNull(filesPos) ? [] : reader.GetString(filesPos).Split(','),
                    ExternalLink = reader.IsDBNull(externalLinkPos) ? "" : reader.GetString(externalLinkPos),
                    ClientComments =  reader.IsDBNull(clientCommentsPos) ? "" : reader.GetString(clientCommentsPos),
                    CompanyName = ""
                });
            }

            // Result set 2: total
            if (!await reader.NextResultAsync(cancellationToken).ConfigureAwait(false))
                return new PagedResult<ArticleDetailsDto>(rows, total, query.Page, query.PageSize);
            if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
        }
        return new PagedResult<ArticleDetailsDto>(rows, total, query.Page, query.PageSize);
    }
    
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

    private static async Task<DateTime> InsertArticleAsync(
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

    private static async Task InsertArticleTagsAsync(
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

    private static async Task InsertFileAndLinkAsync(
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
                Value = plan.RelativePath
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
            var relativePath = $"/articles/{companyCode:D}/{articleId:D}/{folderName}/{fileId:D}{extension}";
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

    private static void ValidateId(Guid articleId)
    {
        if  (articleId == Guid.Empty)
            throw new ArgumentException("articleId is required.", nameof(articleId));
    }

    private static async Task TryRollbackAsync(SqlTransaction transaction, CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch
        {
            //
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

        var newFilePlans = BuildUploadPlans(command.CompanyCode, command.ArticleId, command.Files, false);
        var newImagePlans = BuildUploadPlans(command.CompanyCode, command.ArticleId, command.Images, true);

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
                cancellationToken
            );

            if (!exists)
                throw new KeyNotFoundException("Article was not found for the provided company.");

            directoryBuilder.EnsureArticlesDirectoryPathExists(command.CompanyCode);
            directoryBuilder.EnsureArticleDirectoryStructureExists(command.CompanyCode, command.ArticleId);

            var updatedAt = await UpdateArticleRowAsync(
                connection,
                transaction,
                command,
                cancellationToken
            );

            await ReplaceArticleTagsAsync(
                connection,
                transaction,
                command.ArticleId,
                command.CompanyCode,
                command.TagIds,
                cancellationToken
            );

            // Clean the ArticleFiles relationships
            foreach (var fileId in command.ExistingFileIdsToRemove)
                await UnlinkExistingFileAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    fileId,
                    cancellationToken
                );

            // Link new files
            foreach (var fileId in command.ExistingFileIdsToAdd)
                await LinkExistingFileAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    fileId,
                    cancellationToken
                );

            foreach (var plan in newFilePlans)
                await InsertFileAndLinkAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    plan,
                    cancellationToken
                );

            foreach (var plan in newImagePlans)
                await InsertFileAndLinkAsync(
                    connection,
                    transaction,
                    command.ArticleId,
                    command.CompanyCode,
                    plan,
                    cancellationToken);

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
                try
                {
                    if (File.Exists(path))
                        File.Delete(path);
                }
                catch
                {
                    // Some directories might not have been created
                }

            Log.Error(
                ex,
                "ArticleAggregateService.UpdateAggregateAsync failed for articleId={ArticleId}, companyCode={CompanyCode}",
                command.ArticleId,
                command.CompanyCode);

            throw;
        }
    }
    
    public async Task<int> BulkUpdateSingleTagAsync(
        Guid companyCode,
        Guid[] articleIds,
        int tagId,
        string action,
        CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);
        if (articleIds is null || articleIds.Length == 0) throw new ArgumentException("ArticleIds is required.", nameof(articleIds));
        if (tagId <= 0) throw new ArgumentOutOfRangeException(nameof(tagId), "TagId must be > 0.");
        if (string.IsNullOrWhiteSpace(action)) throw new ArgumentException("Action is required.", nameof(action));

        var normalized = action.Trim().ToLowerInvariant();
        if (normalized is not ("add" or "remove")) throw new ArgumentException("Action must be 'add' or 'remove'.", nameof(action));

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            var csv = string.Join(",", articleIds);

            var sql = normalized == "add" ? SqlBulkAddTagToArticles : SqlBulkRemoveTagFromArticles;

            await using var command = new SqlCommand(sql, connection);
            command.CommandType = CommandType.Text;

            command.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            command.Parameters.Add(new SqlParameter("@TagId", SqlDbType.Int) { Value = tagId });
            command.Parameters.Add(new SqlParameter("@ArticleIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

            var result = await command.ExecuteScalarAsync(cancellationToken);
            if (result is null) throw new InvalidOperationException("ArticleService.BulkUpdateSingleTagAsync: Failed to execute bulk update.");

            var updatedCount = Convert.ToInt32(result);

            // -1 indicates the tag does not exist for this tenant
            return updatedCount == -1 ? throw new KeyNotFoundException("Tag was not found for the provided companyCode.") : updatedCount;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticleService.BulkUpdateSingleTagAsync failed for companyCode={CompanyCode}, tagId={TagId}, action={Action}", companyCode, tagId, action);
            throw;
        }
    }
    
    public async Task<bool> DeleteAsync(Guid articleId, Guid companyCode, CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);
        ValidateId(articleId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            // 1. Delete file_articles rows for this article (tenant-safe via join to articles)
            await using var deleteFileArticlesCommand = new SqlCommand(SqlDeleteFileArticles, connection);
            deleteFileArticlesCommand.CommandType = CommandType.Text;

            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            await deleteFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);

            // 2. Delete article_tags rows for this article (tenant-safe via join to articles)
            await using var deleteArticleTagsCommand = new SqlCommand(SqlDeleteArticleTags, connection);
            deleteArticleTagsCommand.CommandType = CommandType.Text;

            deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
            deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            await deleteArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);

            // 3. Delete the article row
            await using var deleteArticleCommand = new SqlCommand(SqlDeleteArticle, connection);
            deleteArticleCommand.CommandType = CommandType.Text;

            deleteArticleCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
            deleteArticleCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            var deleted = await deleteArticleCommand.ExecuteNonQueryAsync(cancellationToken);
            directoryBuilder.DeleteArticle(companyCode, articleId);
            return deleted != 0;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticleService.DeleteAsync(int:Guid:token) failed for articleId={ArticleId}, companyCode={CompanyCode}: {message}", articleId, companyCode, ex.Message);
            throw;
        }
    }
    
    // -------------------------------------
    // Helper methods
    // -------------------------------------

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