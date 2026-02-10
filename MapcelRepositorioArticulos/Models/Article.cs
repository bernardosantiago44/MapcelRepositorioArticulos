

namespace MapcelRepositorioArticulos.Models;

public class Article
{
    public string Id { get; set; }
    public string CompanyId { get; set; }
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
        string companyId,
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
        CompanyId = companyId;
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
    public required string CompanyId { get; init; }
    public required string CompanyName { get; init; }
    public required string Title { get; init; }
    public required string Description { get; init; }
    public required string Status { get; init; }
    public required string TagIds { get; init; } 
    public required string TagNames { get; init; }
    public required DateOnly CreatedAt { get; init; }
    public required DateOnly UpdatedAt { get; init; }
}

/// <summary>
/// Object used for creating a new article in the database.
/// </summary>
public class CreateArticleDto
{
    public required string CompanyId { get; init; }
    public required string Title { get; init; }
    public required string Status { get; init; }
    public IReadOnlyList<string> TagIds { get; init; } = [];
}

public sealed class ArticleDetailsDto
{
    public required string Id { get; init; }
    public required string CompanyId { get; init; }
    public required string Title { get; init; }
    public string? Description { get; init; }
    public string? ExternalLink { get; init; }
    public string? ClientComments { get; init; }
    public required string Status { get; init; }

    public IReadOnlyList<string> TagIds { get; init; } = [];
    public IReadOnlyList<string> TagNames { get; init; } = [];

    public required DateOnly CreatedAt { get; init; }
    public required DateOnly UpdatedAt { get; init; }
}
