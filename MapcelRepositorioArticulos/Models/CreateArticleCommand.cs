namespace MapcelRepositorioArticulos.Models;

using Microsoft.AspNetCore.Http;

/// <summary>
/// Internal command for the article aggregate creation flow.
/// This should be used by the service layer, not directly by model binding.
/// </summary>
public class CreateArticleCommand
{
    public required Guid CompanyCode { get; init; }
    public required string Title { get; init; }
    public required string DescriptionHtml { get; init; }
    public string? ExternalLink { get; init; }
    public string? ClientComments { get; init; }
    public required string Status { get; init; }

    public IReadOnlyList<int> TagIds { get; init; } = [];
    public IReadOnlyList<CreateArticleUploadCommand> Files { get; init; } = [];
    public IReadOnlyList<CreateArticleUploadCommand> Images { get; init; } = [];

    public void Validate()
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(Title);
        ArgumentException.ThrowIfNullOrWhiteSpace(DescriptionHtml);
        ArgumentException.ThrowIfNullOrWhiteSpace(Status);

        if (CompanyCode == Guid.Empty)
            throw new ArgumentException("CompanyCode is required.", nameof(CompanyCode));

        foreach (var file in Files)
            file.Validate();

        foreach (var image in Images)
            image.Validate();
    }
}

public sealed class CreateArticleUploadCommand
{
    public required string ClientTempId { get; init; }
    public required IFormFile File { get; init; }
    public string? Description { get; init; }

    public void Validate()
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ClientTempId);

        if (File is null)
            throw new ArgumentNullException(nameof(File));

        if (File.Length <= 0)
            throw new ArgumentException("Uploaded file cannot be empty.", nameof(File));

        if (string.IsNullOrWhiteSpace(File.FileName))
            throw new ArgumentException("Uploaded file must have a file name.", nameof(File));
    }
}