using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("/api/articles/{companyCode:guid}")]
public class ArticlesController(IArticlesService service) : ControllerBase
{

    [HttpGet]
    public async Task<ActionResult<PagedResult<ArticleDetailsDto>>> GetAll(
        [FromRoute] Guid companyCode,
        [FromQuery] string? searchString = null,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string[]? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new ArticleQuery
        {
            CompanyCode = companyCode,
            Search = searchString,
            Status = status,
            DateFrom = dateFrom,
            DateTo = dateTo,
            TagIds = tags,
            Page = page,
            PageSize = pageSize
        };
        var result = await service.GetAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ArticleDetailsDto>> GetById(
        int id, 
        [FromRoute] Guid companyCode,
        [FromQuery] string? searchString = null,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string[]? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (companyCode == Guid.Empty) return BadRequest("Company code is required.");
        var query = new ArticleQuery
        {
            ArticleId = id,
            CompanyCode = companyCode,
            Search = searchString,
            Status = status,
            DateFrom = dateFrom,
            DateTo = dateTo,
            TagIds = tags,
            Page = page,
            PageSize = pageSize
        };
        var result = await service.GetAsync(query, cancellationToken);
        if (result.Data.Count == 0) return NotFound();
        try
        {
            var article = result.Data.First();
            return Ok(article);
        }
        catch (ArgumentNullException)
        {
            return NotFound();
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
        catch (TaskCanceledException)
        {
            return NoContent();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error");
            return StatusCode(500);
        }
    }
    
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<ArticleDetailsDto>> Create(
        [FromRoute] Guid companyCode,
        [FromBody] CreateArticleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var createdArticle = await service.CreateAsync(companyCode, request, cancellationToken);
            
            return CreatedAtAction(nameof(GetById), new { id = createdArticle.Id, companyCode }, createdArticle);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Create failed for companyCode={CompanyCode}", companyCode);
            return StatusCode(500);
        }
    }
    
    [Authorize]
    [HttpPost("bulk-tags")]
    public async Task<ActionResult<BulkUpdateTagsResponse>> BulkUpdateTags(
        [FromRoute] Guid companyCode,
        [FromBody] BulkUpdateTagsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (request is null) return BadRequest("Request body is required.");
            if (request.ArticleIds is null || request.ArticleIds.Length == 0) return BadRequest("ArticleIds is required.");
            if (request.TagId <= 0) return BadRequest("TagId must be > 0.");
            if (string.IsNullOrWhiteSpace(request.Action)) return BadRequest("Action is required.");

            var action = request.Action.Trim().ToLowerInvariant();
            if (action is not ("add" or "remove")) return BadRequest("Action must be 'add' or 'remove'.");

            var updatedCount = await service.BulkUpdateSingleTagAsync(
                companyCode,
                request.ArticleIds,
                request.TagId,
                action,
                cancellationToken);

            return Ok(new BulkUpdateTagsResponse("ok", updatedCount));
        }
        catch (KeyNotFoundException ex)
        {
            // Tag not found for this company (tenant-safe)
            return NotFound(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.BulkUpdateTags failed for companyCode={CompanyCode}", companyCode);
            return StatusCode(500);
        }
    }

    
    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ArticleDetailsDto>> Update(
        [FromRoute] Guid companyCode,
        [FromRoute] int id,
        [FromBody] UpdateArticleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await service.UpdateAsync(id, companyCode, request, cancellationToken);
            if (updated is null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Update failed for id={Id}, companyCode={CompanyCode}", id, companyCode);
            return StatusCode(500);
        }
    }

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(
        [FromRoute] int id,
        [FromRoute] Guid companyCode,
        CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await service.DeleteAsync(id, companyCode, cancellationToken);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Delete failed for id={Id}, companyCode={CompanyCode}", id, companyCode);
            return StatusCode(500);
        }
    }
}