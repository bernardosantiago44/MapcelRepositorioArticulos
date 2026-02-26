using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/tags")]
public sealed class TagsController(ITagsService tagsService) : ControllerBase
{

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Tag>>> GetAll(
        [FromQuery] string companyCode,
        [FromQuery] string? searchString = null,
        CancellationToken cancellationToken = default
    )
    {
        var query = new TagsQuery { CompanyCode = companyCode,  Search = searchString };
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
            Log.Error(ex, "TagsController.GetAll failed for companyCode={CompanyCode}", companyCode);
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

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<Tag>> Create([FromQuery] string companyCode, [FromBody] CreateTagRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var created = await tagsService.CreateAsync(companyCode, request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "TagsController.Create failed for companyCode={CompanyCode}", companyCode);
            return StatusCode(500);
        }
    }

    [Authorize]
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

    [Authorize]
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
