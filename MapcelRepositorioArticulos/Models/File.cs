using Microsoft.AspNetCore.Http;

namespace MapcelRepositorioArticulos.Models;

public class FileAsset
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Extension { get; set; }
    public long SizeBytes { get; set; }
    public DateOnly UploadDate { get; set; }
    public Guid CompanyCode { get; set; }
    public IReadOnlyList<string> LinkedArticles { get; set; }
    public Uri? ThumbnailUrl { get; set; }
    public long? Width { get; set; }
    public long? Height { get; set; }

    // Empty Constructor (for serialization or EF Core)
    public FileAsset()
    {
        // Initializing the list to prevent null reference issues
        LinkedArticles = new List<string>();
        Id = string.Empty;
        Name = string.Empty;
        Description = string.Empty;
        Extension = string.Empty;
        CompanyCode = Guid.Empty;
    }

    // Regular Constructor
    public FileAsset(
        string id, 
        string name, 
        string description, 
        string extension, 
        long sizeBytes, 
        DateOnly uploadDate, 
        Guid companyCode, 
        IReadOnlyList<string> linkedArticles,
        Uri? thumbnailUrl,
        long? width,
        long? height)
    {
        Id = id;
        Name = name;
        Description = description;
        Extension = extension;
        SizeBytes = sizeBytes;
        UploadDate = uploadDate;
        CompanyCode = companyCode;
        LinkedArticles = linkedArticles;
        ThumbnailUrl = thumbnailUrl;
        Width = width;
        Height = height;
    }
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

public sealed class UpdateFileRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }

    /// <summary>
    /// Validates the current FileRequest.
    /// </summary>
    /// <exception cref="ArgumentException">If name or description are empty (any),
    /// or if the length exceeds 500 characters.</exception>
    public void Validate()
    {
        var nameEmpty = string.IsNullOrWhiteSpace(Name);
        var descEmpty = string.IsNullOrWhiteSpace(Description);

        if (nameEmpty && descEmpty)
            throw new ArgumentException("UpdateFileRequest: at least one of Name or Description must be provided.");

        if (!nameEmpty && Name!.Trim().Length > 255)
            throw new ArgumentException("UpdateFileRequest: Name cannot exceed 255 characters.");

        if (!descEmpty && Description!.Trim().Length > 500)
            throw new ArgumentException("UpdateFileRequest: Description cannot exceed 500 characters.");
    }
}

public sealed class FileUploadDto
{
    public required IFormFile File { get; set; }
    public string? Description { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? ThumbnailUrl { get; set; }

    public void Validate()
    {
        if (File is null)
            throw new ArgumentNullException(nameof(File), "FileUploadDto: File is required.");

        if (!string.IsNullOrWhiteSpace(Description) && Description.Trim().Length > 500)
            throw new ArgumentException("FileUploadDto: Description cannot exceed 500 characters.");

        var trimmedThumbnailUrl = ThumbnailUrl?.Trim();
        if (!string.IsNullOrWhiteSpace(trimmedThumbnailUrl) && trimmedThumbnailUrl.Length > 500)
            throw new ArgumentException("FileUploadDto: ThumbnailUrl cannot exceed 500 characters.");

        if (!string.IsNullOrWhiteSpace(trimmedThumbnailUrl)
            && !Uri.IsWellFormedUriString(trimmedThumbnailUrl, UriKind.RelativeOrAbsolute))
            throw new ArgumentException("FileUploadDto: ThumbnailUrl is not a valid URI.");

        if (Width is < 0)
            throw new ArgumentOutOfRangeException(nameof(Width), "FileUploadDto: Width cannot be negative.");

        if (Height is < 0)
            throw new ArgumentOutOfRangeException(nameof(Height), "FileUploadDto: Height cannot be negative.");
    }
}
