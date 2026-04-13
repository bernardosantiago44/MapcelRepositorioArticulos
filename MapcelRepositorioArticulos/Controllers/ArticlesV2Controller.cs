using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace MapcelRepositorioArticulos.Controllers;

[ApiController]
public sealed class ArticlesV2Controller(IArticleAggregateService service) : ControllerBase
{
    [Authorize]
    [HttpPost("/api/v2/articles/{companyCode:guid}")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(200L * 1024 * 1024)]
    public async Task<ActionResult<ArticleCreatedDto>> Create(
        [FromRoute] Guid companyCode,
        [FromForm] CreateArticleMultipartRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            request.Validate();

            var command = MapToCreateArticleCommand(companyCode, request);
            command.Validate();

            var created = await service.CreateAggregateAsync(command, cancellationToken);

            return CreatedAtAction(
                actionName: nameof(ArticlesController.GetById),
                controllerName: "Articles",
                routeValues: new { companyCode = created.CompanyCode, id = created.Id },
                value: created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticlesV2Controller.Create failed for companyCode={CompanyCode}", companyCode);
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

    private static IReadOnlyList<CreateArticleUploadCommand> BuildUploadCommands(
        List<IFormFile>? formFiles,
        List<StagedUploadManifestItemRequest> manifest,
        string fieldName)
    {
        ArgumentNullException.ThrowIfNull(manifest);
        var files = formFiles ?? [];
        if (files.Count != manifest.Count)
            throw new ArgumentException($"{fieldName} count does not match its manifest count.", fieldName);
        if (manifest.Count == 0) throw new ArgumentException("Value cannot be an empty collection.", nameof(manifest));

        var commands = new List<CreateArticleUploadCommand>(files.Count);

        for (var i = 0; i < files.Count; i++)
        {
            var formFile = files[i];
            var meta = manifest[i];

            commands.Add(new CreateArticleUploadCommand
            {
                ClientTempId = meta.ClientTempId.Trim(),
                File = formFile,
                Description = string.IsNullOrWhiteSpace(meta.Description) ? null : meta.Description.Trim()
            });
        }

        return commands;
    }
}