using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.JSInterop.Infrastructure;

namespace MapcelRepositorioArticulos.Repository;
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
public class InMemoryArticleRepository: IArticleRepository
{
    private readonly RepositoryStore _store;
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase) 
    { 
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg" 
    };
    
    public InMemoryArticleRepository(RepositoryStore store) => _store = store;

    // Artuckes
    public PagedResult<ArticleRowDto> GetArticles(ArticleQuery query, CancellationToken cancellationToken = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 500 ? 50 : query.PageSize;

        var companiesById = _store.Companies.ToDictionary(company => company.Id, company => company.Name);
        var tagsById = _store.Tags.ToDictionary(tag => tag.Id, tag => tag.Name);

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

        return new PagedResult<ArticleRowDto>(pageItems, total, page, pageSize );
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
                Description = t.Description
            })
            .ToList();
    }

    public TagDto? GetTagById(string tagId)
    {
        var tag = _store.Tags.FirstOrDefault(t => t.Id == tagId);
        if (tag is null)
            return null;

        return new TagDto
        {
            Id = tag.Id,
            Name = tag.Name,
            Color = tag.Color,
            Description = tag.Description
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
    
    // Files and Images
    public PagedResult<FileAsset> GetImages(FileQuery query)
    {
        // Force the ImagesOnly flag to true and reuse the main logic
        return GetFiles(query with { ImagesOnly = true });
    }
    
    public PagedResult<FileAsset> GetFiles(FileQuery query)
    {
        IQueryable<FileAsset> queryable;
        if (query.ImagesOnly)
        {
            queryable = _store.Images.AsQueryable();
        }
        else
        {
            queryable = _store.Files.AsQueryable();
        }

        // 1. Filter by Company
        if (!string.IsNullOrWhiteSpace(query.CompanyId))
        {
            queryable = queryable.Where(f => f.CompanyId == query.CompanyId);
        }

        // 2. Filter by Search Term
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            queryable = queryable.Where(f => 
                f.Name.Contains(query.SearchTerm, StringComparison.OrdinalIgnoreCase) || 
                f.Description.Contains(query.SearchTerm, StringComparison.OrdinalIgnoreCase));
        }

        // 3. Filter by specific extensions (Safe lookup against the new property)
        if (query.IncludeFileExtensions is { Length: > 0 })
        {
            // Normalize query extensions to include the dot (e.g., "pdf" -> ".pdf")
            var targetExtensions = query.IncludeFileExtensions
                .Select(e => e.StartsWith('.') ? e : $".{e}")
                .ToList();

            // Check if the file's extension is in the list
            queryable = queryable.Where(f => targetExtensions.Contains(f.Extension, StringComparer.OrdinalIgnoreCase));
        }

        // 5. Date Filters
        if (query.DateFrom.HasValue)
        {
            queryable = queryable.Where(f => f.UploadDate >= query.DateFrom.Value);
        }

        if (query.DateTo.HasValue)
        {
            queryable = queryable.Where(f => f.UploadDate <= query.DateTo.Value);
        }

        // 6. Pagination
        var totalCount = queryable.Count();
        var pageIndex = Math.Max(1, query.Page) - 1;

        var items = queryable
            .Skip(pageIndex * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        return new PagedResult<FileAsset> { Data = items, Total = totalCount, Page = query.Page, PageSize = query.PageSize};
    }
    
    public FileAsset? GetFileById(string id)
    {
        var files = _store.Files.AsQueryable();
        return files.FirstOrDefault(f => f.Id == id);
    }

    public FileAsset? GetImageById(string id)
    {
        var files = _store.Images.AsQueryable();
        return files.FirstOrDefault(f => 
            f.Id == id && 
            ImageExtensions.Contains(f.Extension));
    }
}