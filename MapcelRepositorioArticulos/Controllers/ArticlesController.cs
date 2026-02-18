using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using MapcelRepositorioArticulos.Repository;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("/api/articles")]
public class ArticlesController(IArticleRepository repository, IArticlesService service) : ControllerBase
{
    private readonly IArticlesService _articleService = service;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ArticleRowDto>>> GetAll(
        [FromQuery] string companyId,
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
            CompanyId = companyId,
            Search = searchString,
            Status = status,
            DateFrom = dateFrom,
            DateTo = dateTo,
            TagIds = tags,
            Page = page,
            PageSize = pageSize
        };
        var result = await _articleService.GetAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ArticleDetailsDto>> GetById(
        int id, 
        [FromQuery] string companyId,
        [FromQuery] string? searchString = null,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string[]? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (companyId.IsNullOrEmpty()) return BadRequest("Company Id is required.");
        var query = new ArticleQuery
        {
            ArticleId = id,
            CompanyId = companyId,
            Search = searchString,
            Status = status,
            DateFrom = dateFrom,
            DateTo = dateTo,
            TagIds = tags,
            Page = page,
            PageSize = pageSize
        };
        var result = await _articleService.GetAsync(query, cancellationToken);
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
        [FromQuery] string companyId,
        [FromBody] CreateArticleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var createdArticle = await _articleService.CreateAsync(companyId, request, cancellationToken);
            
            return CreatedAtAction(nameof(GetById), new { id = createdArticle.Id, companyId }, createdArticle);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Create failed for companyId={CompanyId}", companyId);
            return StatusCode(500);
        }
    }
    
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ArticleDetailsDto>> Update(
        [FromRoute] int id,
        [FromQuery] string companyId,
        [FromBody] UpdateArticleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _articleService.UpdateAsync(id, companyId, request, cancellationToken);
            if (updated is null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Update failed for id={Id}, companyId={CompanyId}", id, companyId);
            return StatusCode(500);
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(
        [FromRoute] int id,
        [FromQuery] string companyId,
        CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await _articleService.DeleteAsync(id, companyId, cancellationToken);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Delete failed for id={Id}, companyId={CompanyId}", id, companyId);
            return StatusCode(500);
        }
    }
}