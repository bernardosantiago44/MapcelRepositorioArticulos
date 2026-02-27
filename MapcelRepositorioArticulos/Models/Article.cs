

using System.Diagnostics.CodeAnalysis;

namespace MapcelRepositorioArticulos.Models;

public class Article
{
    public string Id { get; set; }
    public Guid CompanyCode { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string ExternalLink { get; set; }
    public string? ClientComments { get; set; }
    public string Status { get; set; }
    public IReadOnlyList<string> Tags { get; set; }
    public DateOnly CreatedAt { get; set; }
    public DateOnly UpdatedAt { get; set; }

    public Article(
        string id,
        Guid companyCode,
        string title,
        string description,
        string externalLink,
        string clientComments,
        string status,
        IReadOnlyList<string> tags,
        DateOnly createdAt,
        DateOnly updatedAt 
    )
    {
        Id = id;
        CompanyCode = companyCode;
        Title = title;
        Description = description;
        ExternalLink = externalLink;
        ClientComments = clientComments;
        Status = status;
        Tags = tags;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
    }
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
    public required string Id { get; init; }
    public required Guid CompanyCode { get; init; }
    public required string CompanyName { get; init; }
    public string Title { get; init; }
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
    public ArticleDetailsDto(Article article, string companyName, List<string> tagNames)
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

