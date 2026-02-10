namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// For testing purposes only, do NOT use elsewhere.
/// </summary>
public class RepositoryStore
{
    public List<Company> Companies { get; set; } = new();
    public List<Tag> Tags { get; set; } = new();
    public List<Article> Articles { get; set; } = new();
    public List<FileAsset> Files { get; set; } = new();
    public List<FileAsset> Images { get; set; } = new();

    private static long ParseSizeToBytes(string size)
    {
        // Very small helper for mock strings like "32.0 KB"
        var parts = size.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2) return 0;

        if (!decimal.TryParse(parts[0], System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var value))
            return 0;

        return parts[1].ToUpperInvariant() switch
        {
            "B" => (long)value,
            "KB" => (long)(value * 1024m),
            "MB" => (long)(value * 1024m * 1024m),
            "GB" => (long)(value * 1024m * 1024m * 1024m),
            _ => 0
        };
    }
}