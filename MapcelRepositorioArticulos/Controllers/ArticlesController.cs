using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("/api/articles")]
public class ArticlesController(IArticlesService service) : ControllerBase
{
    private CompanyContext GetCompanyContext()
        => (CompanyContext)HttpContext.Items[CompanyContext.HttpContextKey]!;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ArticleDetailsDto>>> GetAll(
        [FromQuery] string? searchString = null,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string[]? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var ctx = GetCompanyContext();
        var query = new ArticleQuery
        {
            CompanyId = ctx.CompanyCode,
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
        [FromQuery] string? searchString = null,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string[]? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var ctx = GetCompanyContext();
        var query = new ArticleQuery
        {
            ArticleId = id,
            CompanyId = ctx.CompanyCode,
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
    
    [HttpPost]
    public async Task<ActionResult<ArticleDetailsDto>> Create(
        [FromBody] CreateArticleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var ctx = GetCompanyContext();
            var createdArticle = await service.CreateAsync(ctx.CompanyCode, request, cancellationToken);
            
            return CreatedAtAction(nameof(GetById), new { id = createdArticle.Id }, createdArticle);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Create failed");
            return StatusCode(500);
        }
    }
    
    [HttpPost("bulk-tags")]
    public async Task<ActionResult<BulkUpdateTagsResponse>> BulkUpdateTags(
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

            var ctx = GetCompanyContext();
            var updatedCount = await service.BulkUpdateSingleTagAsync(
                ctx.CompanyCode,
                request.ArticleIds,
                request.TagId,
                action,
                cancellationToken);

            return Ok(new BulkUpdateTagsResponse("ok", updatedCount));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.BulkUpdateTags failed");
            return StatusCode(500);
        }
    }

    
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ArticleDetailsDto>> Update(
        [FromRoute] int id,
        [FromBody] UpdateArticleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var ctx = GetCompanyContext();
            var updated = await service.UpdateAsync(id, ctx.CompanyCode, request, cancellationToken);
            if (updated is null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Update failed for id={Id}", id);
            return StatusCode(500);
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        try
        {
            var ctx = GetCompanyContext();
            var deleted = await service.DeleteAsync(id, ctx.CompanyCode, cancellationToken);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Delete failed for id={Id}", id);
            return StatusCode(500);
        }
    }
}