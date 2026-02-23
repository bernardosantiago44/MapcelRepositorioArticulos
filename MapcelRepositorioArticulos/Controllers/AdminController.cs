using System.Text.Json;
using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/admin")]
public sealed class AdminController(ICompaniesService companiesService, IConfiguration configuration) : ControllerBase
{
    /// <summary>
    /// Generates a server-side encrypted company context for admin users.
    /// The returned encrypted string must be sent in the <c>X-Company-Context</c> header
    /// with every subsequent API request.
    /// </summary>
    [HttpPost("select-company")]
    public async Task<IActionResult> SelectCompany(
        [FromBody] SelectCompanyRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.CompanyCode))
                return BadRequest("companyCode is required.");

            var key = configuration["Crypto:MetadataKey"];
            if (string.IsNullOrWhiteSpace(key))
            {
                Log.Error("AdminController.SelectCompany: Crypto:MetadataKey is not configured");
                return StatusCode(500);
            }

            // Verify the company actually exists.
            var company = await companiesService.GetByIdAsync(request.CompanyCode, cancellationToken);
            if (company is null)
                return NotFound("Company not found.");

            var issuedAt = DateTime.UtcNow.ToString("o");
            var checksum = CompanyContextPayload.ComputeChecksum(
                request.CompanyCode, isAdmin: true, issuedAt, key);

            var payload = new CompanyContextPayload
            {
                CompanyCode = request.CompanyCode,
                IsAdmin = true,
                IssuedAt = issuedAt,
                Checksum = checksum
            };

            var json = JsonSerializer.Serialize(payload);
            var encrypted = SymmetricCipher.Encrypt(json, key);

            return Ok(new { encryptedContext = encrypted });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "AdminController.SelectCompany failed for companyCode={CompanyCode}", request.CompanyCode);
            return StatusCode(500);
        }
    }
}
