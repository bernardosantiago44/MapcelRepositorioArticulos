using System.Data;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

namespace MapcelRepositorioArticulos.DataService;

public interface ITagsService
{
    public Task<IEnumerable<TagDto>> GetTagsAsync(TagsQuery query, CancellationToken cancellationToken);
}

public sealed class TagsService(IConfiguration configuration) : BaseService(configuration), ITagsService
{
    public async Task<IEnumerable<TagDto>> GetTagsAsync(TagsQuery query, CancellationToken cancellationToken)
    {
        var tags = new List<TagDto>();
        
        // The query is needed for the company id.
        if (query is null) throw new ArgumentException(nameof(query));

        var companyCode = query.CompanyCode;
        const string sql = @"
            SELECT 
                t.tag_id,
                t.name,
                t.color,
                t.description
            FROM [dbo].[tags] t
            WHERE t.company_code = @companyCode
            AND (
                @search IS NULL
                OR t.name LIKE '%' + @search + '%'
                OR t.description LIKE '%' + @search + '%'
            )
            ORDER BY t.name DESC;
        ";

        await using (var connection = new SqlConnection(ConnectionString))
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            await using (var command = new SqlCommand(sql, connection))
            {
                command.CommandType = CommandType.Text;
                
                command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.VarChar, 20) { Value = companyCode });
                command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 250) { Value = query.Search.IsNullOrEmpty() ? DBNull.Value : query.Search! });
                
                await using (var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
                {
                    var idPos = reader.GetOrdinal("tag_id");
                    var namePos = reader.GetOrdinal("name");
                    var colorPos = reader.GetOrdinal("color");
                    var descriptionPos = reader.GetOrdinal("description");
                    
                    while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                    {
                        var id = reader.GetInt32(idPos);
                        var name = reader.GetString(namePos);
                        var color = reader.GetString(colorPos);
                        var description = reader.GetString(descriptionPos);
                        tags.Add(new TagDto
                        {
                            Id = id.ToString(),
                            Name = name,
                            Color = color,
                            Description = description
                        });
                    }
                }
            }
        }
        return tags;
    }
}