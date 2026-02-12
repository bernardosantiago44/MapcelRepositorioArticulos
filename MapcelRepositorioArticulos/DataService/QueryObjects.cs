namespace MapcelRepositorioArticulos.DataService;

/// <summary>
/// Query parameters of the articles to fetch.
/// </summary>
/// <param name="page">1</param>
/// <param name="pageSize">20</param>
public class ArticleQuery
{
    public required string CompanyId { get; init; }
    public int? ArticleId { get; init; }
    public string? Search { get; init; } //
    public string? Status { get; init; } //
    public DateOnly? DateFrom  { get; init; }
    public DateOnly? DateTo { get; init; }
    public string[]? TagIds { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }

    
    /// <summary>
    /// Indicates if TagIds is not null and contains at least one non-null value.
    /// </summary>
    /// <returns>bool</returns>
    public bool IsTagsFilterAvailable()
    {
        return this.TagIds != null && this.TagIds.Any();
    }

    /// <summary>
    /// Returns the string of all tags to filter, separated by commas, if TagIds is valid.
    /// Example: [1, 3, null, 5] → "1,3,5".
    /// </summary>
    /// <returns>string?</returns>
    public string? CleanTagFiltersString()
    {
        if (!this.IsTagsFilterAvailable()) return "";
        var clean = this.TagIds!
            .Where(s => !string.IsNullOrWhiteSpace(s));
        return string.Join(",", clean);
    }
}

/// <summary>
/// Query parameters of the tags to fetch.
/// </summary>
public class TagsQuery
{
    public required string CompanyCode { get; init; }
    public string? Search { get; init; }
}

/// <summary>
/// Query parameters for Files to fetch.
/// </summary>
/// <param name="CompanyId">string?</param>
/// <param name="SearchTerm">string?</param>
/// <param name="ImagesOnly">bool</param>
/// <param name="IncludeFileExtensions">string[]?</param>
/// <param name="DateFrom">DateOnly?</param>
/// <param name="DateTo">DateOnly></param>
/// <param name="Page">int</param>
/// <param name="PageSize">int</param>
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