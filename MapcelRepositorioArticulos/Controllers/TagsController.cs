using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/tags")]
public sealed class TagsController(ITagsService service) : ControllerBase
{
    private readonly ITagsService _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TagDto>>> Get(
        [FromQuery] string companyId,
        [FromQuery] string? searchString = null,
        CancellationToken cancellationToken = default
    )
    {
        var query = new TagsQuery { CompanyCode = companyId,  Search = searchString };
        var tags = await _service.GetTagsAsync(query, cancellationToken);
        return Ok(tags);
    }
    
    [HttpGet("{id}")]
    public ActionResult<TagDto> GetById(string id)
    {
        return Ok(new TagDto {Id = "0",Name = id, Color = "blue", Description = ""});
    }

}
