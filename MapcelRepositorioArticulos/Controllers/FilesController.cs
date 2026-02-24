using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController(IFilesService service) : ControllerBase
{
    private CompanyContext GetCompanyContext()
        => (CompanyContext)HttpContext.Items[CompanyContext.HttpContextKey]!;

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
            return BadRequest("Company context is required.");
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
            Log.Error(exception, "FilesController.ExecuteGetAllAsync failed");
            return StatusCode(500, exception.Message);
        }
    }
    
    [HttpGet]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFiles([FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        var ctx = GetCompanyContext();
        query.CompanyId = ctx.CompanyCode;
        query.ImagesOnly = false;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("images")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetImages([FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        var ctx = GetCompanyContext();
        query.CompanyId = ctx.CompanyCode;
        query.ImagesOnly = true;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("images/{id:int}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetImageById(int id, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        var ctx = GetCompanyContext();
        query.CompanyId = ctx.CompanyCode;
        query.ImagesOnly = true;
        query.Id = id;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFileById(int id, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        var ctx = GetCompanyContext();
        query.CompanyId = ctx.CompanyCode;
        query.ImagesOnly = false;
        query.Id = id;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("forArticleId={articleId:int}")]
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
            Log.Error(exception, "FilesController.GetForArticleId failed for articleId={ArticleId}", articleId);
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
            Log.Error(exception, "FilesController.GetFilesByIds failed");
            return StatusCode(500, exception.Message);
        }
    }
    
    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<FileAsset>> Create(
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        try
        {
            var ctx = GetCompanyContext();
            var createdFile = await service.CreateAsync(ctx.CompanyCode, file, cancellationToken);

            var downloadUrl = $"/api/files/{createdFile.Id}/download";

            return Ok(new
            {
                file = createdFile,
                downloadUrl
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesController.Create failed");
            return StatusCode(500);
        }
    }
    
    [HttpPut("{id:int}")]
    public async Task<ActionResult<FileDto>> Update(
        [FromRoute] int id,
        [FromBody] UpdateFileRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var ctx = GetCompanyContext();
            var updated = await service.UpdateAsync(id, ctx.CompanyCode, request, cancellationToken);
            if (updated is null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesController.Update failed for id={Id}", id);
            return StatusCode(500);
        }
    }
    
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        try
        {
            var ctx = GetCompanyContext();
            var deleted = await service.DeleteAsync(id, ctx.CompanyCode, cancellationToken);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesController.Delete failed for id={Id}", id);
            return StatusCode(500);
        }
    }
    
    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        try
        {
            var ctx = GetCompanyContext();
            var info = await service.GetDownloadInfoAsync(id, ctx.CompanyCode, cancellationToken);
            if (info is null) return NotFound();

            var filename = $"{info.Value.Name}{info.Value.Extension}";
            var bytes = Encoding.UTF8.GetBytes($"Mock download payload for fileId={id}.");

            return File(bytes, "application/octet-stream", filename);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesController.Download failed for id={Id}", id);
            return StatusCode(500);
        }
    }
}