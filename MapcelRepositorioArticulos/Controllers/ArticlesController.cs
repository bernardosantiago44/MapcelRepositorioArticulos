using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("/api/articles/{companyCode:guid}")]
public class ArticlesController(IArticlesService service, IntegratedArticleService newService, IFilesService filesService, DirectoryBuilder directoryBuilder) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ArticleDetailsDto>>> GetAll(
        [FromRoute] Guid companyCode,
        [FromQuery] string? searchString = null,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string[]? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new ArticleQuery
        {
            CompanyCode = companyCode,
            Search = searchString,
            Status = status,
            DateFrom = dateFrom,
            DateTo = dateTo,
            TagIds = tags,
            Page = page,
            PageSize = pageSize
        };

        try
        {
            var result = await newService.GetAsync(query, cancellationToken);
            Log.Information("{count} articles found", result.Data.Count);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (SqlException ex)
        {
            Log.Error(ex, "ArticlesController.GetAll failed for companyCode={CompanyCode}: {message}", 
                companyCode, ex.Message);
            return StatusCode(500, "Unexpected SQL error occurred.");
        }
        catch (InvalidCastException ex)
        {
            Log.Error(ex, "ArticlesController.GetAll failed for companyCode={CompanyCode}: {message}", 
                companyCode, ex.Message);
        }
        catch (OperationCanceledException ex)
        {
            // Not really an error, can safely ignore
            return StatusCode(200);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.GetAll failed for companyCode={CompanyCode}: {message}", 
                companyCode,  ex.Message);
            return StatusCode(500, "Unexpected exception occurred.");
        }
        return StatusCode(200);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ArticleDetailsDto>> GetById(
        [FromRoute] Guid id, 
        [FromRoute] Guid companyCode,
        [FromQuery] string? searchString = null,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string[]? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (companyCode == Guid.Empty) return BadRequest("Company code is required.");
        var query = new ArticleQuery
        {
            ArticleId = id,
            CompanyCode = companyCode,
            Search = searchString,
            Status = status,
            DateFrom = dateFrom,
            DateTo = dateTo,
            TagIds = tags,
            Page = page,
            PageSize = pageSize
        };
        try
        {
            var result = await newService.GetAsync(query, cancellationToken);
            if (result.Data.Count == 0) return NotFound();
            var article = result.Data[0];
            return Ok(article);
        }
        catch (ArgumentException ex)
        {
            Log.Error("ArticlesController.GetById failed for companyCode={CompanyCode}: {message}", companyCode, ex.Message);
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            Log.Error("ArticlesController.GetById failed for companyCode={CompanyCode}: {message}", companyCode, ex.Message);
            return NotFound();
        }
        catch (TaskCanceledException)
        {
            return NoContent();
        }
        catch (Exception e)
        {
            Log.Error("ArticlesController.GetById failed: {message}", e.Message);
            return StatusCode(500);
        }
    }
    
    [Authorize]
    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(50L * 1024 * 1024 * 10)]
    public async Task<ActionResult<ArticleDetailsDto>> Create(
        [FromRoute] Guid companyCode,
        [FromForm] CreateArticleRequest request,
        [FromForm] MultipleFilesDto? uploads,
        CancellationToken cancellationToken)
    {
        try
        {
            var createdArticle = await service.CreateAsync(companyCode, request, cancellationToken);

            if (uploads?.Files is not { Count: > 0 })
                return CreatedAtAction(nameof(GetById), new { id = createdArticle.Id, companyCode }, createdArticle);
            
            var files = uploads.ToUploads().Where(file => !file.IsImage).ToList();
            var images = uploads.ToUploads().Where(file => file.IsImage).ToList();
            await directoryBuilder.SaveArticleFiles(companyCode, createdArticle.Id, files, cancellationToken);
            await directoryBuilder.SaveArticleImages(companyCode, createdArticle.Id, images, cancellationToken);
            await filesService.SaveFileMetadataAsync(companyCode, createdArticle.Id, uploads, cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = createdArticle.Id, companyCode }, createdArticle);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.Create failed for companyCode={CompanyCode}", companyCode);
            return StatusCode(500);
        }
    }
    
    [Authorize]
    [HttpPost("bulk-tags")]
    public async Task<ActionResult<BulkUpdateTagsResponse>> BulkUpdateTags(
        [FromRoute] Guid companyCode,
        [FromBody] BulkUpdateTagsRequest? request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (request is null) return BadRequest("Request body is required.");
            if (request.ArticleIds is null || request.ArticleIds.Length == 0) return BadRequest("ArticleIds is required.");
            if (request.TagId <= 0) return BadRequest("TagId must be > 0.");
            if (string.IsNullOrWhiteSpace(request.Action)) return BadRequest("Action is required.");

            var action = request.Action.Trim().ToLowerInvariant();
            if (action is not ("add" or "remove")) return BadRequest("Action must be 'add' or 'remove'.");

            var updatedCount = await service.BulkUpdateSingleTagAsync(
                companyCode,
                request.ArticleIds,
                request.TagId,
                action,
                cancellationToken);

            return Ok(new BulkUpdateTagsResponse("ok", updatedCount));
        }
        catch (KeyNotFoundException ex)
        {
            // Tag not found for this company (tenant-safe)
            return NotFound(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesController.BulkUpdateTags failed for companyCode={CompanyCode}", companyCode);
            return StatusCode(500);
        }
    }

    
    [Authorize]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ArticleDetailsDto>> Update(
        [FromRoute] Guid companyCode,
        [FromRoute] Guid id,
        [FromBody] UpdateArticleRequest request,
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
            Log.Error(ex, "ArticlesController.Update failed for id={Id}, companyCode={CompanyCode}", id, companyCode);
            return StatusCode(500);
        }
    }

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromRoute] Guid companyCode,
        CancellationToken cancellationToken)
    {
        try
        {
            directoryBuilder.DeleteArticle(companyCode, id);
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
            Log.Error(ex, "ArticlesController.Delete failed for id={Id}, companyCode={CompanyCode}", id, companyCode);
            return StatusCode(500);
        }
    }
}