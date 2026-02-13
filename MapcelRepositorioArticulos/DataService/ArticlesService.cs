using System.Data;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Serilog;

namespace MapcelRepositorioArticulos.DataService;

public interface IArticlesService
{
    public Task<PagedResult<ArticleRowDto>> GetAsync(ArticleQuery query, CancellationToken cancellationToken);
}

public sealed class ArticlesService(IConfiguration configuration) : BaseService(configuration), IArticlesService
{
    public async Task<PagedResult<ArticleRowDto>> GetAsync(ArticleQuery query, CancellationToken cancellationToken)
    {
        var rows = new List<ArticleRowDto>();

        if (query is null) throw new ArgumentNullException(nameof(query));
        if (query.Page <= 0) throw new ArgumentOutOfRangeException(nameof(query.Page));
        if (query.PageSize <= 0) throw new ArgumentOutOfRangeException(nameof(query.PageSize));

        int offset = (query.Page - 1) * query.PageSize;

        var companyCode = query.CompanyId;
        if (string.IsNullOrWhiteSpace(companyCode))
            throw new ArgumentNullException(nameof(query.CompanyId));

        const string sql = @"
            WITH ArticleBase AS (
                SELECT a.article_id
                FROM [dbo].[articles] a
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
                            SELECT 1 FROM article_tags filter_at
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
                tag_data.tags
            FROM ArticleBase b
            JOIN [dbo].[articles] a ON b.article_id = a.article_id
            OUTER APPLY (
                SELECT STRING_AGG(t.tag_id, ',') AS tags
                FROM article_tags at
                JOIN tags t ON at.tag_id = t.tag_id
                WHERE at.article_id = a.article_id
            ) AS tag_data
            ORDER BY a.created_at DESC;

            -- 2. Get the total count using the EXACT SAME filters
            SELECT COUNT(1)
            FROM [dbo].[articles] a
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
                        SELECT 1 FROM article_tags filter_at
                        WHERE filter_at.article_id = a.article_id
                        AND filter_at.tag_id IN (SELECT value FROM STRING_SPLIT(@tagIds, ','))
                    )
                  );
        ";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using (var command = new SqlCommand(sql, connection))
        {
            command.CommandType = CommandType.Text;

            // Mandatory parameters
            command.Parameters.Add(new SqlParameter("@offset", SqlDbType.Int) { Value = offset });
            command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = query.PageSize });
            command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.NVarChar, 20) { Value = companyCode });
            
            // Optional parameters
            command.Parameters.Add(new SqlParameter("@status", SqlDbType.VarChar, 50) { Value = string.IsNullOrWhiteSpace(query.Status) ? DBNull.Value : query.Status });
            command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, int.MaxValue) { Value = string.IsNullOrWhiteSpace(query.Search) ? DBNull.Value : query.Search });
            command.Parameters.Add(new SqlParameter("@tagIds", SqlDbType.VarChar) { Value = !query.IsTagsFilterAvailable() ? DBNull.Value : query.CleanTagFiltersString() });
            command.Parameters.Add(new SqlParameter("@articleId", SqlDbType.Int) { Value = query.ArticleId == null ? DBNull.Value : query.ArticleId.Value });
            
            int total = 0;
            await using (var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
            {
                // Result set 1: page rows
                while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                {
                    var idPos = reader.GetOrdinal("article_id");
                    var titlePos = reader.GetOrdinal("title");
                    var descriptionPos = reader.GetOrdinal("description");
                    var statusPos = reader.GetOrdinal("status");
                    var createdAtPos = reader.GetOrdinal("created_at");
                    var updatedAtPos = reader.GetOrdinal("updated_at");
                    var tagsPos = reader.GetOrdinal("tags");

                    rows.Add(new ArticleRowDto
                    {
                        Id = reader.GetInt32(idPos).ToString(),
                        CompanyId = companyCode,
                        Title = reader.IsDBNull(titlePos) ? "" : reader.GetString(titlePos),
                        Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                        Status = reader.IsDBNull(statusPos) ? "" : reader.GetString(statusPos),
                        CreatedAt = DateOnly.FromDateTime(reader.IsDBNull(createdAtPos) ? DateTime.MinValue : reader.GetDateTime(createdAtPos)),
                        UpdatedAt = DateOnly.FromDateTime(reader.IsDBNull(updatedAtPos) ? DateTime.Now : reader.GetDateTime(updatedAtPos)),
                        Tags = reader.IsDBNull(tagsPos) ? [] : reader.GetString(tagsPos).Split(',')
                    });
                }

                // Result set 2: total
                if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false))
                {
                    if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
                }
            }
            return new PagedResult<ArticleRowDto>(rows, total, query.Page, query.PageSize);
        }
    }
}