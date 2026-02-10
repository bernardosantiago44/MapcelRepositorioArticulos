using MapcelRepositorioArticulos.Models;

namespace MapcelRepositorioArticulos.Repository;

public sealed class PagedResult<T>
{
    public required IReadOnlyList<T> Data { get; init; }
    public required int Total { get; init; }
}


public record ArticleQuery(
    string? CompanyId,
    string? Search,
    string? Status,
    DateOnly? DateFrom,
    DateOnly? DateTo,
    string[]? TagIds,
    int Page,
    int PageSize
);

public interface IArticleRepository
{
    // Articles
    PagedResult<ArticleRowDto> GetArticles(ArticleQuery query);
    ArticleDetailsDto? GetArticleById(string id);
    
    // Tags
    IReadOnlyList<TagDto> GetTagsByCompany(string companyId);
    TagDto? GetTagById(string tagId);
    
    // Companies
    IEnumerable<Company> GetCompanies();
    Company? GetCompanyById(string id);
}