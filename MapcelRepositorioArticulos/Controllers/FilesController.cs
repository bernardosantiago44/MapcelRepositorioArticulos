using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController(IFilesService service) : ControllerBase
{
    private async Task<ActionResult<PagedResult<FileDto>>> ExecuteGetAllAsync(FileQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await service.GetAsync(query, cancellationToken);
            if (result.Data.IsNullOrEmpty()) return NotFound();
            return Ok(result);
        }
        catch (ArgumentNullException)
        {
            return BadRequest("Please provide a companyId using `/api/files?companyId=co-01`");
        }
        catch (ArgumentOutOfRangeException)
        {
            return BadRequest("Please make sure to provide a valid page number and a pageSize between 1 and 199");
        }
        catch (OperationCanceledException)
        {
            Log.Information("The operation was canceled.");
            return StatusCode(499);
        }
        catch (Exception exception)
        {
            Log.Error($"FilesController.ExecuteGetAsync(query:): ${typeof(Exception)}: ${exception.Message}");
            return StatusCode(500, exception.Message);
        }
    }
    
    [HttpGet]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFiles([FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = false;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("images")] // Specific filter for images
    public async Task<ActionResult<PagedResult<FileDto>>> GetImages([FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = true;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("images/{id}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetImageById(int id, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = true;
        query.Id = id;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFileById(int id, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = false;
        query.Id = id;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("forArticleId={articleId}")]
    public async Task<ActionResult<IReadOnlyList<FileDto>>> GetForArticleId(int articleId, CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await service.GetByArticleIdAsync(articleId, cancellationToken);
            if (result.IsNullOrEmpty()) return NotFound();
            return Ok(result);
        }
        catch (ArgumentOutOfRangeException)
        {
            return BadRequest("Please provide a positive integer `articleId` using `/api/files/forArticleId={articleId}`");
        }
        catch (OperationCanceledException)
        {
            Log.Information("The operation was canceled.");
            return StatusCode(499);
        }
        catch (Exception exception)
        {
            Log.Error($"FilesController.ExecuteGetAsync(query:): ${typeof(Exception)}: ${exception.Message}");
            return StatusCode(500, exception.Message);
        }
    }

    [HttpGet("ids={filesIds}")]
    public async Task<ActionResult<IReadOnlyList<FileDto>>> GetFilesByIds(int[] filesIds,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await service.GetByIdsAsync(filesIds, cancellationToken);
            if (result.IsNullOrEmpty()) return NotFound();
            return Ok(result);
        }
        catch (ArgumentOutOfRangeException)
        {
            return BadRequest("Please provide a positive integer `articleId` using `/api/files/forArticleId={articleId}`");
        }
        catch (OperationCanceledException)
        {
            Log.Information("The operation was canceled.");
            return StatusCode(499);
        }
        catch (Exception exception)
        {
            Log.Error($"FilesController.ExecuteGetAsync(query:): ${typeof(Exception)}: ${exception.Message}");
            return StatusCode(500, exception.Message);
        }
    }
}