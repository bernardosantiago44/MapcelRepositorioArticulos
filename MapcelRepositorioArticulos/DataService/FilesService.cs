using System.Data;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Core;
using Constants = MapcelRepositorioArticulos.Utils.Constants;

namespace MapcelRepositorioArticulos.DataService;

public interface IFilesService
{
    /// <summary>
    /// Returns all the non-image files that match the given query. 
    /// </summary>
    /// <param name="query"></param>
    /// <param name="cancellationToken"></param>
    /// <exception cref="ArgumentNullException">if query is null</exception>
    /// <exception cref="ArgumentOutOfRangeException">if page is less than zero</exception>
    /// <exception cref="ArgumentOutOfRangeException">if pageSize is less than zero or more than 200</exception>
    /// <exception cref="ArgumentNullException">if companyId is not provided</exception>
    /// <returns></returns>
    public Task<PagedResult<FileDto>> GetAsync(FileQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// Returns a list of all the files related to a given article id.
    /// </summary>
    /// <param name="articleId"></param>
    /// <param name="cancellationToken"></param>
    /// <exception cref="ArgumentOutOfRangeException">If articleId ≤ 0</exception>
    /// <returns></returns>
    public Task<IReadOnlyList<FileDto>> GetByArticleIdAsync(Guid articleId, CancellationToken cancellationToken);
    
    /// <summary>
    /// Creates a new File record in the database, asynchronously.
    /// </summary>
    /// <param name="companyCode">Guid</param>
    /// <param name="upload">FileUploadDto</param>
    /// <param name="cancellationToken"></param>
    /// <returns>FileAsset</returns>
    /// <exception cref="ArgumentException">If companyCode is empty.</exception>
    /// <exception cref="ArgumentNullException">If provided file is null, empty or invalid.</exception>
    Task<FileAsset> CreateAsync(Guid companyCode, FileUploadDto upload, CancellationToken cancellationToken);
    
    Task SaveFileMetadataAsync(Guid companyCode, Guid articleId, MultipleFilesDto files, CancellationToken cancellationToken);
    
    /// <summary>
    /// Updates all the fields of the provided fileId with the given request.
    /// </summary>
    /// <param name="fileId"></param>
    /// <param name="companyCode"></param>
    /// <param name="request"></param>
    /// <param name="cancellationToken"></param>
    /// <returns></returns>
    /// <exception cref="ArgumentException"></exception>
    /// <exception cref="ArgumentOutOfRangeException"></exception>
    Task<FileDto?> UpdateAsync(Guid fileId, Guid companyCode, UpdateFileRequest request, CancellationToken cancellationToken);
    
    /// <summary>
    /// Deletes the file associated with the given fileId from the database.
    /// </summary>
    /// <param name="fileId">The file to be deleted.</param>
    /// <param name="companyCode">The company this file belongs to.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Bool: True if the file existed, false otherwise.</returns>
    /// <exception cref="ArgumentException"></exception>
    /// <exception cref="ArgumentOutOfRangeException"></exception>
    Task<bool> DeleteAsync(Guid fileId, Guid companyCode, CancellationToken cancellationToken);
    
    /// <summary>
    /// Returns the name and file extension
    /// for the given fileId within the given companyCode.
    /// </summary>
    /// <param name="fileId"></param>
    /// <param name="companyCode"></param>
    /// <param name="cancellationToken"></param>
    /// <returns>(Name, Extension)</returns>
    Task<string?> GetDownloadInfoAsync(Guid fileId, Guid companyCode, CancellationToken cancellationToken);

    string BuildPhysicalFilePath(Guid companyCode, Guid fileId, string extension);
}

