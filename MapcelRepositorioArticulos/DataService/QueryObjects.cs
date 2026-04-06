namespace MapcelRepositorioArticulos.DataService;

/// <summary>
/// Query parameters of the articles to fetch.
/// </summary>
public class ArticleQuery
{
    public required Guid CompanyCode { get; init; }
    public Guid? ArticleId { get; init; }
    public string? Search { get; init; } 
    public string? Status { get; init; } 
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

    /// <summary>
    /// Validates the given query object.
    /// </summary>
    /// <exception cref="ArgumentNullException">If companyCode is null or empty</exception>
    /// <exception cref="ArgumentOutOfRangeException">If page &lt;= 0 or if pageSize &lt;=0</exception>
    public void ValidateQuery()
    {
        if (CompanyCode == Guid.Empty) 
            throw new ArgumentNullException(nameof(CompanyCode));
        if (Page <= 0)
            throw new ArgumentOutOfRangeException(nameof(Page));
        if (PageSize <= 0)
            throw new ArgumentOutOfRangeException(nameof(PageSize));
    }
}

/// <summary>
/// Query parameters of the tags to fetch.
/// </summary>
public class TagsQuery
{
    public required Guid CompanyCode { get; init; }
    public string? Search { get; init; }
}

/// <summary>
/// Query parameters for Files to fetch.
/// </summary>
/// <param name="CompanyCode">Guid?</param>
/// <param name="SearchTerm">string?</param>
/// <param name="ImagesOnly">bool</param>
/// <param name="IncludeFileExtensions">string[]?</param>
/// <param name="DateFrom">DateOnly?</param>
/// <param name="DateTo">DateOnly></param>
/// <param name="Page">int</param>
/// <param name="PageSize">int</param>
public class FileQuery
{
    public Guid? CompanyCode { get; set; }
    public string? SearchTerm { get; set; } = null;
    public bool ImagesOnly { get; set; } = false;
    public int? Id { get; set; } = null;
    public string[]? Extensions { get; set; } = null;
    public DateOnly? DateFrom { get; init; } = null;
    public DateOnly? DateTo { get; init; } = null;
    public required int Page { get; init; } = 1;
    public required int PageSize { get; init; } = 20;
    
    /// <summary>
    /// Indicates whether the IncludedFileExtensions 
    ///  is not null and contains at least one non-null
    /// value.
    /// </summary>
    /// <returns></returns>
    public bool IsFilteringExtensions()
    {
        return Extensions != null && Extensions.Length > 0;
    }

    public string GetFileExtensionsString()
    {
        if (!IsFilteringExtensions()) return "";
        var clean = this.Extensions!
            .Where(s => !string.IsNullOrWhiteSpace(s));
        return string.Join(",", clean);
    }

    /// <summary>
    /// Returns true if query contains a
    /// CompanyCode OR a particular Id, or both.
    /// </summary>
    /// <returns></returns>
    public bool IsValidQuery()
    {
        return CompanyCode != null || Id != null;
    }

    public FileQueryType GetFileQueryType()
    {
        if (Id != null) return FileQueryType.ById;
        if (CompanyCode != null) return FileQueryType.ByCompany;
        return FileQueryType.Undefined;
    }

    public enum FileQueryType
    {
        ByCompany, ById, Undefined
    }
};