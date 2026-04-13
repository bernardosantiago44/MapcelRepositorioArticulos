using MapcelRepositorioArticulos.Models;

namespace MapcelRepositorioArticulos.DataService;

/// <summary>
/// Orchestrates the full staged article creation flow:
/// creates the article, persists the description file,
/// stores attachment metadata, writes physical files,
/// and links all uploaded assets to the created article.
/// </summary>
public interface IArticleAggregateService
{
    /// <summary>
    /// Creates a new article aggregate for the given command.
    /// This operation is responsible for coordinating:
    /// the SQL article row,
    /// the article directory,
    /// description.txt,
    /// file/image metadata rows,
    /// physical file persistence,
    /// and article-file links.
    /// </summary>
    /// <param name="command">CreateArticleCommand</param>
    /// <param name="cancellationToken"></param>
    /// <returns>ArticleCreatedDto</returns>
    /// <exception cref="ArgumentException">
    /// Thrown when the command is invalid, the company code is invalid,
    /// or any referenced tag is not valid for the company.
    /// </exception>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the article aggregate could not be created successfully.
    /// </exception>
    Task<ArticleCreatedDto> CreateAggregateAsync(
        CreateArticleCommand command,
        CancellationToken cancellationToken);
    
    Task<ArticleDetailsDto?> UpdateAggregateAsync(
        UpdateArticleCommand command,
        CancellationToken cancellationToken);
}