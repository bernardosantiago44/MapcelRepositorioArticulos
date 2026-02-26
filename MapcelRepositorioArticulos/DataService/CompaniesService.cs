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
    /// <summary>
    /// LEFT JOIN from the master enterprise table to the local config table.
    /// Any local config fields that are NULL (no local record) default to false.
    /// </summary>
    private const string SqlSelectAllCompanies = @"
        SELECT
            m.ENTERPRISE_ID   AS company_code,
            m.ENTERPRISE_NAME AS name,
            ISNULL(c.allow_user_uploads, 0)        AS allow_user_uploads,
            ISNULL(c.allow_user_tag_creation, 0)    AS allow_user_tag_creation,
            ISNULL(c.require_client_comments, 0)    AS require_client_comments
        FROM [MapaLocalizadorVisor].[dbo].[MNG_ENTERPRISES] m
        LEFT JOIN [RepositorioArticulos].[dbo].[companies] c
            ON m.ENTERPRISE_ID = c.company_code
        ORDER BY m.ENTERPRISE_NAME;
    ";

    /// <summary>
    /// Retrieves a single company by code from the local config table.
    /// </summary>
    private const string SqlSelectCompanyByCode = @"
        SELECT
            company_code,
            name,
            allow_user_uploads,
            allow_user_tag_creation,
            require_client_comments
        FROM [RepositorioArticulos].[dbo].[companies]
        WHERE company_code = @CompanyCode;
    ";

    /// <summary>
    /// Checks whether an enterprise exists in the master table and returns its name.
    /// </summary>
    private const string SqlSelectEnterpriseById = @"
        SELECT ENTERPRISE_ID, ENTERPRISE_NAME
        FROM [MapaLocalizadorVisor].[dbo].[MNG_ENTERPRISES]
        WHERE ENTERPRISE_ID = @EnterpriseId;
    ";

    /// <summary>
    /// Inserts a new local config record for an enterprise that has been activated.
    /// Returns the inserted row via OUTPUT.
    /// </summary>
    private const string SqlInsertCompany = @"
        INSERT INTO [RepositorioArticulos].[dbo].[companies]
            (company_code, name, allow_user_uploads, allow_user_tag_creation, require_client_comments)
        OUTPUT
            INSERTED.company_code,
            INSERTED.name,
            INSERTED.allow_user_uploads,
            INSERTED.allow_user_tag_creation,
            INSERTED.require_client_comments
        VALUES
            (@CompanyCode, @Name, 0, 0, 0);
    ";
    private const string SqlUpdateCompanyReturn = @"
        UPDATE [RepositorioArticulos].[dbo].[companies]
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
                
                companies.Add(ReadCompany(reader));
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
            {
                await using var selectCmd = new SqlCommand(SqlSelectCompanyByCode, connection);
                selectCmd.CommandType = CommandType.Text;
                selectCmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 20) { Value = companyCode });

                await using var reader = await selectCmd.ExecuteReaderAsync(cancellationToken);
                if (await reader.ReadAsync(cancellationToken))
                {
                    return ReadCompany(reader);
                }
            }
            
            string enterpriseName;
            {
                await using var masterCmd = new SqlCommand(SqlSelectEnterpriseById, connection);
                masterCmd.CommandType = CommandType.Text;
                masterCmd.Parameters.Add(new SqlParameter("@EnterpriseId", SqlDbType.VarChar, 20) { Value = companyCode });

                await using var masterReader = await masterCmd.ExecuteReaderAsync(cancellationToken);
                if (!await masterReader.ReadAsync(cancellationToken))
                {
                    // Enterprise does not exist in the master table.
                    return null;
                }

                enterpriseName = masterReader.GetString(1);
            }
            
            {
                await using var insertCmd = new SqlCommand(SqlInsertCompany, connection);
                insertCmd.CommandType = CommandType.Text;
                insertCmd.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.VarChar, 20) { Value = companyCode });
                insertCmd.Parameters.Add(new SqlParameter("@Name", SqlDbType.NVarChar, 150) { Value = enterpriseName });

                await using var insertReader = await insertCmd.ExecuteReaderAsync(cancellationToken);
                if (!await insertReader.ReadAsync(cancellationToken))
                {
                    return null;
                }

                return ReadCompany(insertReader);
            }
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

            return ReadCompany(reader);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "CompaniesService.UpdateAsync(string:request:token) failed for companyCode={CompanyCode}", companyCode);
            throw;
        }
    }
    /// <summary>
    /// Maps a reader row (company_code, name, allow_user_uploads, allow_user_tag_creation,
    /// require_client_comments) to a <see cref="Company"/> instance.
    /// </summary>
    private static Company ReadCompany(SqlDataReader reader) => new()
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