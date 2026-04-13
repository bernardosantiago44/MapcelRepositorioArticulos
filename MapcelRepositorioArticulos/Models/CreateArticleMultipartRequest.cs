using Serilog;

namespace MapcelRepositorioArticulos.Models;

using System.Text.Json;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Request used by the new staged article creation endpoint.
/// This request is intended to be bound from multipart/form-data.
/// </summary>
public class CreateArticleMultipartRequest
{
    public required string Title { get; init; }
    public required string DescriptionHtml { get; init; }
    public string? ExternalLink { get; init; }
    public string? ClientComments { get; init; }
    public required string Status { get; init; }

    /// <summary>
    /// Company tag ids selected for the article.
    /// Tags remain int-based in the current schema direction.
    /// </summary>
    public List<int>? TagIds { get; init; } = [];

    /// <summary>
    /// Non-image files uploaded together with the article.
    /// </summary>
    public List<IFormFile>? Files { get; init; } = [];

    /// <summary>
    /// Images uploaded together with the article.
    /// </summary>
    public List<IFormFile>? Images { get; init; } = [];

    /// <summary>
    /// JSON array describing the uploaded Files collection.
    /// One manifest item must exist per Files entry.
    /// </summary>
    public string? FilesManifestJson { get; init; }

    /// <summary>
    /// JSON array describing the uploaded Images collection.
    /// One manifest item must exist per Images entry.
    /// </summary>
    public string? ImagesManifestJson { get; init; }

    public virtual void Validate()
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(Title);
        ArgumentException.ThrowIfNullOrWhiteSpace(DescriptionHtml);
        ArgumentException.ThrowIfNullOrWhiteSpace(Status);

        if (Title.Trim().Length > 255)
            throw new ArgumentException("Title cannot exceed 255 characters.", nameof(Title));

        if (!string.IsNullOrWhiteSpace(ExternalLink) && ExternalLink.Trim().Length > 2000)
            throw new ArgumentException("ExternalLink cannot exceed 2000 characters.", nameof(ExternalLink));

        if (!string.IsNullOrWhiteSpace(ClientComments) && ClientComments.Trim().Length > 4000)
            throw new ArgumentException("ClientComments cannot exceed 4000 characters.", nameof(ClientComments));

        var filesManifest = GetFilesManifest();
        var imagesManifest = GetImagesManifest();

        var filesCount = Files?.Count ?? 0;
        var imagesCount = Images?.Count ?? 0;

        if (filesManifest.Count != filesCount)
            throw new ArgumentException("FilesManifestJson count must match Files count.", nameof(FilesManifestJson));

        if (imagesManifest.Count != imagesCount)
            throw new ArgumentException("ImagesManifestJson count must match Images count.", nameof(ImagesManifestJson));

        ValidateManifestUniqueness(filesManifest, nameof(FilesManifestJson));
        ValidateManifestUniqueness(imagesManifest, nameof(ImagesManifestJson));
    }

    public List<StagedUploadManifestItemRequest> GetFilesManifest()
        => ParseManifest(FilesManifestJson, nameof(FilesManifestJson));

    public List<StagedUploadManifestItemRequest> GetImagesManifest()
        => ParseManifest(ImagesManifestJson, nameof(ImagesManifestJson));

    private static List<StagedUploadManifestItemRequest> ParseManifest(string? json, string paramName)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            var parsed = JsonSerializer.Deserialize<List<StagedUploadManifestItemRequest>>(json);
            return parsed ?? [];
        }
        catch (JsonException ex)
        {
            Log.Error("{message}", ex.Message);
            throw new ArgumentException($"{paramName} is not valid JSON.", paramName, ex);
        }
    }

    private static void ValidateManifestUniqueness(
        List<StagedUploadManifestItemRequest> manifest,
        string paramName)
    {
        var duplicate = manifest
            .GroupBy(x => x.ClientTempId, StringComparer.Ordinal)
            .FirstOrDefault(g => string.IsNullOrWhiteSpace(g.Key) || g.Count() > 1);

        if (duplicate is not null)
            throw new ArgumentException($"{paramName} contains duplicate or empty ClientTempId values.", paramName);
    }
}

/// <summary>
/// Describes one staged upload sent in multipart/form-data.
/// ClientTempId is the bridge between:
/// - the JS staged item in memory
/// - the uploaded multipart file
/// - any image reference embedded in DescriptionHtml
/// </summary>
public class StagedUploadManifestItemRequest
{
    public required string ClientTempId { get; init; }
    public string? Description { get; init; }
}