    public class FilesService(IConfiguration configuration, IWebHostEnvironment env, DirectoryBuilder directoryBuilder)
    : BaseService(configuration), IFilesService
{
    private const string FilesSubdirectoryName = "files";
    private string GetFilesRootPath()
    {
        var overridePath = configuration["Files:ArchivosRootPath"];
        if (!string.IsNullOrWhiteSpace(overridePath))
            return Path.GetRelativePath(overridePath,  Directory.GetCurrentDirectory());
        
        var contentRoot = Path.Combine(env.WebRootPath, FilesSubdirectoryName);

        return contentRoot;
    }

    private static string NormalizeExtension(string extension)
    {
        if (string.IsNullOrWhiteSpace(extension)) return string.Empty;
        return extension.StartsWith('.') ? extension : "." + extension;
    }

    public string BuildPhysicalFilePath(Guid companyCode, Guid fileId, string extension)
    {
        var filesRoot = GetFilesRootPath();
        var companyDir = Path.Combine(filesRoot, companyCode.ToString("D"));
        Directory.CreateDirectory(companyDir);

        var ext = NormalizeExtension(extension);
        return Path.Combine(companyDir, $"{fileId}{ext}");
    }

    private const string SqlSelectFilesByArticleId = """
        SELECT
            f.file_id,
            f.name,
            f.description,
            f.thumbnail_url,
            f.extension,
            f.is_image,
            f.upload_date
        FROM [RepositorioArticulos].[dbo].[files] f
        INNER JOIN [RepositorioArticulos].[dbo].[file_articles] fa ON f.file_id = fa.file_id
        WHERE fa.article_id = @articleId
        ORDER BY f.is_image DESC, f.upload_date DESC;
    """;
    private const string SqlSelectFilesByIdsCsv = """
        WITH FileBase AS (
            SELECT f.file_id
            FROM [RepositorioArticulos].[dbo].[files] f
            WHERE f.file_id IN (
                SELECT TRY_CAST(value AS uniqueidentifier)
                FROM STRING_SPLIT(@idsCsv, ',')
                WHERE TRY_CAST(value AS uniqueidentifier) IS NOT NULL
            )
        )
        SELECT
            f.file_id,
            f.name,
            f.description,
            f.thumbnail_url,
            f.extension,
            f.is_image,
            f.upload_date
        FROM FileBase b
        INNER JOIN [RepositorioArticulos].[dbo].[files] f ON f.file_id = b.file_id
        ORDER BY f.is_image DESC, f.upload_date DESC;
    """;
    private const string SqlInsertFile = """
        INSERT INTO [RepositorioArticulos].[dbo].[files]
        (
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
        OUTPUT INSERTED.file_id
        VALUES
        (
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
    private const string SqlUpdateFileReturnDto = """
        UPDATE [RepositorioArticulos].[dbo].[files]
        SET
            name = COALESCE(NULLIF(@Name, ''), name),
            description = COALESCE(NULLIF(@Description, ''), description)
        OUTPUT
            INSERTED.file_id,
            INSERTED.name,
            INSERTED.description,
            INSERTED.extension,
            INSERTED.thumbnail_url,
            INSERTED.is_image
            DELETED.upload_date
        WHERE file_id = @FileId
          AND company_code = @CompanyCode;
    """;
    private const string SqlUpdateThumbnailUrl = """
        UPDATE [RepositorioArticulos].[dbo].[files]
        SET thumbnail_url = @ThumbnailUrl
        WHERE file_id = @FileId
          AND company_code = @CompanyCode;
    """;
    private const string SqlDeleteFileArticles = """
        DELETE fa
        FROM [RepositorioArticulos].[dbo].[file_articles] fa
        INNER JOIN [RepositorioArticulos].[dbo].[files] f ON f.file_id = fa.file_id
        WHERE fa.file_id = @FileId
          AND f.company_code = @CompanyCode;
    """;
    private const string SqlDeleteFile = """
        DELETE f
        FROM [RepositorioArticulos].[dbo].[files] f
        WHERE f.file_id = @FileId
          AND f.company_code = @CompanyCode;
    """;
    private const string SqlSelectDownloadInfo = """
        SELECT
            f.name,
            f.extension
        FROM [RepositorioArticulos].[dbo].[files] f
        WHERE f.file_id = @FileId
          AND f.company_code = @CompanyCode;
    """;

    private const string SqlSelectFileUrl = """
        SELECT thumbnail_url
        FROM [RepositorioArticulos].[dbo].[files] f
        WHERE f.file_id = @FileId;
    """;
    
    public async Task<PagedResult<FileDto>> GetAsync(FileQuery query, CancellationToken cancellationToken)
    {
        var rows = new List<FileDto>();
        
        ArgumentNullException.ThrowIfNull(query);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(query.Page);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(query.PageSize);
        ArgumentOutOfRangeException.ThrowIfGreaterThanOrEqual(query.PageSize, 200);
        if (!query.IsValidQuery()) throw new ArgumentException("Invalid file query.", nameof(query));

        int offset = (query.Page - 1) * query.PageSize;

        var companyCode = query.CompanyCode;
        var fileId = query.Id;
        
        var queryType = query.GetFileQueryType();
        if (queryType == FileQuery.FileQueryType.ByCompany && companyCode == null) throw new ArgumentNullException(nameof(query));
        if (queryType == FileQuery.FileQueryType.ById && fileId == null) throw new ArgumentNullException(nameof(query));
        if (queryType == FileQuery.FileQueryType.Undefined) throw new ArgumentNullException(nameof(query));

        // IMPORTANT: When adding additional filters to the query,
        // Add them both inside the `SELECT` of the `WITH FileBase AS`
        // And in the total count for pagination.
        const string sql = @"
            WITH FileBase AS (
                SELECT f.file_id
                FROM [RepositorioArticulos].[dbo].[files] f
                WHERE 
                  (@companyCode IS NULL OR f.company_code = @companyCode)
                  -- Filter Id search
                  AND (@fileId IS NULL OR f.file_id = @fileId)
                  -- Filter Multiple Extensions (e.g., 'jpg,png,pdf')
                  AND (
                        @extensions IS NULL 
                        OR f.extension IN (SELECT value FROM STRING_SPLIT(@extensions, ','))
                      )
                  -- Handle Image/File Toggle
                  AND (@isImage IS NULL OR f.is_image = @isImage)
                  -- Handle Search
                  AND (
                        @search IS NULL
                        OR f.name LIKE '%' + @search + '%'
                        OR f.description LIKE '%' + @search + '%'
                      )
            )
            -- Main Select
            SELECT 
                f.file_id,
                f.company_code,
                f.name,
                f.size_bytes,
                f.description,
                f.upload_date,
                f.width,
                f.height,
                f.thumbnail_url,
                f.is_image,
                f.extension
            FROM FileBase b
            JOIN [RepositorioArticulos].[dbo].[files] f ON b.file_id = f.file_id
            ORDER BY f.upload_date DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

            -- Total count (Synchronized filters)
            SELECT COUNT(1)
            FROM [RepositorioArticulos].[dbo].[files] f
            WHERE 
              (@companyCode IS NULL OR f.company_code = @companyCode)
              AND (@fileId IS NULL OR f.file_id = @fileId)
              AND (
                    @extensions IS NULL 
                    OR f.extension IN (SELECT value FROM STRING_SPLIT(@extensions, ','))
                  )
              AND (@isImage IS NULL OR f.is_image = @isImage)
              AND (
                    @search IS NULL
                    OR f.name LIKE '%' + @search + '%'
                    OR f.description LIKE '%' + @search + '%'
                  );
        ";

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new SqlCommand(sql, connection);
        command.CommandType = CommandType.Text;
        
        // Mandatory Parameters
        command.Parameters.Add(new SqlParameter("@offset", SqlDbType.Int) { Value = offset });
        command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = query.PageSize });
        
        // Optional parameters
        command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.UniqueIdentifier) { Value = companyCode == null ? DBNull.Value : companyCode.Value });
        command.Parameters.Add(new SqlParameter("@fileId", SqlDbType.UniqueIdentifier) { Value = fileId == null ? DBNull.Value : fileId! });
        command.Parameters.Add(new SqlParameter("@extensions", SqlDbType.VarChar, 2000) { Value = query.IsFilteringExtensions() ? query.GetFileExtensionsString() : DBNull.Value });
        command.Parameters.Add(new SqlParameter("@isImage", SqlDbType.Bit) { Value = query.ImagesOnly ? 1 : 0 });
        command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 2000) { Value = string.IsNullOrEmpty(query.SearchTerm) ? DBNull.Value : query.SearchTerm! });

        var total = 0;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        
        var idPos = reader.GetOrdinal("file_id");
        var companyCodePos =  reader.GetOrdinal("company_code");
        var namePos =  reader.GetOrdinal("name");
        var sizeBytesPos =  reader.GetOrdinal("size_bytes");
        var descriptionPos =  reader.GetOrdinal("description");
        var uploadDatePos =  reader.GetOrdinal("upload_date");
        var widthPos =  reader.GetOrdinal("width");
        var heightPos =  reader.GetOrdinal("height");
        var thumbnailUrlPos =  reader.GetOrdinal("thumbnail_url");
        var extensionsPos =  reader.GetOrdinal("extension");
        var isImagePos =  reader.GetOrdinal("is_image");
        
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            rows.Add(new FileDto
            {
                Id = reader.GetGuid(idPos).ToString(),
                Name = reader.GetString(namePos),
                Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                Extension = reader.GetString(extensionsPos),
                ThumbnailUrl =  reader.IsDBNull(thumbnailUrlPos) ? "" : reader.GetString(thumbnailUrlPos),
                IsImage = reader.IsDBNull(isImagePos) ? false : reader.GetBoolean(isImagePos),
                Width = reader.IsDBNull(widthPos) ? null : reader.GetInt32(widthPos),
                Height = reader.IsDBNull(heightPos) ? null : reader.GetInt32(heightPos),
                SizeBytes =  reader.IsDBNull(sizeBytesPos) ? null : reader.GetInt64(sizeBytesPos),
                UploadDate = reader.GetDateTime(uploadDatePos)
            });
        }

        // Exit if next result (count query) is unable to be executed
        if (!await reader.NextResultAsync(cancellationToken).ConfigureAwait(false)) return new PagedResult<FileDto>(rows, rows.Count, query.Page, query.PageSize);
        if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
    
        return new PagedResult<FileDto>(rows, total, query.Page, query.PageSize);
    }

    public async Task<IReadOnlyList<FileDto>> GetByArticleIdAsync(Guid articleId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrEmpty(articleId.ToString());
        if (articleId.Equals(Guid.Empty)) throw new ArgumentNullException(nameof(articleId));

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new SqlCommand(SqlSelectFilesByArticleId, connection);
        command.CommandType = CommandType.Text;
        command.Parameters.Add(new SqlParameter("@articleId", SqlDbType.UniqueIdentifier) { Value = articleId });

        return await ExecuteAndMapFilesAsync(command, cancellationToken).ConfigureAwait(false);
    }

    private static async Task<IReadOnlyList<FileDto>> ExecuteAndMapFilesAsync(SqlCommand command, CancellationToken cancellationToken)
    {
        var rows = new List<FileDto>();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        // Resolve ordinals once. Do NOT resolve inside the while.
        int fileIdPos = reader.GetOrdinal("file_id");
        int namePos = reader.GetOrdinal("name");
        int descriptionPos = reader.GetOrdinal("description");
        int thumbnailUrlPos = reader.GetOrdinal("thumbnail_url");
        int extensionPos = reader.GetOrdinal("extension");
        int isImagePos = reader.GetOrdinal("is_image");
        int uploadDatePos = reader.GetOrdinal("upload_date");

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            rows.Add(new FileDto
            {
                Id = reader.GetGuid(fileIdPos).ToString(),
                Name = reader.GetString(namePos),
                Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                ThumbnailUrl = reader.IsDBNull(thumbnailUrlPos) ? "" : reader.GetString(thumbnailUrlPos),
                Extension = reader.IsDBNull(extensionPos) ? "" : reader.GetString(extensionPos),
                IsImage = !reader.IsDBNull(isImagePos) && reader.GetBoolean(isImagePos),
                UploadDate = reader.GetDateTime(uploadDatePos)
            });
        }

        return rows;
    }
    
    public async Task<FileAsset> CreateAsync(Guid companyCode, FileUploadDto upload, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(upload);
        ValidateGuid(companyCode);
        ValidateFile(upload.File);
        upload.Validate();

        var file = upload.File;
        var originalFileName = Path.GetFileName(file.FileName);
        var name = Path.GetFileNameWithoutExtension(originalFileName).Trim();
        var extension = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(extension)) extension = string.Empty;

        var isImage = IsImage(file, extension);
        var thumbnailUrl = string.IsNullOrWhiteSpace(upload.ThumbnailUrl) ? null : upload.ThumbnailUrl.Trim();
        var hasImageMetadata = upload.Width is not null || upload.Height is not null || thumbnailUrl is not null;
        if (!isImage && hasImageMetadata)
        {
            Log.Warning(
                "FilesService.CreateAsync received image metadata for non-image file {FileName} in companyCode={CompanyCode}",
                originalFileName,
                companyCode);
        }
        var description = string.IsNullOrWhiteSpace(upload.Description) ? null : upload.Description.Trim();
        var width = isImage ? upload.Width : null;
        var height = isImage ? upload.Height : null;

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        string? physicalPath = null;
        try
        {
            await using var insertFileCommand = new SqlCommand(SqlInsertFile, connection, (SqlTransaction)tx);
            insertFileCommand.CommandType = CommandType.Text;

            insertFileCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            insertFileCommand.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 255) { Value = name });
            insertFileCommand.Parameters.Add(new SqlParameter("@SizeBytes", SqlDbType.BigInt) { Value = file.Length });
            insertFileCommand.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar, 500) { Value = (object?)description ?? DBNull.Value });
            insertFileCommand.Parameters.Add(new SqlParameter("@Width", SqlDbType.Int) { Value = (object?)width ?? DBNull.Value });
            insertFileCommand.Parameters.Add(new SqlParameter("@Height", SqlDbType.Int) { Value = (object?)height ?? DBNull.Value });
            insertFileCommand.Parameters.Add(new SqlParameter("@ThumbnailUrl", SqlDbType.NVarChar, 500) { Value = (object?)thumbnailUrl ?? DBNull.Value });
            insertFileCommand.Parameters.Add(new SqlParameter("@IsImage", SqlDbType.Bit) { Value = isImage });
            insertFileCommand.Parameters.Add(new SqlParameter("@Extension", SqlDbType.VarChar, 15) { Value = extension });

            var fileResult = await insertFileCommand.ExecuteScalarAsync(cancellationToken);
            if (fileResult is null)
                throw new InvalidOperationException("FilesService.CreateAsync(Guid:file:token): Failed to create file record.");

            var newFileId = Guid.Parse(fileResult.ToString() ?? Guid.Empty.ToString());
            physicalPath = BuildPhysicalFilePath(companyCode, newFileId, extension);

            var relativePath = $"/files/{companyCode:D}/{newFileId:D}{extension}";

            await using (var fs = new FileStream(
                             physicalPath,
                             FileMode.CreateNew,
                             FileAccess.Write,
                             FileShare.None,
                             bufferSize: 1024 * 1024,
                             useAsync: true))
            {
                await file.CopyToAsync(fs, cancellationToken);
            }

            if (thumbnailUrl is null)
            {
                // Relative URL is fine; frontend can prepend API base if needed

                await using var updateThumbCmd = new SqlCommand(SqlUpdateThumbnailUrl, connection, (SqlTransaction)tx);
                updateThumbCmd.CommandType = CommandType.Text;
                updateThumbCmd.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = newFileId });
                updateThumbCmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
                updateThumbCmd.Parameters.Add(new SqlParameter("@ThumbnailUrl", SqlDbType.NVarChar, 500) { Value = relativePath });

                await updateThumbCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            var thumbnailUri = new Uri(relativePath, UriKind.RelativeOrAbsolute);

            await tx.CommitAsync(cancellationToken);

            // 4) Return DTO
            return new FileAsset
            {
                Id = newFileId.ToString(),
                Name = name,
                Description = description ?? string.Empty,
                Extension = extension,
                SizeBytes = file.Length,
                UploadDate = DateOnly.FromDateTime(DateTime.UtcNow),
                CompanyCode = companyCode,
                LinkedArticles = [],
                ThumbnailUrl = thumbnailUri,
                Width = width,
                Height = height
            };
        }
        catch (Exception ex)
        {
            try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }

            if (!string.IsNullOrWhiteSpace(physicalPath))
            {
                try
                {
                    if (System.IO.File.Exists(physicalPath))
                        System.IO.File.Delete(physicalPath);
                }
                catch { /* ignore */ }
            }

            Log.Error(ex, "FilesService.CreateAsync(Guid:file:token) failed for companyCode={CompanyCode}", companyCode);
            throw;
        }
    }

    public async Task SaveFileMetadataAsync(Guid companyCode, Guid articleId, MultipleFilesDto upload,
        CancellationToken cancellationToken)
    {
        ValidateGuid(companyCode);
        ValidateGuid(articleId);
        if (upload.Files.Count == 0) return;
        
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction();
        
        await using var insertFileCommand = new SqlCommand(SqlInsertFile,  connection, (SqlTransaction)transaction);
        insertFileCommand.CommandType = CommandType.Text;

        insertFileCommand.Parameters.Add("@CompanyCode", SqlDbType.UniqueIdentifier);
        insertFileCommand.Parameters.Add("@Name", SqlDbType.NVarChar, Constants.ArticleTitleCharacterLength);
        insertFileCommand.Parameters.Add("@SizeBytes", SqlDbType.BigInt);
        insertFileCommand.Parameters.Add("@Description", SqlDbType.NVarChar, -1);
        insertFileCommand.Parameters.Add("@Width", SqlDbType.Int);
        insertFileCommand.Parameters.Add("@Height", SqlDbType.Int);
        insertFileCommand.Parameters.Add("@ThumbnailUrl", SqlDbType.NVarChar, -1);
        insertFileCommand.Parameters.Add("@IsImage", SqlDbType.Bit);
        insertFileCommand.Parameters.Add("@Extension", SqlDbType.VarChar, Constants.FileExtensionCharacterLength);

        try
        {
            foreach (var file in upload.ToUploads())
            {
                var thumbnailUrl = file.IsImage ? 
                    directoryBuilder.GetArticleImageFilePath(companyCode, articleId, file.File.FileName) : 
                    null;
                
                insertFileCommand.Parameters["@CompanyCode"].Value = companyCode;
                insertFileCommand.Parameters["@Name"].Value = file.File.FileName;
                insertFileCommand.Parameters["@SizeBytes"].Value = file.File.Length;
                insertFileCommand.Parameters["@Description"].Value = file.Description;
                insertFileCommand.Parameters["@Width"].Value = (object?)file.Width ?? DBNull.Value;
                insertFileCommand.Parameters["@Height"].Value = (object?)file.Height ?? DBNull.Value;
                insertFileCommand.Parameters["@ThumbnailUrl"].Value = (object?)thumbnailUrl ?? DBNull.Value;
                insertFileCommand.Parameters["@IsImage"].Value = file.IsImage;
                insertFileCommand.Parameters["@Extension"].Value = Path.GetExtension(file.File.FileName);
                
                await insertFileCommand.ExecuteNonQueryAsync(cancellationToken);
            }
            transaction.Commit();
        }
        catch (Exception e)
        {
            transaction.Rollback();
            Log.Error("FileService.SaveFileMetadataAsync: Transaction rolled back due to: {}", e.Message);
            throw e;
        }
    }

    public async Task<FileDto?> UpdateAsync(Guid fileId, Guid companyCode, UpdateFileRequest request, CancellationToken cancellationToken)
    {
        ValidateGuid(companyCode);
        ValidateGuid(fileId);
        request.Validate();

        // Normalize to null when not provided / whitespace so SQL can keep current value
        var name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim();
        var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            // Setup command
            await using var updateCommand = new SqlCommand(SqlUpdateFileReturnDto, connection);
            updateCommand.CommandType = CommandType.Text;

            updateCommand.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = fileId });
            updateCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            updateCommand.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 255) { Value = (object?)name ?? DBNull.Value });
            updateCommand.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar, 500) { Value = (object?)description ?? DBNull.Value });

            await using var reader = await updateCommand.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null; // not found or not in tenant

            // column index reads
            var dto = new FileDto
            {
                Id = reader.GetInt32(0).ToString(),
                Name = reader.GetString(1),
                Description = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                Extension = reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                ThumbnailUrl = reader.IsDBNull(4) ? null : reader.GetString(4),
                IsImage = !reader.IsDBNull(5) && reader.GetBoolean(5),
                UploadDate = reader.GetDateTime(6),
            };

            return dto;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesService.UpdateAsync(int:Guid:request:token) failed for fileId={FileId}, companyCode={CompanyCode}", fileId, companyCode);
            throw;
        }
    }
    
    public async Task<bool> DeleteAsync(Guid fileId, Guid companyCode, CancellationToken cancellationToken)
    {
        ValidateGuid(companyCode);
        ValidateGuid(fileId);

        var downloadPath = await GetDownloadInfoAsync(fileId, companyCode, cancellationToken);
        if  (downloadPath is null) return false;
        var physicalPath = Path.Combine(env.WebRootPath, downloadPath);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var deleteFileArticlesCommand = new SqlCommand(SqlDeleteFileArticles, connection);
            deleteFileArticlesCommand.CommandType = CommandType.Text;
            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = fileId });
            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            await deleteFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);

            await using var deleteFileCommand = new SqlCommand(SqlDeleteFile, connection);
            deleteFileCommand.CommandType = CommandType.Text;
            deleteFileCommand.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = fileId });
            deleteFileCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            var deleted = await deleteFileCommand.ExecuteNonQueryAsync(cancellationToken);
            if (deleted <= 0) return false;

            // Best-effort physical delete
            if (string.IsNullOrWhiteSpace(physicalPath)) return true;
            try
            {
                if (File.Exists(physicalPath))
                    File.Delete(physicalPath);
            }
            catch (Exception ioEx)
            {
                Log.Warning(ioEx, "Failed to delete physical file {PhysicalPath} for fileId={FileId}", physicalPath, fileId);
            }

            return true;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesService.DeleteAsync(int:Guid:token) failed for fileId={FileId}, companyCode={CompanyCode}", fileId, companyCode);
            throw;
        }
    }
    
    public async Task<string?> GetDownloadInfoAsync(Guid fileId, Guid companyCode, CancellationToken cancellationToken)
    {
        ValidateGuid(companyCode);
        ValidateGuid(fileId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlSelectFileUrl, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@FileId", SqlDbType.UniqueIdentifier) { Value = fileId });

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null;

            var url = reader.GetString(0);

            return url;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesService.GetDownloadInfoAsync(int:Guid:token) failed for fileId={FileId}, companyCode={CompanyCode}", fileId, companyCode);
            throw;
        }
    }
    
    // ----------- Helper Validation Functions -----------
    
    /// <summary>
    /// Throws if the companyCode is empty.
    /// </summary>
    /// <param name="companyCode">Guid</param>
    /// <exception cref="ArgumentException"></exception>
    private static void ValidateGuid(Guid companyCode)
    {
        if (companyCode == Guid.Empty)
            throw new ArgumentException("companyCode is required and cannot be empty.", nameof(companyCode));
    }

    /// <summary>
    /// Throws if the given id is not valid.
    /// </summary>
    /// <param name="id">int</param>
    /// <exception cref="ArgumentOutOfRangeException"></exception>
    private static void ValidateId(int id)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id, nameof(id));
    }

    /// <summary>
    /// Validates the given file. Throws if invalid. 
    /// </summary>
    /// <param name="file">IFormFile</param>
    /// <exception cref="ArgumentNullException"></exception>
    /// <exception cref="ArgumentException"></exception>
    private static void ValidateFile(IFormFile file)
    {
        if (file is null) throw new ArgumentNullException(nameof(file));
        if (file.Length <= 0) throw new ArgumentException("File is empty.", nameof(file));
        if (string.IsNullOrWhiteSpace(file.FileName)) throw new ArgumentException("FileName is required.", nameof(file));
    }

    /// <summary>
    /// Determines whether the given file is an image.
    /// </summary>
    /// <param name="file">IFormFile</param>
    /// <param name="extension">string</param>
    /// <returns>True if is image, false otherwise.</returns>
    private static bool IsImage(IFormFile file, string extension)
    {
        if (!string.IsNullOrWhiteSpace(file.ContentType) &&
            file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return true;

        // fallback to extension
        return extension.Equals(".png", StringComparison.OrdinalIgnoreCase)
               || extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase)
               || extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase)
               || extension.Equals(".gif", StringComparison.OrdinalIgnoreCase)
               || extension.Equals(".webp", StringComparison.OrdinalIgnoreCase)
               || extension.Equals(".bmp", StringComparison.OrdinalIgnoreCase)
               || extension.Equals(".tif", StringComparison.OrdinalIgnoreCase)
               || extension.Equals(".tiff", StringComparison.OrdinalIgnoreCase);
    }
}
