using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/tags")]
public sealed class TagsController(ITagsService tagsService) : ControllerBase
{
    private CompanyContext GetCompanyContext()
        => (CompanyContext)HttpContext.Items[CompanyContext.HttpContextKey]!;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Tag>>> GetAll(
        [FromQuery] string? searchString = null,
        CancellationToken cancellationToken = default
    )
    {
        var ctx = GetCompanyContext();
        var query = new TagsQuery { CompanyCode = ctx.CompanyCode, Search = searchString };
        try
        {
            var tags = await tagsService.GetAllAsync(query, cancellationToken);
            return Ok(tags);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        } catch (Exception ex)
        {
            Log.Error(ex, "TagsController.GetAll failed for companyCode={CompanyCode}", ctx.CompanyCode);
            return StatusCode(500);
        }
    }
    
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Tag>> GetById([FromRoute] int id, CancellationToken cancellationToken = default)
    {
        try
        {
            var tag = await tagsService.GetByIdAsync(id, cancellationToken);
            if (tag is null) return NotFound();
            return Ok(tag);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsController.GetById failed for id={Id}", id);
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<ActionResult<Tag>> Create([FromBody] CreateTagRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var ctx = GetCompanyContext();
            var created = await tagsService.CreateAsync(ctx.CompanyCode, request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsController.Create failed");
            return StatusCode(500);
        }
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Tag>> Update([FromRoute] int id, [FromBody] UpdateTagRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var updated = await tagsService.UpdateAsync(id, request, cancellationToken);
            if (updated is null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsController.Update failed for id={Id}", id);
            return StatusCode(500);
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete([FromRoute] int id, CancellationToken cancellationToken = default)
    {
        try
        {
            var deleted = await tagsService.DeleteAsync(id, cancellationToken);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsController.Delete failed for id={Id}", id);
            return StatusCode(500);
        }
    }

}
