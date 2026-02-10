using MapcelRepositorioArticulos.Models;
using MapcelRepositorioArticulos.Repository;
using Microsoft.AspNetCore.Mvc;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/tags")]
public sealed class TagsController : ControllerBase
{
    private readonly IArticleRepository _repo;
    public TagsController(IArticleRepository repo) => _repo = repo;

    [HttpGet]
    public ActionResult<IReadOnlyList<TagDto>> Get([FromQuery] string companyId)
    {
        var tags = _repo.GetTagsByCompany(companyId);
        return Ok(tags);
    }
    
    [HttpGet("{id}")]
    public ActionResult<TagDto> GetById(string id)
    {
        var tag = _repo.GetTagById(id);
        if (tag is null) return NotFound();
        return Ok(tag);
    }

}
