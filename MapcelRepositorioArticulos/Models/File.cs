using System;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;

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
    public int? Width { get; set; }
    public int? Height { get; set; }

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
        int? width,
        int? height)
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
    public int? Width { get; set; }
    public int? Height { get; set; }
    public long? SizeBytes { get; set; }
    public required DateTime UploadDate { get; set; }
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
    public required bool IsImage { get; set; } = false;

    public void Validate()
    {
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

public sealed class MultipleFilesDto
{
    public IFormFileCollection? Files { get; set; }
    public List<string?>? Descriptions { get; init; }

    public List<FileUploadDto> ToUploads()
    {
        if (Files ==  null || Files.Count == 0) return [];
        List<FileUploadDto> files = [];
        
        for (var i = 0; i < Files.Count; i++)
        {
            var dimensions = GetImageDimensions(Files[i]);
            var description = Descriptions != null && Descriptions.Count > i ? Descriptions.ElementAt(i) ?? string.Empty : string.Empty; 
            files.Add(new FileUploadDto
            {
                File = Files[i],
                Description = description,
                Width = dimensions?.Width,
                Height = dimensions?.Height,
                IsImage = IsImage(Files[i])
            });
        }

        return files;
    }
    
    private static readonly Dictionary<string, byte[]> ImageSignatures = new()
    {
        { "jpg", [0xFF, 0xD8, 0xFF] },
        { "png", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
        { "gif", [0x47, 0x49, 0x46, 0x38] },
        { "webp", [0x52, 0x49, 0x46, 0x46] } // "RIFF" header
    };

    private static bool IsImage(IFormFile? file)
    {
        // 1. Basic null and length check
        if (file == null || file.Length == 0) return false;

        // 2. MIME type check (The "Quick & Dirty" first pass)
        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) 
            return false;

        // 3. Deep dive: Magic Byte Validation
        using var stream = file.OpenReadStream();
        using var reader = new BinaryReader(stream);
        
        // We only need the first few bytes to identify the format
        byte[] headerBytes = reader.ReadBytes(8);

        return ImageSignatures.Values.Any(signature => 
            headerBytes.Take(signature.Length).SequenceEqual(signature));
    }
    
    private static (int Width, int Height)? GetImageDimensions(IFormFile? file)
    {
        if (file == null || file.Length == 0) return null;
        if (!IsImage(file)) return null;

        try
        {
            using var stream = file.OpenReadStream();
        
            // Image.Identify reads the metadata (header) only.
            // It's significantly faster and more memory-efficient than loading the image.
            var info = Image.Identify(stream);

            if (info != null)
            {
                return (info.Width, info.Height);
            }
        }
        catch (Exception ex)
        {
            // Log the error: The file might be a "polyglot" or corrupted
            Console.WriteLine($"Dimension extraction failed: {ex.Message}");
        }

        return null;
    }
}