using System.Diagnostics.CodeAnalysis;
using MapcelRepositorioArticulos.Models;
using Serilog.Debugging;

namespace MapcelRepositorioArticulos.Repository;

public sealed class PagedResult<T>
{
    public required IReadOnlyList<T> Data { get; init; }
    public required int Total { get; init; }
    
    public required int Page { get; init; }
    
    public required int PageSize { get; init; }

    [SetsRequiredMembers]
    public PagedResult(List<T> data, int total, int page, int pageSize)
    {
        Data = data;
        Total = total;
        Page = page;
        PageSize = pageSize;
    }

    public PagedResult()
    {
    }
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

public interface IQueryObject {}

public class ArticleQuery(int page = 1, int pageSize = 20) : IQueryObject
{
    public string? CompanyId { get; init; } //
    public string? Search { get; init; } //
    public string? Status { get; init; } //
    public DateOnly? DateFrom  { get; init; }
    public DateOnly? DateTo { get; init; }
    public string[]? TagIds { get; init; }
    public required int Page = page;
    public required int PageSize = pageSize;

    public bool IsTagsFilterAvailable()
    {
        return this.TagIds != null && this.TagIds.Any();
    }

    public string? CleanTagFiltersString()
    {
        if (!this.IsTagsFilterAvailable()) return "";
        var clean = this.TagIds!
            .Where(s => !string.IsNullOrWhiteSpace(s));
        return string.Join(",", clean);
    }
}

public interface IArticleRepository
{
    // Articles
    PagedResult<ArticleRowDto> GetArticles(ArticleQuery query, CancellationToken cancellationToken = default);
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