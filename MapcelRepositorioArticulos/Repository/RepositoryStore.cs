namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// For testing purposes only, do NOT use elsewhere.
/// </summary>
public class RepositoryStore
{
    public List<Company> Companies { get; } = new();
    public List<Tag> Tags { get; } = new();
    public List<Article> Articles { get; } = new();
    public List<FileAsset> Files { get; } = new();

    public RepositoryStore()
    {
        Companies.Add(new Company(
            "co-01",
            "Acme Corporation",
            new CompanySettings(true, true, false)
        ));

        Tags.Add(new Tag(
            "tag-001",
            "Urgente",
            "#ef4444",
            "Requiere atención inmediata",
            "co-01"
        ));

        Articles.Add(new Article(
            "issue-0001",
            "co-01",
            "No se puede iniciar sesión en la cuenta después de cambiar la contraseña",
            "Descripción detallada del problema: ...",
            "https://external-tracker.com/issue-0001",
            "Cliente reportó: ...",
            ArticleStatus.Production,
            new[] { "tag-001", "tag-002" },
            DateOnly.Parse("2026-01-02"),
            DateOnly.Parse("2026-01-20")
        ));

        Files.Add(new FileAsset(
            "file-001",
            "test-results.csv",
            "test-results para Acme Corporation",
            ParseSizeToBytes("32.0 KB"),
            DateOnly.Parse("2026-01-26"),
            "co-01",
            new[] { "issue-0001" },
            null,
            null,
            null
        ));

        Files.Add(new FileAsset(
            "img-001",
            "ui-mockup.png",
            "UI mockup para la página principal de Acme Corporation",
            ParseSizeToBytes("426.6 KB"),
            DateOnly.Parse("2026-01-14"),
            "co-01",
            new[] { "issue-0001" },
            new Uri("https://picsum.photos/seed/img001/400/225"),
            1920,
            1080
        ));
    }

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