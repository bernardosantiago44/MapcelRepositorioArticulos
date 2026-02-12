using Serilog;

namespace MapcelRepositorioArticulos.DataService;

/// <summary>
/// Provides the template class for a Service that connects to the
/// Microsoft SQL Server Database.
/// Initializes the configuration and the connection string.
/// </summary>
public abstract class BaseService
{
    protected readonly IConfiguration _configuration;
    protected string _connectionString;

    protected BaseService(IConfiguration configuration)
    {
        _configuration = configuration;
        _connectionString = string.Empty;
        try
        {
            SetupConnectionString("DefaultConnection");
        }
        catch (Exception error)
        {
            Log.Fatal($"DataService.BaseService:25 - ${error.Message}");
        }
    }
    
    private void SetupConnectionString(string connectionName)
    {
        var connection = _configuration.GetConnectionString(connectionName);
        if (string.IsNullOrEmpty(connection))
        {
            throw new Exception($"Connection {connectionName} could not be found in appsettings.json.");
        }
        _connectionString = connection!;
    }
}