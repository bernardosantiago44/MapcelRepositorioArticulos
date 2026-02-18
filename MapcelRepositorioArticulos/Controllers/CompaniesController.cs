using MapcelRepositorioArticulos.DataService;
using Microsoft.AspNetCore.Mvc;
using MapcelRepositorioArticulos.Models;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/companies")]
public class CompanyController(ICompaniesService companiesService) : ControllerBase
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
}