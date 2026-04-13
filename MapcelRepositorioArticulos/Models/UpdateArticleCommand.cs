using Microsoft.AspNetCore.Http;

namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// Internal command for the article aggregate update flow.
/// Scalar fields represent the final state of the article.
/// TagIds represents the full final tag set.
/// ExistingFileIdsToAdd and ExistingFileIdsToRemove are deltas for already-persisted assets.
/// Files and Images contain newly staged uploads.
/// </summary>
public sealed class UpdateArticleCommand
{
    public required Guid ArticleId { get; init; }
    public required Guid CompanyCode { get; init; }

    public required string Title { get; init; }
    public required string DescriptionHtml { get; init; }
    public string? ExternalLink { get; init; }
    public string? ClientComments { get; init; }
    public required string Status { get; init; }

    /// <summary>
    /// Full final tag set for the article.
    /// Tags remain int-based.
    /// </summary>
    public IReadOnlyList<int> TagIds { get; init; } = [];

    /// <summary>
    /// Existing persisted asset ids newly linked to the article.
    /// Send additions only.
    /// </summary>
    public IReadOnlyList<Guid> ExistingFileIdsToAdd { get; init; } = [];

    /// <summary>
    /// Existing persisted asset ids removed from the article.
    /// Send removals only.
    /// </summary>
    public IReadOnlyList<Guid> ExistingFileIdsToRemove { get; init; } = [];

    /// <summary>
    /// Newly staged non-image uploads.
    /// </summary>
    public IReadOnlyList<CreateArticleUploadCommand> Files { get; init; } = [];

    /// <summary>
    /// Newly staged image uploads.
    /// </summary>
    public IReadOnlyList<CreateArticleUploadCommand> Images { get; init; } = [];

    public void Validate()
    {
        if (ArticleId == Guid.Empty)
            throw new ArgumentException("ArticleId is required.", nameof(ArticleId));

        if (CompanyCode == Guid.Empty)
            throw new ArgumentException("CompanyCode is required.", nameof(CompanyCode));

        ArgumentException.ThrowIfNullOrWhiteSpace(Title);
        ArgumentException.ThrowIfNullOrWhiteSpace(DescriptionHtml);
        ArgumentException.ThrowIfNullOrWhiteSpace(Status);

        if (Title.Trim().Length > 255)
            throw new ArgumentException("Title cannot exceed 255 characters.", nameof(Title));

        if (!string.IsNullOrWhiteSpace(ExternalLink) && ExternalLink.Trim().Length > 2000)
            throw new ArgumentException("ExternalLink cannot exceed 2000 characters.", nameof(ExternalLink));

        if (TagIds.Any(x => x <= 0))
            throw new ArgumentException("TagIds cannot contain invalid values.", nameof(TagIds));

        if (ExistingFileIdsToAdd.Any(x => x == Guid.Empty))
            throw new ArgumentException("ExistingFileIdsToAdd cannot contain empty GUID values.", nameof(ExistingFileIdsToAdd));

        if (ExistingFileIdsToRemove.Any(x => x == Guid.Empty))
            throw new ArgumentException("ExistingFileIdsToRemove cannot contain empty GUID values.", nameof(ExistingFileIdsToRemove));

        var duplicateAdded = ExistingFileIdsToAdd
            .GroupBy(x => x)
            .Any(g => g.Count() > 1);

        if (duplicateAdded)
            throw new ArgumentException("ExistingFileIdsToAdd contains duplicate values.", nameof(ExistingFileIdsToAdd));

        var duplicateRemoved = ExistingFileIdsToRemove
            .GroupBy(x => x)
            .Any(g => g.Count() > 1);

        if (duplicateRemoved)
            throw new ArgumentException("ExistingFileIdsToRemove contains duplicate values.", nameof(ExistingFileIdsToRemove));

        var conflictingIds = ExistingFileIdsToAdd.Intersect(ExistingFileIdsToRemove).Any();
        if (conflictingIds)
            throw new ArgumentException(
                "The same file id cannot appear in both ExistingFileIdsToAdd and ExistingFileIdsToRemove.");

        foreach (var file in Files)
            file.Validate();

        foreach (var image in Images)
            image.Validate();
    }
}