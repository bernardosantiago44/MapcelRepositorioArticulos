using MapcelRepositorioArticulos.DataService;
using Microsoft.AspNetCore.Mvc;
using MapcelRepositorioArticulos.Models;
using Serilog;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/companies")]
public class CompanyController(ICompaniesService companiesService, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Company>>> GetAll(CancellationToken cancellationToken)
    {
        try
        {
            var companies = await companiesService.GetAllAsync(cancellationToken);
            return Ok(companies);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "CompanyController.GetAll failed");
            return StatusCode(500);
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<Company>> GetById(
        [FromRoute] string id,
        CancellationToken cancellationToken)
    {
        try
        {
            var company = await companiesService.GetByIdAsync(id, cancellationToken);
            if (company is null) return NotFound();
            return Ok(company);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "CompanyController.GetById failed for id={Id}", id);
            return StatusCode(500);
        }
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<ActionResult<Company>> Update(
        [FromRoute] string id,
        [FromBody] UpdateCompanyRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await companiesService.UpdateAsync(id, request, cancellationToken);
            if (updated is null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "CompanyController.Update failed for id={Id}", id);
            return StatusCode(500);
        }
    }

    /// <summary>
    /// Retrieves a company by decrypting the encrypted metadata blob supplied in the
    /// <c>data</c> query parameter.  Returns <c>403 Forbidden</c> on any decryption
    /// failure or when the decoded company code does not exist, to prevent metadata probing.
    /// </summary>
    [HttpGet("secure")]
    public async Task<ActionResult<Company>> GetByMetadata(
        [FromQuery] string data,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(data))
            return StatusCode(403);

        try
        {
            var key = configuration["Crypto:MetadataKey"];
            if (string.IsNullOrWhiteSpace(key))
            {
                Log.Error("CompanyController.GetByMetadata: Crypto:MetadataKey is not configured");
                return StatusCode(500);
            }

            var decrypted = SymmetricCipher.Decrypt(data, key);
            var metadata = JsonSerializer.Deserialize<UserMetadata>(decrypted);

            if (metadata is null || string.IsNullOrWhiteSpace(metadata.CompanyCode))
                return StatusCode(403);

            var company = await companiesService.GetByIdAsync(metadata.CompanyCode, cancellationToken);
            if (company is null) return StatusCode(403);

            return Ok(company);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "CompanyController.GetByMetadata: decryption or lookup failed");
            return StatusCode(403);
        }
    }
}