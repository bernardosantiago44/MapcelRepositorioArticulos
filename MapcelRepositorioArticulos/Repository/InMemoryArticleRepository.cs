using MapcelRepositorioArticulos.Models;

namespace MapcelRepositorioArticulos.Repository;

public class InMemoryArticleRepository: IArticleRepository
{
    private readonly RepositoryStore _store;
    
    public InMemoryArticleRepository(RepositoryStore store) => _store = store;

    public PagedResult<ArticleRowDto> GetArticles(ArticleQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 500 ? 50 : query.PageSize;

        var companiesById = _store.Companies.ToDictionary(x => x.Id, x => x.Name);
        var tagsById = _store.Tags.ToDictionary(x => x.Id, x => x.Name);

        IEnumerable<Article> articles = _store.Articles;

        if (query.CompanyId is not null)
            articles = articles.Where(a => a.CompanyId == query.CompanyId);

        if (query.Status is not null && query.Status != ArticleStatus.All)
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
                a.TagIds.Any(tid => tagsById.TryGetValue(tid, out var tn) && tn.Contains(searchQuery)) ||
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
                Status = StatusToString(a.Status),
                TagIds = string.Join(",", a.TagIds),
                TagNames = string.Join(",",
                    a.TagIds.Select(tid => tagsById.TryGetValue(tid, out var tn) ? tn : tid)),
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt
            })
            .ToList();

        return new PagedResult<ArticleRowDto> { Data = pageItems, Total = total };
    }

    public ArticleRowDto? GetArticleById(string id)
    {
        var article = _store.Articles.FirstOrDefault(a => a.Id == id);
        if (article is null)
            return null;

        var companyName = _store.Companies
                              .FirstOrDefault(c => c.Id == article.CompanyId)?.Name
                          ?? article.CompanyId;

        var tagNames = article.TagIds
            .Select(tagId =>
                _store.Tags.FirstOrDefault(t => t.Id == tagId)?.Name ?? tagId
            )
            .ToList();

        return new ArticleRowDto
        {
            Id = article.Id,
            CompanyId = article.CompanyId,
            CompanyName = companyName,
            Title = article.Title,
            Status = StatusToString(article.Status),
            TagIds = string.Join(",", article.TagIds),
            TagNames = string.Join(",", tagNames),
            CreatedAt = article.CreatedAt,
            UpdatedAt = article.UpdatedAt
        };
    }
    
    static string StatusToString(ArticleStatus status)
    {
        switch(status)
        {
            case ArticleStatus.Production: return "Producción";
            case ArticleStatus.All: return "Todos";
            case ArticleStatus.Closed: return "Cerrado";
            case ArticleStatus.Draft: return "Borrador";
            default: return "Todos";
        }
    }
}