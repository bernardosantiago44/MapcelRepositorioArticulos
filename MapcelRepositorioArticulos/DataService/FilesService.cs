using System.Data;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Serilog;

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
    public Task<IReadOnlyList<FileDto>> GetByArticleIdAsync(int articleId, CancellationToken cancellationToken);
    
    /// <summary>
    /// Returns a list of all the files (images and files) given their ids.
    /// Returns an empty array if no ids are provided, or if none is not found. 
    /// </summary>
    /// <param name="ids"></param>
    /// <param name="cancellationToken"></param>
    /// <exception cref="ArgumentNullException">If articleId is null</exception>
    /// <returns></returns>
    public Task<IReadOnlyList<FileDto>> GetByIdsAsync(int[] ids, CancellationToken cancellationToken);
    
    Task<FileAsset> CreateAsync(string companyId, IFormFile file, CancellationToken cancellationToken);
    Task<FileDto?> UpdateAsync(int fileId, string companyId, UpdateFileRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int fileId, string companyId, CancellationToken cancellationToken);
    
    Task<(string Name, string Extension)?> GetDownloadInfoAsync(int fileId, string companyId, CancellationToken cancellationToken);


}

public class FilesService(IConfiguration configuration) : BaseService(configuration), IFilesService
{
    // Eliminar el With, innecesario 
    private const string SqlSelectFilesByArticleId = @"
        SELECT
            f.file_id,
            f.name,
            f.description,
            f.thumbnail_url,
            f.extension,
            f.is_image
        FROM [dbo].[files] f
        INNER JOIN [dbo].[file_articles] fa ON f.file_id = fa.file_id
        WHERE fa.article_id = @articleId
        ORDER BY f.is_image DESC, f.upload_date DESC;
    ";

    // Revisar eficiencia al terminar 
    private const string SqlSelectFilesByIdsCsv = @"
        WITH FileBase AS (
            SELECT f.file_id
            FROM [dbo].[files] f
            WHERE f.file_id IN (
                SELECT TRY_CAST(value AS int)
                FROM STRING_SPLIT(@idsCsv, ',')
                WHERE TRY_CAST(value AS int) IS NOT NULL
            )
        )
        SELECT
            f.file_id,
            f.name,
            f.description,
            f.thumbnail_url,
            f.extension,
            f.is_image
        FROM FileBase b
        INNER JOIN [dbo].[files] f ON f.file_id = b.file_id
        ORDER BY f.is_image DESC, f.upload_date DESC;
    ";
    private const string SqlInsertFile = @"
        INSERT INTO [dbo].[files]
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
    ";
    private const string SqlUpdateFileReturnDto = @"
        UPDATE [dbo].[files]
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
        WHERE file_id = @FileId
          AND company_code = @CompanyCode;
    ";
    private const string SqlSelectFileDtoById = @"
        SELECT
            f.file_id,
            f.name,
            f.description,
            f.extension,
            f.thumbnail_url,
            f.is_image
        FROM [dbo].[files] f
        WHERE f.file_id = @FileId
          AND f.company_code = @CompanyCode;
    ";
    private const string SqlDeleteFileArticles = @"
        DELETE fa
        FROM [dbo].[file_articles] fa
        INNER JOIN dbo.files f ON f.file_id = fa.file_id
        WHERE fa.file_id = @FileId
          AND f.company_code = @CompanyCode;
    ";
    private const string SqlDeleteFile = @"
        DELETE f
        FROM [dbo].[files] f
        WHERE f.file_id = @FileId
          AND f.company_code = @CompanyCode;
    ";
    private const string SqlSelectDownloadInfo = @"
        SELECT
            f.name,
            f.extension
        FROM [dbo].[files] f
        WHERE f.file_id = @FileId
          AND f.company_code = @CompanyCode;
    ";
    
