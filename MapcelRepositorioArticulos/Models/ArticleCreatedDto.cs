using System.Text.Json;

namespace MapcelRepositorioArticulos.Models;

public sealed class ArticleCreatedDto
{
    public required Guid Id { get; init; }
    public required Guid CompanyCode { get; init; }
    public required string Title { get; init; }
    public required string Status { get; init; }
    public string? ExternalLink { get; init; }
    public string? ClientComments { get; init; }

    public required DateTime CreatedAtUtc { get; init; }

    public IReadOnlyList<int> TagIds { get; init; } = Array.Empty<int>();
    public IReadOnlyList<ArticleStoredAssetDto> Files { get; init; } = [];
    public IReadOnlyList<ArticleStoredAssetDto> Images { get; init; } = [];
}

public sealed class ArticleStoredAssetDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Extension { get; init; }
    public string? Description { get; init; }
    public required long SizeBytes { get; init; }
    public required bool IsImage { get; init; }

    public int? Width { get; init; }
    public int? Height { get; init; }

    /// <summary>
    /// Relative path under the article directory.
    /// Example:
    /// /{companyCode}/{articleId}/files/{fileId}.pdf
    /// /{companyCode}/{articleId}/images/{fileId}.png
    /// </summary>
    public required string RelativePath { get; init; }
}

/// <summary>
/// Multipart request used for updating an article.
/// Scalar fields represent the final article state.
/// FileIds contains only newly added existing asset ids.
/// RemovedFiles contains only existing asset ids removed from the article.
/// Files and Images contain newly staged uploads.
/// </summary>
public sealed class UpdateArticleMultipartRequest : CreateArticleMultipartRequest
{
    /// <summary>
    /// Existing asset ids newly linked to the article.
    /// Send only additions.
    /// </summary>
    public Guid[]? FileIds { get; init; } = [];
    
    /// <summary>
    /// Existing asset ids removed from the article.
    /// Send only removals.
    /// </summary>
    public Guid[]? RemovedFiles { get; init; } = [];

    public override void Validate()
    {
       base.Validate();

        ValidateGuidArray(FileIds, nameof(FileIds));
        ValidateGuidArray(RemovedFiles, nameof(RemovedFiles));
    }

    private static void ValidateGuidArray(Guid[]? values, string paramName)
    {
        if (values is null) return;

        if (values.Any(x => x == Guid.Empty))
            throw new ArgumentException($"{paramName} cannot contain empty GUID values.", paramName);
    }
}