using MapcelRepositorioArticulos.Models;
using Microsoft.JSInterop.Infrastructure;

namespace MapcelRepositorioArticulos.Repository;

public class InMemoryArticleRepository: IArticleRepository
{
    private readonly RepositoryStore _store;
    
    public InMemoryArticleRepository(RepositoryStore store) => _store = store;

    // Artuckes
    public PagedResult<ArticleRowDto> GetArticles(ArticleQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 500 ? 50 : query.PageSize;

        var companiesById = _store.Companies.ToDictionary(x => x.Id, x => x.Name);
        var tagsById = _store.Tags.ToDictionary(x => x.Id, x => x.Name);

        IEnumerable<Article> articles = _store.Articles;

        if (query.CompanyId is not null)
            articles = articles.Where(a => a.CompanyId == query.CompanyId);

        if (query.Status is not null && query.Status != "all")
            articles = articles.Where(a => a.Status.Equals(query.Status));

        if (query.DateFrom is not null)
            articles = articles.Where(a => a.CreatedAt >= query.DateFrom.Value);

        if (query.DateTo is not null)
            articles = articles.Where(a => a.CreatedAt <= query.DateTo.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchQuery = query.Search.Trim();

            articles = articles.Where(a =>
                a.Title.Contains(searchQuery) ||
                a.Description.Contains(searchQuery) ||
                (a.ClientComments?.Contains(searchQuery) ?? true) ||
                a.Tags.Any(tid => tagsById.TryGetValue(tid, out var tn) && tn.Contains(searchQuery)) ||
                (companiesById.TryGetValue(a.CompanyId, out var cn) && cn.Contains(searchQuery))
            );
        }

        // Future sorting hook: keep articles as IEnumerable, later add ORDER BY in SQL repo
        // In-memory default ordering:
        articles = articles.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.UpdatedAt);

        var total = articles.Count();

        var pageItems = articles
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new ArticleRowDto
            {
                Id = a.Id,
                CompanyId = a.CompanyId,
                CompanyName = companiesById.TryGetValue(a.CompanyId, out var cn) ? cn : a.CompanyId.ToString(),
                Title = a.Title,
                Description = a.Description,
                Status = a.Status,
                Tags = a.Tags,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt
            })
            .ToList();

        return new PagedResult<ArticleRowDto> { Data = pageItems, Total = total };
    }

    public ArticleDetailsDto? GetArticleById(string id)
    {
        Article? article = _store.Articles.FirstOrDefault(a => a.Id == id);
        if (article is null)
            return null;

        var companyName = _store.Companies
                              .FirstOrDefault(c => c.Id == article.CompanyId)?.Name
                          ?? article.CompanyId;

        var tagNames = article.Tags
            .Select(tagId =>
                _store.Tags.FirstOrDefault(t => t.Id == tagId)?.Name ?? tagId
            )
            .ToList();

        return new ArticleDetailsDto(article, companyName, tagNames);
    }
    
    // Tags
    public IReadOnlyList<TagDto> GetTagsByCompany(string companyId)
    {
        if (string.IsNullOrWhiteSpace(companyId))
            return Array.Empty<TagDto>();

        return _store.Tags
            .Where(t => t.CompanyId == companyId)
            .OrderBy(t => t.Name)
            .Select(t => new TagDto
            {
                Id = t.Id,
                Name = t.Name,
                Color = t.Color,
                Description = t.Description,
                CompanyId = t.CompanyId
            })
            .ToList();
    }

    public TagDto? GetTagById(string tagId)
    {
        if (string.IsNullOrWhiteSpace(tagId))
            return null;

        var tag = _store.Tags.FirstOrDefault(t => t.Id == tagId);
        if (tag is null)
            return null;

        return new TagDto
        {
            Id = tag.Id,
            Name = tag.Name,
            Color = tag.Color,
            Description = tag.Description,
            CompanyId = tag.CompanyId
        };
    }

    // Companies
    public IEnumerable<Company> GetCompanies()
    {
        return  _store.Companies;
    }

    public Company? GetCompanyById(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        
        return _store.Companies.FirstOrDefault(c => c.Id == id);
    }
}