    public async Task<PagedResult<FileDto>> GetAsync(FileQuery query, CancellationToken cancellationToken)
    {
        var rows = new List<FileDto>();
        
        ArgumentNullException.ThrowIfNull(query);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(query.Page);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(query.PageSize);
        ArgumentOutOfRangeException.ThrowIfGreaterThanOrEqual(query.PageSize, 200);
        if (!query.IsValidQuery()) throw new ArgumentException("Invalid file query.", nameof(query));

        int offset = (query.Page - 1) * query.PageSize;

        var companyCode = query.CompanyId;
        var fileId = query.Id;
        
        var queryType = query.GetFileQueryType();
        if (queryType == FileQuery.FileQueryType.ByCompany && companyCode.IsNullOrEmpty()) throw new ArgumentNullException(nameof(query));
        if (queryType == FileQuery.FileQueryType.ById && fileId == null) throw new ArgumentNullException(nameof(query));
        if (queryType == FileQuery.FileQueryType.Undefined) throw new ArgumentNullException(nameof(query));

        // IMPORTANT: When adding additional filters to the query,
        // Add them both inside the `SELECT` of the `WITH FileBase AS`
        // And in the total count for pagination.
        const string sql = @"
            WITH FileBase AS (
                SELECT f.file_id
                FROM [dbo].[files] f
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
            JOIN [dbo].[files] f ON b.file_id = f.file_id
            ORDER BY f.upload_date DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

            -- Total count (Synchronized filters)
            SELECT COUNT(1)
            FROM [dbo].[files] f
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
        command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.VarChar, 20) { Value = companyCode == null ? DBNull.Value : companyCode });
        command.Parameters.Add(new SqlParameter("@fileId", SqlDbType.Int) { Value = fileId == null ? DBNull.Value : fileId! });
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
                Id = reader.GetInt32(idPos).ToString(),
                Name = reader.GetString(namePos),
                Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                Extension = reader.GetString(extensionsPos),
                ThumbnailUrl =  reader.IsDBNull(thumbnailUrlPos) ? "" : reader.GetString(thumbnailUrlPos),
                IsImage = reader.IsDBNull(isImagePos) ? false : reader.GetBoolean(isImagePos),
            });
        }

        // Exit if next result (count query) is unable to be executed
        if (!await reader.NextResultAsync(cancellationToken).ConfigureAwait(false)) return new PagedResult<FileDto>(rows, rows.Count, query.Page, query.PageSize);
        if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
    
        return new PagedResult<FileDto>(rows, total, query.Page, query.PageSize);
    }

    public async Task<IReadOnlyList<FileDto>> GetByArticleIdAsync(int articleId, CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(articleId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new SqlCommand(SqlSelectFilesByArticleId, connection);
        command.CommandType = CommandType.Text;
        command.Parameters.Add(new SqlParameter("@articleId", SqlDbType.Int) { Value = articleId });

        return await ExecuteAndMapFilesAsync(command, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<FileDto>> GetByIdsAsync(int[] ids, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        if (ids.Length == 0) return Array.Empty<FileDto>();

        // remove invalid/duplicate ids
        var cleanIds = ids.Where(x => x > 0).Distinct().ToArray();
        if (cleanIds.Length == 0) return Array.Empty<FileDto>();

        // switch to TVP if size of ids increase.
        var idsCsv = string.Join(",", cleanIds);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new SqlCommand(SqlSelectFilesByIdsCsv, connection);
        command.CommandType = CommandType.Text;
        command.Parameters.Add(new SqlParameter("@idsCsv", SqlDbType.VarChar, 8000) { Value = idsCsv });

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

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            rows.Add(new FileDto
            {
                Id = reader.GetInt32(fileIdPos).ToString(),
                Name = reader.GetString(namePos),
                Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                ThumbnailUrl = reader.IsDBNull(thumbnailUrlPos) ? "" : reader.GetString(thumbnailUrlPos),
                Extension = reader.IsDBNull(extensionPos) ? "" : reader.GetString(extensionPos),
                IsImage = reader.IsDBNull(isImagePos) ? false : reader.GetBoolean(isImagePos),
            });
        }

        return rows;
    }
    
    public async Task<FileAsset> CreateAsync(string companyId, IFormFile file, CancellationToken cancellationToken)
    {
        ValidateCompany(companyId);
        ValidateFile(file);

        // Split filename into (name, extension)
        var originalFileName = Path.GetFileName(file.FileName);
        var name = Path.GetFileNameWithoutExtension(originalFileName).Trim();
        var extension = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(extension)) extension = string.Empty;

        var isImage = IsImage(file, extension);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var insertFileCommand = new SqlCommand(SqlInsertFile, connection);
            insertFileCommand.CommandType = CommandType.Text;

            insertFileCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 50) { Value = companyId });
            insertFileCommand.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 255) { Value = name });
            insertFileCommand.Parameters.Add(new SqlParameter("@SizeBytes", SqlDbType.BigInt) { Value = file.Length });
            insertFileCommand.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar, 500) { Value = DBNull.Value }); // POST only carries file
            insertFileCommand.Parameters.Add(new SqlParameter("@Width", SqlDbType.Int) { Value = DBNull.Value });
            insertFileCommand.Parameters.Add(new SqlParameter("@Height", SqlDbType.Int) { Value = DBNull.Value });
            insertFileCommand.Parameters.Add(new SqlParameter("@ThumbnailUrl", SqlDbType.NVarChar, 500) { Value = DBNull.Value });
            insertFileCommand.Parameters.Add(new SqlParameter("@IsImage", SqlDbType.Bit) { Value = isImage });
            insertFileCommand.Parameters.Add(new SqlParameter("@Extension", SqlDbType.VarChar, 15) { Value = extension });

            var fileResult = await insertFileCommand.ExecuteScalarAsync(cancellationToken);
            if (fileResult is null)
                throw new InvalidOperationException("FilesService.CreateAsync(string:file:token): Failed to create file record.");

            var newFileId = Convert.ToInt32(fileResult);

            // NOTE: actual binary storage is mocked for now (no column exists in schema for bytes).
            // This method only persists metadata to dbo.files.

            var created = new FileAsset
            {
                Id = newFileId.ToString(),
                Name = name,
                Description = string.Empty,
                Extension = extension,
                SizeBytes = file.Length,
                UploadDate = DateOnly.FromDateTime(DateTime.UtcNow),
                CompanyId = companyId,
                LinkedArticles = [],
                ThumbnailUrl = null,
                Width = null,
                Height = null
            };

            return created;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesService.CreateAsync(string:file:token) failed for companyCode={CompanyCode}", companyId);
            throw;
        }
    }
    
    public async Task<FileDto?> UpdateAsync(int fileId, string companyId, UpdateFileRequest request, CancellationToken cancellationToken)
    {
        ValidateCompany(companyId);
        ValidateId(fileId);
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

            updateCommand.Parameters.Add(new SqlParameter("@FileId", SqlDbType.Int) { Value = fileId });
            updateCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 50) { Value = companyId });
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
                IsImage = !reader.IsDBNull(5) && reader.GetBoolean(5)
            };

            return dto;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesService.UpdateAsync(int:string:request:token) failed for fileId={FileId}, companyCode={CompanyCode}", fileId, companyId);
            throw;
        }
    }
    
    public async Task<bool> DeleteAsync(int fileId, string companyId, CancellationToken cancellationToken)
    {
        ValidateCompany(companyId);
        ValidateId(fileId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            // 1) delete junction rows first (FK-safe)
            await using var deleteFileArticlesCommand = new SqlCommand(SqlDeleteFileArticles, connection);
            deleteFileArticlesCommand.CommandType = CommandType.Text;

            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@FileId", SqlDbType.Int) { Value = fileId });
            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 50) { Value = companyId });

            await deleteFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);

            // 2) delete file row
            await using var deleteFileCommand = new SqlCommand(SqlDeleteFile, connection);
            deleteFileCommand.CommandType = CommandType.Text;

            deleteFileCommand.Parameters.Add(new SqlParameter("@FileId", SqlDbType.Int) { Value = fileId });
            deleteFileCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 50) { Value = companyId });

            var deleted = await deleteFileCommand.ExecuteNonQueryAsync(cancellationToken);
            return deleted > 0;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesService.DeleteAsync(int:string:token) failed for fileId={FileId}, companyCode={CompanyCode}", fileId, companyId);
            throw;
        }
    }
    
    public async Task<(string Name, string Extension)?> GetDownloadInfoAsync(int fileId, string companyId, CancellationToken cancellationToken)
    {
        ValidateCompany(companyId);
        ValidateId(fileId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlSelectDownloadInfo, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@FileId", SqlDbType.Int) { Value = fileId });
            cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 50) { Value = companyId });

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null;

            var name = reader.GetString(0);
            var extension = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);

            return (name, extension);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesService.GetDownloadInfoAsync(int:string:token) failed for fileId={FileId}, companyCode={CompanyCode}", fileId, companyId);
            throw;
        }
    }
    
    // ----------- Helper Validation Functions -----------
    
    /// <summary>
    /// Throws if the companyId string is null or whitespace.
    /// </summary>
    /// <param name="companyId">string</param>
    /// <exception cref="ArgumentException"></exception>
    private static void ValidateCompany(string companyId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(companyId, nameof(companyId));
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