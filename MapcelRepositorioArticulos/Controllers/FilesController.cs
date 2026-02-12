using MapcelRepositorioArticulos.DataService;
using Microsoft.AspNetCore.Mvc;
using MapcelRepositorioArticulos.Repository;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController(IArticleRepository repo) : ControllerBase
{
    [HttpGet] 
    public ActionResult GetFiles([FromQuery] FileQuery query) => 
        Ok(repo.GetFiles(query));

    [HttpGet("images")] // Specific filter for images
    public ActionResult GetImages([FromQuery] FileQuery query) => 
        Ok(repo.GetImages(query));
    [HttpGet("images/{id}")]
    public ActionResult GetImageById(string id, [FromQuery] FileQuery query) =>
        repo.GetImageById(id) is { } file ? Ok(file) : NotFound();

    [HttpGet("{id}")]
    public ActionResult GetFileById(string id) => 
        repo.GetFileById(id) is { } file ? Ok(file) : NotFound();
}