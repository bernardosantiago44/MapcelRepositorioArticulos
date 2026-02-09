namespace MapcelRepositorioArticulos.Models;

public class FileAsset(
    string id, 
    string name, 
    string description, 
    long sizeBytes, 
    DateOnly uploadDate, 
    string companyId, 
    IReadOnlyList<string> linkedArticles,
    Uri? thumbnailUri,
    long? width,
    long? height
)
{
    private string Id { get; set; } = id;
    string Name { get; set; } = name;
    long SizeBytes { get; set; } = sizeBytes;
    string Description { get; set; } = description;
    private DateOnly UploadDate { get; set; } = uploadDate;
    string CompanyId { get; set; }  = companyId;
    IReadOnlyList<string> LinkedArticles { get; set; } = linkedArticles;
    Uri? ThumbnailUrl { get; set; } = thumbnailUri;
    long? Width { get; set; } = width;
    long? Height { get; set; } = height;

}