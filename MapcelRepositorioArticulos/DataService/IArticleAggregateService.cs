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
    /// Fetch all Articles from the SQL Database matching the given query.
    /// </summary>
    /// <param name="query">ArticleQuery</param>
    /// <param name="cancellationToken"></param>
    /// <returns>PagedResult: ArticleRowDto</returns>
    public Task<PagedResult<ArticleDetailsDto>> GetAsync(ArticleQuery query, CancellationToken cancellationToken);
    
    /// <summary>
    /// Creates a new article aggregate for the given command. This operation is responsible for coordinating:
    /// the SQL article row, the article directory, description.txt, file/image metadata rows,
    /// physical file persistence, and article-file links.
    /// </summary>
    /// <param name="command">CreateArticleCommand</param>
    /// <param name="cancellationToken"></param>
    /// <returns>ArticleCreatedDto</returns>
    /// <exception cref="ArgumentException">
    /// Thrown when the command is invalid, the company code is invalid, or any referenced tag is not
    /// valid for the company.
    /// </exception>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the article aggregate could not be created successfully.
    /// </exception>
    Task<ArticleCreatedDto> CreateAggregateAsync(
        CreateArticleCommand command,
        CancellationToken cancellationToken);
    
    /// <summary>
    /// Updates the article for the given UUID with the given parameters.
    /// </summary>
    /// <param name="command">UpdateArticleCommand</param>
    /// <param name="cancellationToken"></param>
    /// <returns>ArticleRowDto or null if the given UUID does not exist.</returns>
    Task<ArticleDetailsDto?> UpdateAggregateAsync(
        UpdateArticleCommand command,
        CancellationToken cancellationToken);
    
    /// <summary>
    /// Updates the given articles (UUIDs) to add or remove the specified tag.
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleIds">UUIDs of the articles to update</param>
    /// <param name="tagId">Numeric id of the tag to add or remove</param>
    /// <param name="action">Add or Remove</param>
    /// <param name="cancellationToken"></param>
    /// <returns></returns>
    Task<int> BulkUpdateSingleTagAsync(
        Guid companyCode,
        Guid[] articleIds,
        int tagId,
        string action,
        CancellationToken cancellationToken);
    
        
    /// <summary>
    /// Deletes the specified article id within the given company code.
    /// </summary>
    /// <param name="articleId"></param>
    /// <param name="companyCode">Guid</param>
    /// <param name="cancellationToken"></param>
    /// <returns>True if the operation was successful, false otherwise.</returns>
    public Task<bool> DeleteAsync(Guid articleId, Guid companyCode, CancellationToken cancellationToken);
}