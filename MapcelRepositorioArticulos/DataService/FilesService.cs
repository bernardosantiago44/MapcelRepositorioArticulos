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
}

public class FilesService(IConfiguration configuration) : BaseService(configuration), IFilesService
{
    public async Task<PagedResult<FileDto>> GetAsync(FileQuery query, CancellationToken cancellationToken)
    {
        var rows = new List<FileDto>();
        
        if (query is null) throw new ArgumentNullException(nameof(query));
        if (query.Page <= 0) throw new ArgumentOutOfRangeException(nameof(query));
        if (query.PageSize <= 0 || query.PageSize >= 200) throw new ArgumentOutOfRangeException(nameof(query));
        if (!query.IsValidQuery()) throw new ArgumentNullException(nameof(query));

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
                ORDER BY f.upload_date DESC
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
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
            ORDER BY f.upload_date DESC;

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

        var extensionString = query.GetFileExtensionsString();

        await using (var connection = new SqlConnection(_connectionString))
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

            await using (var command = new SqlCommand(sql, connection))
            {
                command.CommandType = CommandType.Text;
                
                // Mandatory Parameters
                command.Parameters.Add(new SqlParameter("@offset", SqlDbType.Int) { Value = offset });
                command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = query.PageSize });
                
                // Optional parameters
                command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.NVarChar, 20) { Value = companyCode == null ? DBNull.Value : companyCode });
                command.Parameters.Add(new SqlParameter("@fileId", SqlDbType.Int) { Value = fileId == null ? DBNull.Value : fileId! });
                command.Parameters.Add(new SqlParameter("@extensions", SqlDbType.VarChar, 2000) { Value = query.IsFilteringExtensions() ? query.GetFileExtensionsString() : DBNull.Value });
                command.Parameters.Add(new SqlParameter("@isImage", SqlDbType.Bit) { Value = query.ImagesOnly ? 1 : 0 });
                command.Parameters.Add(new SqlParameter("@search", SqlDbType.VarChar, 2000) { Value = string.IsNullOrEmpty(query.SearchTerm) ? DBNull.Value : query.SearchTerm! });

                int total = 0;
                await using (var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
                {
                    while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                    {
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
                        
                        rows.Add(new FileDto
                        {
                            Id = reader.GetInt32(idPos).ToString(),
                            Name = reader.GetString(namePos),
                            Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                            Extension = reader.GetString(extensionsPos),
                            ThumbnailUrl =  reader.IsDBNull(thumbnailUrlPos) ? "" : reader.GetString(thumbnailUrlPos),
                        });
                    }

                    if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false))
                    {
                        if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
                    }
                }
                return new PagedResult<FileDto>(rows, total, query.Page, query.PageSize);
            }
        }
    }
}