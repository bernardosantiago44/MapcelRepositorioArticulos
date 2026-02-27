using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;
using Microsoft.AspNetCore.Authorization;

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
    
    [HttpGet("{companyCode:guid}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFiles([FromRoute] Guid companyCode, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = false;
        query.CompanyCode = companyCode;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{companyCode:guid}/images")] // Specific filter for images
    public async Task<ActionResult<PagedResult<FileDto>>> GetImages([FromRoute] Guid companyCode, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = true;
        query.CompanyCode = companyCode;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{companyCode:guid}/images/{id:int}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetImageById(int id, [FromRoute] Guid companyCode, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = true;
        query.Id = id;
        query.CompanyCode = companyCode;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{companyCode:guid}/{id:int}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFileById(int id, [FromRoute] Guid companyCode, [FromQuery] FileQuery query, CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = false;
        query.Id = id;
        query.CompanyCode = companyCode;
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
    
    [Authorize]
    [HttpPost("{companyCode:guid}")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<FileAsset>> Create(
        [FromRoute] Guid companyCode,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        try
        {
            var createdFile = await service.CreateAsync(companyCode, file, cancellationToken);

            // TODO: Add binary storage URL
            var downloadUrl = $"/api/files/{createdFile.Id}/download?companyCode={companyCode}";

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
            Log.Error(ex, "FilesController.Create failed for companyCode={CompanyCode}", companyCode);
            return StatusCode(500);
        }
    }
    
    [Authorize]
    [HttpPut("{companyCode:guid}/{id:int}")]
    public async Task<ActionResult<FileDto>> Update(
        [FromRoute] int id,
        [FromRoute] Guid companyCode,
        [FromBody] UpdateFileRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await service.UpdateAsync(id, companyCode, request, cancellationToken);
            if (updated is null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesController.Update failed for id={Id}, companyCode={CompanyCode}", id, companyCode);
            return StatusCode(500);
        }
    }
    
    [Authorize]
    [HttpDelete("{companyCode:guid}/{id:int}")]
    public async Task<IActionResult> Delete(
        [FromRoute] int id,
        [FromRoute] Guid companyCode,
        CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await service.DeleteAsync(id, companyCode, cancellationToken);
            if (!deleted) return NotFound();
            return NoContent(); // 204
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FilesController.Delete failed for id={Id}, companyCode={CompanyCode}", id, companyCode);
            return StatusCode(500);
        }
    }
    
    [HttpGet("{companyCode:guid}/{id:int}/download")]
    public async Task<IActionResult> Download(
        [FromRoute] int id,
        [FromRoute] Guid companyCode,
        CancellationToken cancellationToken)
    {
        try
        {
            var info = await service.GetDownloadInfoAsync(id, companyCode, cancellationToken);
            if (info is null) return NotFound();

            // Mock file bytes for now
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
            Log.Error(ex, "FilesController.Download failed for id={Id}, companyCode={CompanyCode}", id, companyCode);
            return StatusCode(500);
        }
    }
}