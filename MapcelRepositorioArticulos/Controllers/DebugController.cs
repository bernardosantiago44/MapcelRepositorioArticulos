using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("debug/db")]
public class DebugController : ControllerBase
{
    private readonly IConfiguration _config;

    public DebugController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> Test()
    {
        var cs = _config.GetConnectionString("DefaultConnection");

        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync();

        await using var cmd = new SqlCommand("SELECT GETDATE()", conn);
        var result = await cmd.ExecuteScalarAsync();

        return Ok(new { serverTime = result });
    }
}