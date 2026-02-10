using MapcelRepositorioArticulos.Models;

namespace MapcelRepositorioArticulos.Repository;

public sealed class PagedResult<T>
{
    public required IReadOnlyList<T> Data { get; init; }
    public required int Total { get; init; }
    
    public required int Page { get; init; }
    
    public required int PageSize { get; init; }
}

public record FileQuery(
    string? CompanyId,
    string? SearchTerm,
    bool ImagesOnly,
    string[]? IncludeFileExtensions,
    DateOnly? DateFrom,
    DateOnly? DateTo,
    int Page,
    int PageSize
);

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
    
    // Images
    PagedResult<FileAsset> GetImages(FileQuery query);
    PagedResult<FileAsset> GetFiles(FileQuery query);
    FileAsset? GetFileById(string id);
    FileAsset? GetImageById(string id);
}