using System.Data;
using MapcelRepositorioArticulos.Models;
using MapcelRepositorioArticulos.Repository;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace MapcelRepositorioArticulos.DataService;

public sealed class ArticlesService : ControllerBase
{
    private readonly IConfiguration _configuration;
    private string _connectionString;

    public ArticlesService(IConfiguration configuration)
    {
        _configuration = configuration;
        _connectionString = string.Empty;
        try
        {
            this.SetupConnectionString("DefaultConnection");
        } catch (Exception error)
        {
            Log.Fatal($"CustomersService - ${error.Message}");
        }
    }

    private void SetupConnectionString(string connectionName) 
    {
        var connection = _configuration.GetConnectionString(connectionName);
        if (string.IsNullOrEmpty(connection))
        {
            throw new Exception("Could not find connection string in appsettings.json"); 
        }
        _connectionString = connection;
    }

    public async Task<PagedResult<ArticleRowDto>> GetAllRowsAsync(ArticleQuery query, CancellationToken cancellationToken)
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
            SELECT 
                a.article_id,
                a.title,
                a.description,
                a.status,
                a.created_at,
                a.updated_at
            FROM [dbo].[articles] a
            WHERE a.company_code = @companyCode
              AND (@status IS NULL OR a.status = @status)
              AND (
                    @search IS NULL
                    OR a.title LIKE '%' + @search + '%'
                    OR a.description LIKE '%' + @search + '%'
                  )
            ORDER BY a.created_at DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

            SELECT COUNT(1)
            FROM [dbo].[articles] a
            WHERE a.company_code = @companyCode
              AND (@status IS NULL OR a.status = @status)
              AND (
                    @search IS NULL
                    OR a.title LIKE '%' + @search + '%'
                    OR a.description LIKE '%' + @search + '%'
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

            // Optional parameters: must pass DBNull.Value when null/empty
            command.Parameters.Add(new SqlParameter("@status", SqlDbType.VarChar, 50)
            {
                Value = string.IsNullOrWhiteSpace(query.Status) ? DBNull.Value : query.Status
            });

            command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 250)
            {
                Value = string.IsNullOrWhiteSpace(query.Search) ? DBNull.Value : query.Search
            });

            int total = 0;
            await using (var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
            {
                // Result set 1: page rows
                while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                {
                    // ordinals: 0=article_id, 1=title, 2=description, 3=status
                    var id = reader.GetInt32(0);
                    var title = reader.IsDBNull(1) ? "" : reader.GetString(1);
                    var description = reader.IsDBNull(2) ? "" : reader.GetString(2);
                    var status = reader.IsDBNull(3) ? "" : reader.GetString(3);
                    var createdAt = reader.IsDBNull(4) ? new DateTime() : reader.GetDateTime(4);
                    var updatedAt = reader.IsDBNull(5) ? new DateTime() : reader.GetDateTime(5);

                    rows.Add(new ArticleRowDto
                    {
                        Id = id.ToString(),
                        CompanyId =  companyCode,
                        CompanyName = "",
                        Title = title,
                        Description = description,
                        Status = status,
                        CreatedAt = DateOnly.FromDateTime(createdAt),
                        UpdatedAt = DateOnly.FromDateTime(updatedAt),
                        Tags = new string[]{}
                    });
                }

                // Result set 2: total
                if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false))
                {
                    if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
                }

            }
            // Return: offset is fine to return (or use query.Page). Use total for real paging.
            return new PagedResult<ArticleRowDto>(rows, offset, query.PageSize, total);
        };
    }
}