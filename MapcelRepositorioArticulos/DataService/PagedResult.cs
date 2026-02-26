using System.Diagnostics.CodeAnalysis;

namespace MapcelRepositorioArticulos.DataService;

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
