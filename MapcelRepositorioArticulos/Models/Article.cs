

using System.Diagnostics.CodeAnalysis;

namespace MapcelRepositorioArticulos.Models;

public class Article(
    Guid id,
    Guid companyCode,
    string title,
    string description,
    string externalLink,
    string clientComments,
    string status,
    IReadOnlyList<string> tags,
    DateOnly createdAt,
    DateOnly updatedAt)
{
    public Guid Id { get; set; } = id;
    public Guid CompanyCode { get; set; } = companyCode;
    public string Title { get; set; } = title;
    public string Description { get; set; } = description;
    public string ExternalLink { get; set; } = externalLink;
    public string? ClientComments { get; set; } = clientComments;
    public string Status { get; set; } = status;
    public IReadOnlyList<string> Tags { get; set; } = tags;
    public DateOnly CreatedAt { get; set; } = createdAt;
    public DateOnly UpdatedAt { get; set; } = updatedAt;
}

/// <summary>
/// Represents a low-information Article Row object.
/// Intended to be used for building the Article Grid.
/// </summary>
public class ArticleRowDto
{
    public required string Id { get; init; }
    public required Guid CompanyCode { get; init; }
    public required string Title { get; init; }
    public required string Description { get; init; }
    public required string Status { get; init; }
    public required IReadOnlyList<string> Tags { get; init; }
    public required DateOnly CreatedAt { get; init; }
    public required DateOnly UpdatedAt { get; init; }
}

/// <summary>
/// Object used for creating a new article in the database.
/// </summary>
public class CreateArticleRequest
{
    public required string Title { get; init; }
    public required string? Description { get; init; }
    public required string? ExternalLink { get; init; }
    public required string? ClientComments { get; init; }
    public required string Status { get; init; }
    public required string[]? TagIds  { get; init; }
    public required int[]? FileIds { get; init; }


    /// <summary>
    /// Throws if Title or Status are (any) null or empty.
    /// </summary>
    /// <exception cref="ArgumentException"></exception>
    public void Validate()
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(Title);
        ArgumentException.ThrowIfNullOrWhiteSpace(Status);
    }
}

public class UpdateArticleRequest : CreateArticleRequest
{
}

public sealed class ArticleDetailsDto
{
    public required Guid Id { get; init; }
    public required Guid CompanyCode { get; init; }
    public required string CompanyName { get; init; }
    public required string Title { get; init; }
    public string? Description { get; init; }
    public string? ExternalLink { get; init; }
    public string? ClientComments { get; init; }
    public required string Status { get; init; }

    public IReadOnlyList<string> Tags { get; init; }
    public IReadOnlyList<string> TagNames { get; init; }
    public IReadOnlyList<string> FileIds { get; init; }

    public required DateOnly CreatedAt { get; init; }
    public required DateOnly UpdatedAt { get; init; }

    public ArticleDetailsDto()
    {
    }

    [SetsRequiredMembers]
    public ArticleDetailsDto(Article article, string companyName, List<string> tagNames, IReadOnlyList<string> fileIds)
    {
        Id = article.Id;
        CompanyCode = article.CompanyCode;
        CompanyName = companyName;
        Title = article.Title;
        Description = article.Description;
        ExternalLink = article.ExternalLink;
        ClientComments = article.ClientComments;
        Status = article.Status;
        Tags = article.Tags;
        TagNames = tagNames;
        FileIds = fileIds;
        CreatedAt = article.CreatedAt;
        UpdatedAt = article.UpdatedAt;
    }
}

public record BulkUpdateTagsRequest(
    int[] ArticleIds,
    int TagId,
    string Action // "add" | "remove"
);

public sealed record BulkUpdateTagsResponse(
    string Status,
    int UpdatedCount
);

