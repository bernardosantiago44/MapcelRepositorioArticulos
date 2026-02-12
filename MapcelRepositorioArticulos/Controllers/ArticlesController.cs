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
    private readonly IArticleRepository _articleRepository = repository;
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
    public async Task<ActionResult<ArticleDetailsDto>> GetById(int id, [FromQuery] string companyId, CancellationToken cancellationToken = default)
    {
        if (companyId.IsNullOrEmpty()) return BadRequest("Company Id is required.");
        var query = new ArticleQuery
        {
            CompanyId = companyId,
            ArticleId = id,
            Page = 1,
            PageSize = 20
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
}