using MapcelRepositorioArticulos.Models;
using MapcelRepositorioArticulos.Repository;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("/api/articles")]
public class ArticlesController(IArticleRepository repository) : ControllerBase
{
    private readonly IArticleRepository _articleRepository = repository;

    [HttpGet]
    public ActionResult<PagedResult<ArticleRowDto>> GetAll(
        [FromQuery] string companyId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = _articleRepository.GetArticles(new ArticleQuery(companyId, null, null, null, null, null, page, pageSize));
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