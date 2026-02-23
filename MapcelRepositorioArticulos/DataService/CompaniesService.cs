using System.Data;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Serilog;

namespace MapcelRepositorioArticulos.DataService;

public interface ICompaniesService
{
    /// <summary>
    /// Retrieves all companies (with configurations) from db.
    /// </summary>
    /// <param name="cancellationToken"></param>
    /// <returns>Company[]</returns>
    Task<IReadOnlyList<Company>> GetAllAsync(CancellationToken cancellationToken);
    
    /// <summary>
    /// Retrieves a company object from the db, given the companyCode.
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="cancellationToken"></param>
    /// <returns>Company?</returns>
    /// <exception cref="ArgumentException">If the provided companyCode is not valid.</exception>
    Task<Company?> GetByIdAsync(string companyCode, CancellationToken cancellationToken);
    
    /// <summary>
    /// Updates a company's data given the update request.
    /// </summary>
    /// <param name="companyCode">The code of the company to be updated.</param>
    /// <param name="request"></param>
    /// <param name="cancellationToken"></param>
    /// <returns>Company?</returns>
    /// <exception cref="ArgumentException">If the company code or the request are (any) invalid.</exception>
    Task<Company?> UpdateAsync(string companyCode, UpdateCompanyRequest request, CancellationToken cancellationToken);
}


public sealed class CompaniesService(IConfiguration configuration) : BaseService(configuration), ICompaniesService
{
    private const string SqlSelectAllCompanies = @"
        SELECT
            c.company_code,
            c.name,
            c.allow_user_uploads,
            c.allow_user_tag_creation,
            c.require_client_comments
        FROM dbo.companies c
        ORDER BY c.name;
    ";
    private const string SqlSelectCompanyByCode = @"
        WITH CompanyCTE AS (
            SELECT
                company_code,
                name,
                allow_user_uploads,
                allow_user_tag_creation,
                require_client_comments
            FROM dbo.companies
            WHERE (@CompanyCode IS NULL OR company_code = @CompanyCode)
        )
        SELECT
            company_code,
            name,
            allow_user_uploads,
            allow_user_tag_creation,
            require_client_comments
        FROM CompanyCTE;
    ";
    private const string SqlUpdateCompanyReturn = @"
        UPDATE [dbo].[companies]
        SET
            name = COALESCE(NULLIF(@Name, ''), name),
            allow_user_uploads = COALESCE(@AllowUserUploads, allow_user_uploads),
            allow_user_tag_creation = COALESCE(@AllowUserTagCreation, allow_user_tag_creation),
            require_client_comments = COALESCE(@RequireClientComments, require_client_comments)
        OUTPUT
            INSERTED.company_code,
            INSERTED.name,
            INSERTED.allow_user_uploads,
            INSERTED.allow_user_tag_creation,
            INSERTED.require_client_comments
        WHERE company_code = @CompanyCode;
    ";
    
    public async Task<IReadOnlyList<Company>> GetAllAsync(CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlSelectAllCompanies, connection);
            cmd.CommandType = CommandType.Text;

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);

            var companies = new List<Company>();
            while (await reader.ReadAsync(cancellationToken))
            {
                
                companies.Add(new Company
                {
                    Id = reader.GetString(0),
                    Name = reader.GetString(1),
                    Settings = new CompanySettings
                    {
                        AllowUserUploads = reader.GetBoolean(2),
                        AllowUserTagCreation = reader.GetBoolean(3),
                        RequireClientComments = reader.GetBoolean(4)
                    }
                });
            }

            return companies;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "CompaniesService.GetAllAsync(token) failed");
            throw;
        }
    }
    
    public async Task<Company?> GetByIdAsync(string companyCode, CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlSelectCompanyByCode, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 20) { Value = companyCode });

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null;

            // Read by index (explicit select list)
            var company = new Company
            {
                Id = reader.GetString(0),
                Name = reader.GetString(1),
                Settings = new CompanySettings
                {
                    AllowUserUploads = reader.GetBoolean(2),
                    AllowUserTagCreation = reader.GetBoolean(3),
                    RequireClientComments = reader.GetBoolean(4)
                }
            };

            return company;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "CompaniesService.GetByIdAsync(string:token) failed for companyCode={CompanyCode}", companyCode);
            throw;
        }
    }

    public async Task<Company?> UpdateAsync(string companyCode, UpdateCompanyRequest request, CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);
        request.Validate();

        var name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim();

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var cmd = new SqlCommand(SqlUpdateCompanyReturn, connection);
            cmd.CommandType = CommandType.Text;

            cmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 20) { Value = companyCode });
            cmd.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 150) { Value = (object?)name ?? DBNull.Value });

            cmd.Parameters.Add(new SqlParameter("@AllowUserUploads", SqlDbType.Bit)
            { Value = request.AllowUserUploads.HasValue ? request.AllowUserUploads.Value : DBNull.Value });

            cmd.Parameters.Add(new SqlParameter("@AllowUserTagCreation", SqlDbType.Bit)
            { Value = request.AllowUserTagCreation.HasValue ? request.AllowUserTagCreation.Value : DBNull.Value });

            cmd.Parameters.Add(new SqlParameter("@RequireClientComments", SqlDbType.Bit)
            { Value = request.RequireClientComments.HasValue ? request.RequireClientComments.Value : DBNull.Value });

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null; // not found

            var updated = new Company
            {
                Id = reader.GetString(0),
                Name = reader.GetString(1),
                Settings = new CompanySettings
                {
                    AllowUserUploads = reader.GetBoolean(2),
                    AllowUserTagCreation = reader.GetBoolean(3),
                    RequireClientComments = reader.GetBoolean(4)
                }
            };

            return updated;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "CompaniesService.UpdateAsync(string:request:token) failed for companyCode={CompanyCode}", companyCode);
            throw;
        }
    }

    /// <summary>
    /// Validates that companyCode is not null or empty.
    /// </summary>
    /// <param name="companyCode"></param>
    /// <exception cref="ArgumentException"></exception>
    private static void ValidateCompany(string companyCode)
    {
        if (string.IsNullOrWhiteSpace(companyCode))
            throw new ArgumentException("company id (companyCode) is required.", nameof(companyCode));
    }
}