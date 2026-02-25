using System.Text.Json;
using MapcelRepositorioArticulos.DataService;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/user")]
public class UserController(ICompaniesService companiesService, IConfiguration configuration) : ControllerBase
{

}