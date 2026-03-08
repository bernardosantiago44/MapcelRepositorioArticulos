using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.Authorization;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController(IFilesService service, IWebHostEnvironment env) : ControllerBase
{
    private readonly FileExtensionContentTypeProvider _contentTypeProvider = new();

    private async Task<ActionResult<PagedResult<FileDto>>> ExecuteGetAllAsync(
        FileQuery query,
        CancellationToken cancellationToken = default)
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
            Log.Error(exception, "FilesController.ExecuteGetAllAsync failed");
            return StatusCode(500, exception.Message);
        }
    }

    [HttpGet("{companyCode:guid}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFiles(
        [FromRoute] Guid companyCode,
        [FromQuery] FileQuery query,
        CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = false;
        query.CompanyCode = companyCode;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{companyCode:guid}/images")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetImages(
        [FromRoute] Guid companyCode,
        [FromQuery] FileQuery query,
        CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = true;
        query.CompanyCode = companyCode;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{companyCode:guid}/images/{id:int}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetImageById(
        [FromRoute] int id,
        [FromRoute] Guid companyCode,
        [FromQuery] FileQuery query,
        CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = true;
        query.Id = id;
        query.CompanyCode = companyCode;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("{companyCode:guid}/{id:int}")]
    public async Task<ActionResult<PagedResult<FileDto>>> GetFileById(
        [FromRoute] int id,
        [FromRoute] Guid companyCode,
        [FromQuery] FileQuery query,
        CancellationToken cancellationToken = default)
    {
        query.ImagesOnly = false;
        query.Id = id;
        query.CompanyCode = companyCode;
        return await ExecuteGetAllAsync(query, cancellationToken);
    }

    [HttpGet("forArticleId={articleId:int}")]
    public async Task<ActionResult<IReadOnlyList<FileDto>>> GetForArticleId(
        [FromRoute] int articleId,
        CancellationToken cancellationToken = default)
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
            Log.Error(exception, "FilesController.GetForArticleId failed");
            return StatusCode(500, exception.Message);
        }
    }

    [HttpGet("ids={filesIds}")]
    public async Task<ActionResult<IReadOnlyList<FileDto>>> GetFilesByIds(
        [FromRoute] int[] filesIds,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await service.GetByIdsAsync(filesIds, cancellationToken);
            if (result.IsNullOrEmpty()) return NotFound();
            return Ok(result);
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

    [Authorize]
    [HttpPost("{companyCode:guid}")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(50L * 1024 * 1024)]
    public async Task<ActionResult<object>> Create(
        [FromRoute] Guid companyCode,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        try
        {
            var createdFile = await service.CreateAsync(companyCode, file, cancellationToken);
            
            var downloadUrl = Url.Action(
                action: nameof(Download),
                controller: "Files",
                values: new { companyCode, id = int.Parse(createdFile.Id) }
            );

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
            return NoContent();
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

            var filename = $"{info.Value.Name}{info.Value.Extension}";

            // Resolve disk path consistent with FilesService:
            // ../Archivos/<companyUuid>/<fileId><ext>
            var extension = string.IsNullOrWhiteSpace(info.Value.Extension) ? "" : info.Value.Extension;
            if (!string.IsNullOrWhiteSpace(extension) && !extension.StartsWith('.'))
                extension = "." + extension;

            var physicalPath = BuildPhysicalFilePath(companyCode, id, extension);

            if (!System.IO.File.Exists(physicalPath))
                return NotFound("File bytes not found on disk.");

            // Content-Type (best-effort)
            if (!_contentTypeProvider.TryGetContentType(filename, out var contentType))
                contentType = "application/octet-stream";

            var stream = new FileStream(
                physicalPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 1024 * 1024,
                useAsync: true);

            return File(stream, contentType, filename);
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

    // Keep controller in sync with FilesService path logic.
    private string BuildPhysicalFilePath(Guid companyCode, int fileId, string extension)
    {
        var archivosRoot = GetArchivosRootPath();
        var companyDir = Path.Combine(archivosRoot, companyCode.ToString("D"));
        Directory.CreateDirectory(companyDir);

        // extension already normalized by caller
        return Path.Combine(companyDir, $"{fileId}{extension}");
    }

    private string GetArchivosRootPath()
    {
        // Optional override from config is better; if you want it here too,
        // add IConfiguration injection and read "Files:ArchivosRootPath".
        var contentRoot = env.ContentRootPath;
        var dir = new DirectoryInfo(contentRoot);

        while (dir != null && !dir.Name.Equals("Produccion", StringComparison.OrdinalIgnoreCase))
            dir = dir.Parent;

        var repoRoot =
            dir?.Parent?.FullName
            ?? Directory.GetParent(contentRoot)?.FullName
            ?? contentRoot;

        return Path.Combine(repoRoot, "Archivos");
    }
}