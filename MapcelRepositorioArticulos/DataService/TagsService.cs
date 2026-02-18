using System.Data;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace MapcelRepositorioArticulos.DataService;

public interface ITagsService
{
    /// <summary>
    /// Gets all Tag records from the SQL Database
    /// for the given company code.
    /// </summary>
    /// <param name="query">TagsQuery with optional search param.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>IReadOnlyList&lt;Tag&gt;</returns>
    /// <exception cref="ArgumentException"></exception>
    Task<IReadOnlyList<Tag>> GetAllAsync(TagsQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// Gets a Tag record from the SQL Database
    /// by its tag id. No company code is required.
    /// </summary>
    /// <param name="tagId">int</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Tag?</returns>
    /// <exception cref="ArgumentException"></exception>
    Task<Tag?> GetByIdAsync(int tagId, CancellationToken cancellationToken);

    /// <summary>
    /// Creates a new Tag record in the SQL Database
    /// for the given company code with the given request.
    /// </summary>
    /// <param name="companyCode">string</param>
    /// <param name="request">CreateTagRequest</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Tag</returns>
    /// <exception cref="ArgumentException"></exception>
    Task<Tag> CreateAsync(string companyCode, CreateTagRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Updates an existing Tag record in the SQL Database
    /// by its tag id with the given request.
    /// </summary>
    /// <param name="tagId">int</param>
    /// <param name="request">UpdateTagRequest</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Tag?</returns>
    /// <exception cref="ArgumentException"></exception>
    Task<Tag?> UpdateAsync(int tagId, UpdateTagRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Deletes an existing Tag record in the SQL Database
    /// by its tag id.
    /// </summary>
    /// <param name="tagId">int</param>
    /// <param name="cancellationToken"></param>
    /// <returns>bool</returns>
    /// <exception cref="ArgumentException"></exception>
    Task<bool> DeleteAsync(int tagId, CancellationToken cancellationToken);
}

public sealed class TagsService(IConfiguration configuration) : BaseService(configuration), ITagsService
{
    private const string SqlGetAllWithFilters = @"
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
    
    private const string SqlSelectTagById = @"
        SELECT
            t.tag_id,
            t.name,
            t.color,
            t.description,
            t.company_code
        FROM [dbo].[tags] t
        WHERE t.tag_id = @TagId;
    ";
    private const string SqlInsertTagReturn = @"
        INSERT INTO [dbo].[tags]
        (
            company_code,
            name,
            color,
            description
        )
        VALUES
        (
            @CompanyCode,
            @Name,
            @Color,
            @Description
        );
    ";
    private const string SqlUpdateTagReturn = @"
        UPDATE [dbo].[tags]
        SET
            name = COALESCE(NULLIF(@Name, ''), name),
            color = COALESCE(NULLIF(@Color, ''), color),
            description = COALESCE(NULLIF(@Description, ''), description)
        WHERE tag_id = @TagId;
    ";
    private const string SqlDeleteTagBatchReturn = @"
        DELETE at
        FROM [dbo].[article_tags] at
        WHERE at.tag_id = @TagId;

        DELETE t
        FROM [dbo].[tags] t
        WHERE t.tag_id = @TagId;

        SELECT @@ROWCOUNT;
    ";
            
    public async Task<IReadOnlyList<Tag>> GetAllAsync(TagsQuery query, CancellationToken cancellationToken)
    {
        // The query is needed for the company id.
        if (query is null) throw new ArgumentException("Query can not be null", nameof(query));
        
        ValidateCompany(query.CompanyCode);
        var companyCode = query.CompanyCode;
        
        try
        {
            await using var connection = new SqlConnection(ConnectionString);
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            
            await using var command = new SqlCommand(SqlGetAllWithFilters, connection);
            command.CommandType = CommandType.Text;

            command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.VarChar, 20) { Value = companyCode });
            command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, 250)
                { Value = query.Search.IsNullOrEmpty() ? DBNull.Value : query.Search! });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

            var tags = new List<Tag>();
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                var id = reader.GetInt32(0);
                var name = reader.GetString(1);
                var color = reader.GetString(2);
                var description = reader.GetString(3);
                tags.Add(new Tag(
                    id.ToString(),
                    name,
                    color,
                    description,
                    companyCode
                ));
            }
            return tags;
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"TagsService.GetAllAsync(string:token) failed for companyCode={query.CompanyCode}");
            throw;
        }
    }
    
    public async Task<Tag?> GetByIdAsync(int tagId, CancellationToken cancellationToken)
    {
        ValidateId(tagId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlSelectTagById, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@TagId", SqlDbType.Int) { Value = tagId });

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null;

            return new Tag
            {
                Id = reader.GetInt32(0).ToString(),
                Name = reader.GetString(1),
                Color = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                Description = reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                CompanyId = reader.GetString(4)
            };
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsService.GetByIdAsync(int:token) failed for tagId={TagId}", tagId);
            throw;
        }
    }

    public async Task<Tag> CreateAsync(string companyCode, CreateTagRequest request, CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);
        request.Validate();

        var name = request.Name.Trim();
        var color = string.IsNullOrWhiteSpace(request.Color) ? null : request.Color.Trim();
        var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlInsertTagReturn, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 20) { Value = companyCode });
            cmd.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 100) { Value = name });
            cmd.Parameters.Add(new SqlParameter("@Color", SqlDbType.VarChar, 20) { Value = (object?)color ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar, 250) { Value = (object?)description ?? DBNull.Value });

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
                throw new InvalidOperationException("TagsService.CreateAsync(string:request:token): Failed to create tag.");

            return new Tag
            {
                Id = reader.GetInt32(0).ToString(),
                Name = reader.GetString(1),
                Color = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                Description = reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                CompanyId = reader.GetString(4)
            };
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsService.CreateAsync(string:request:token) failed for companyCode={CompanyCode}", companyCode);
            throw;
        }
    }

    public async Task<Tag?> UpdateAsync(int tagId, UpdateTagRequest request, CancellationToken cancellationToken)
    {
        ValidateId(tagId);
        request.Validate();

        // null/whitespace → no change 
        var name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim();
        var color = string.IsNullOrWhiteSpace(request.Color) ? null : request.Color.Trim();
        var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlUpdateTagReturn, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@TagId", SqlDbType.Int) { Value = tagId });
            cmd.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 100) { Value = (object?)name ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Color", SqlDbType.VarChar, 20) { Value = (object?)color ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar, 250) { Value = (object?)description ?? DBNull.Value });

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null;

            return new Tag
            {
                Id = reader.GetInt32(0).ToString(),
                Name = reader.GetString(1),
                Color = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                Description = reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                CompanyId = reader.GetString(4)
            };
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsService.UpdateAsync(int:request:token) failed for tagId={TagId}", tagId);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int tagId, CancellationToken cancellationToken)
    {
        ValidateId(tagId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            // delete junction rows (article_tags), delete tag, and return deleted rowcount
            await using var cmd = new SqlCommand(SqlDeleteTagBatchReturn, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@TagId", SqlDbType.Int) { Value = tagId });

            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            var deleted = result is null ? 0 : Convert.ToInt32(result);

            return deleted > 0;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsService.DeleteAsync(int:token) failed for tagId={TagId}", tagId);
            throw;
        }
    }
    
    // ------------ Helper Validation Methods ------------
    private static void ValidateCompany(string companyCode)
    {
        if (string.IsNullOrWhiteSpace(companyCode))
            throw new ArgumentException("companyCode is required.", nameof(companyCode));
    }

    private static void ValidateId(int id)
    {
        if (id <= 0)
            throw new ArgumentOutOfRangeException(nameof(id), "Id must be > 0.");
    }
}