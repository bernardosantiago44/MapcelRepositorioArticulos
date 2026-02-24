using Serilog;

namespace MapcelRepositorioArticulos.DataService;

/// <summary>
/// Provides the template class for a Service that connects to the
/// Microsoft SQL Server Database.
/// Initializes the configuration and the connection string.
/// </summary>
public abstract class BaseService
{
    private readonly IConfiguration _configuration;
    protected string ConnectionString;

    protected BaseService(IConfiguration configuration)
    {
        _configuration = configuration;
        ConnectionString = string.Empty;
        try
        {
            SetupConnectionString("DefaultConnection");
        }
        catch (Exception error)
        {
            Log.Fatal(error, "BaseService: failed to load connection string '{ConnectionName}'", "DefaultConnection");
        }
    }
    
    private void SetupConnectionString(string connectionName)
    {
        var connection = _configuration.GetConnectionString(connectionName);
        if (string.IsNullOrEmpty(connection))
        {
            throw new Exception($"Connection {connectionName} could not be found in appsettings.json.");
        }
        ConnectionString = connection!;
    }
}