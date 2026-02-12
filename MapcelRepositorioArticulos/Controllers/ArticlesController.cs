using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using MapcelRepositorioArticulos.Repository;
using Microsoft.AspNetCore.Mvc;
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
        var result = await _articleService.GetAllAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public ActionResult<ArticleDetailsDto> GetById(string id)
    {
        var article = _articleRepository.GetArticleById(id);
        if (article is null) return NotFound();
        return Ok(article);
    }

}