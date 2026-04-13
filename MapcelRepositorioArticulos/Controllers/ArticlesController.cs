using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
[Route("/api/articles/{companyCode:guid}")]
public class ArticlesController(IArticlesService service, IArticleAggregateService newService, IFilesService filesService, DirectoryBuilder directoryBuilder) : ControllerBase
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
            var result = await service.GetAsync(query, cancellationToken);
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
        catch (OperationCanceledException)
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
            var result = await service.GetAsync(query, cancellationToken);
            var description = await directoryBuilder.GetArticleDescriptionHtml(companyCode, id);
            if (result.Data.Count == 0) return NotFound();
            var article = result.Data[0];
            article.Description =  description;
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
    
    // [Authorize]
    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(200L * 1024 * 1024)]
    public async Task<ActionResult<ArticleCreatedDto>> Create(
        [FromRoute] Guid companyCode,
        [FromForm] CreateArticleMultipartRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (companyCode == Guid.Empty)
                return BadRequest("Company code is required.");

            request.Validate();
            
            var command = MapToCreateArticleCommand(companyCode, request);
            command.Validate();
            
            var createdArticle = await newService.CreateAggregateAsync(command, cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = createdArticle.Id, companyCode },
                createdArticle);
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

    
    // [Authorize]
    [HttpPost("bulk-tags")]
    public async Task<ActionResult<BulkUpdateTagsResponse>> BulkUpdateTags(
        [FromRoute] Guid companyCode,
        [FromBody] BulkUpdateTagsRequest? request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (request is null) return BadRequest("Request body is required.");
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

    
    // [Authorize]
    [HttpPut("{id:guid}")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(200L * 1024 * 1024)]
    public async Task<ActionResult<ArticleDetailsDto>> Update(
        [FromRoute] Guid companyCode,
        [FromRoute] Guid id,
        [FromForm] UpdateArticleMultipartRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (companyCode == Guid.Empty)
                return BadRequest("Company code is required.");

            if (id == Guid.Empty)
                return BadRequest("Article id is required.");

            request.Validate();

            var command = MapToUpdateArticleCommand(id, companyCode, request);
            command.Validate();

            var updated = await newService.UpdateAggregateAsync(command, cancellationToken);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
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

    // [Authorize]
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
    
    private static CreateArticleCommand MapToCreateArticleCommand(
        Guid companyCode,
        CreateArticleMultipartRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var filesManifest = request.GetFilesManifest();
        var imagesManifest = request.GetImagesManifest();

        var fileCommands = BuildUploadCommands(request.Files, filesManifest, "Files");
        var imageCommands = BuildUploadCommands(request.Images, imagesManifest, "Images");

        return new CreateArticleCommand
        {
            CompanyCode = companyCode,
            Title = request.Title.Trim(),
            DescriptionHtml = request.DescriptionHtml,
            ExternalLink = string.IsNullOrWhiteSpace(request.ExternalLink) ? null : request.ExternalLink.Trim(),
            ClientComments = string.IsNullOrWhiteSpace(request.ClientComments) ? null : request.ClientComments.Trim(),
            Status = request.Status.Trim(),
            TagIds = request.TagIds?
                .Where(x => x > 0)
                .Distinct()
                .ToArray()
                ?? [],
            Files = fileCommands,
            Images = imageCommands
        };
    }

    private static List<CreateArticleUploadCommand> BuildUploadCommands(
        List<IFormFile>? formFiles,
        List<StagedUploadManifestItemRequest> manifest,
        string fieldName)
    {
        var files = formFiles ?? [];

        if (files.Count != manifest.Count)
            throw new ArgumentException($"{fieldName} count does not match its manifest count.", fieldName);

        var commands = new List<CreateArticleUploadCommand>(files.Count);

        for (var i = 0; i < files.Count; i++)
        {
            var formFile = files[i];
            var manifestItem = manifest[i];

            commands.Add(new CreateArticleUploadCommand
            {
                ClientTempId = manifestItem.ClientTempId.Trim(),
                File = formFile,
                Description = string.IsNullOrWhiteSpace(manifestItem.Description)
                    ? null
                    : manifestItem.Description.Trim()
            });
        }

        return commands;
    }
    
    private static UpdateArticleCommand MapToUpdateArticleCommand(
        Guid articleId,
        Guid companyCode,
        UpdateArticleMultipartRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var filesManifest = request.GetFilesManifest();
        var imagesManifest = request.GetImagesManifest();

        var newFileUploads = BuildUploadCommands(request.Files, filesManifest, "Files");
        var newImageUploads = BuildUploadCommands(request.Images, imagesManifest, "Images");

        return new UpdateArticleCommand
        {
            ArticleId = articleId,
            CompanyCode = companyCode,
            Title = request.Title.Trim(),
            DescriptionHtml = request.DescriptionHtml,
            ExternalLink = string.IsNullOrWhiteSpace(request.ExternalLink)
                ? null
                : request.ExternalLink.Trim(),
            ClientComments = string.IsNullOrWhiteSpace(request.ClientComments)
                ? null
                : request.ClientComments.Trim(),
            Status = request.Status.Trim(),

            // Full final tag set
            TagIds = (request.TagIds ?? [])
                .Where(x => x > 0)
                .Distinct()
                .ToArray(),

            // Existing persisted assets to newly link
            ExistingFileIdsToAdd = (request.FileIds ?? [])
                .Where(x => x != Guid.Empty)
                .Distinct()
                .ToArray(),

            // Existing persisted assets to unlink
            ExistingFileIdsToRemove = (request.RemovedFiles ?? [])
                .Where(x => x != Guid.Empty)
                .Distinct()
                .ToArray(),

            // Brand-new uploads
            Files = newFileUploads,
            Images = newImageUploads
        };
    }
}