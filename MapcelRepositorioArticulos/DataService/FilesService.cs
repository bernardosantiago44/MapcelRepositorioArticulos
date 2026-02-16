using System.Data;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

namespace MapcelRepositorioArticulos.DataService;

public interface IFilesService
{
    /// <summary>
    /// 
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

        await using var connection = new SqlConnection(_connectionString);
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

        await using var connection = new SqlConnection(_connectionString);
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

        await using var connection = new SqlConnection(_connectionString);
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

}