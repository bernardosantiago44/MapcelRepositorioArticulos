using MapcelRepositorioArticulos.DataService;
using Microsoft.AspNetCore.Mvc;
using MapcelRepositorioArticulos.Models;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/companies")]
public class CompanyController(ICompaniesService companiesService) : ControllerBase
{
    private CompanyContext GetCompanyContext()
        => (CompanyContext)HttpContext.Items[CompanyContext.HttpContextKey]!;

    /// <summary>
    /// Returns <c>true</c> if the caller is an admin per the decrypted context.
    /// </summary>
    private bool IsAdmin(out CompanyContext ctx)
    {
        ctx = GetCompanyContext();
        return ctx.IsAdmin;
    }

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
        if (!IsAdmin(out _))
            return Unauthorized("Admin access required.");

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

    
    [HttpPut("{id}")]
    public async Task<ActionResult<Company>> Update(
        [FromRoute] string id,
        [FromBody] UpdateCompanyRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsAdmin(out _))
            return Unauthorized("Admin access required.");

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
}