namespace MapcelRepositorioArticulos.Models;

public class FileAsset(
    string id, 
    string name, 
    string description, 
    string extension, 
    long sizeBytes, 
    DateOnly uploadDate, 
    string companyId, 
    IReadOnlyList<string> linkedArticles,
    Uri? thumbnailUrl,
    long? width,
    long? height
)
{
    public string Id { get; set; } = id;
    public string Name { get; set; } = name;
    public string Description { get; set; } = description;
    public string Extension { get; set; } = extension; // Store as ".jpg", ".pdf", etc.
    public long SizeBytes { get; set; } = sizeBytes;
    public DateOnly UploadDate { get; set; } = uploadDate;
    public string CompanyId { get; set; }  = companyId;
    public IReadOnlyList<string> LinkedArticles { get; set; } = linkedArticles;
    public Uri? ThumbnailUrl { get; set; } = thumbnailUrl;
    public long? Width { get; set; } = width;
    public long? Height { get; set; } = height;
}

public class FileDto
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Extension { get; set; }
    public string? ThumbnailUrl { get; set; } = null;
    public bool IsImage { get; set; } = false;
}