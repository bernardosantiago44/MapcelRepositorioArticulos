using Microsoft.AspNetCore.Mvc;
using MapcelRepositorioArticulos.Models;
using MapcelRepositorioArticulos.Repository;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/companies")]
public class CompaniesController : ControllerBase
{
    private readonly IArticleRepository _repo;
    public CompaniesController(IArticleRepository repo) => _repo = repo;

    [HttpGet]
    public ActionResult<IEnumerable<Company>> GetAllCompanies()
    {
        var result = _repo.GetCompanies();
        return Ok(result);
    }
    
    [HttpGet("{id}")]
    public ActionResult<Company> GetById(string id)
    {
        var result = _repo.GetCompanyById(id);
        if  (result is null) return NotFound();
        return Ok(result);
    }
}