namespace MapcelRepositorioArticulos.Models;

public class Tag
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Color { get; set; }
    public string Description { get; set; }
    public Guid CompanyCode { get; set; }
    
    public Tag() {}
    public Tag(string id, string name, string color, string description, Guid companyCode)
    {
        Id = id;
        Name = name;
        Color = color;
        Description = description;
        CompanyCode = companyCode;
    }
}

public sealed class TagDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Color { get; init; }
    public string? Description { get; init; }
}

public sealed class CreateTagRequest
{
    public required string Name { get; set; } = string.Empty;
    public required string Color { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>
    /// Validates the request's name is not empty,
    /// the color to be non-empty
    /// and optional description to be less than 250 characters.
    /// </summary>
    /// <exception cref="ArgumentException">If any of the fields is not valid.</exception>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Name))
            throw new ArgumentException("CreateTagRequest: Name is required.");

        if (Name.Trim().Length > 100)
            throw new ArgumentException("CreateTagRequest: Name cannot exceed 100 characters.");

        if (string.IsNullOrWhiteSpace(Color) || Color.Trim().Length > 10)
            throw new ArgumentException("CreateTagRequest: Hex Color cannot exceed 10 characters.");

        if (!string.IsNullOrWhiteSpace(Description) && Description.Trim().Length > 250)
            throw new ArgumentException("CreateTagRequest: Description cannot exceed 250 characters.");
    }
}

public sealed class UpdateTagRequest
{
    public string? Name { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }

    public void Validate()
    {
        var hasName = !string.IsNullOrWhiteSpace(Name);
        var hasColor = !string.IsNullOrWhiteSpace(Color);
        var hasDescription = !string.IsNullOrWhiteSpace(Description);

        if (!hasName && !hasColor && !hasDescription)
            throw new ArgumentException("UpdateTagRequest: provide at least one of Name, Color, or Description.");

        if (hasName && Name!.Trim().Length > 100)
            throw new ArgumentException("UpdateTagRequest: Name cannot exceed 100 characters.");

        if (hasColor && Color!.Trim().Length > 10)
            throw new ArgumentException("UpdateTagRequest: Color cannot exceed 10 characters.");

        if (hasDescription && Description!.Trim().Length > 250)
            throw new ArgumentException("UpdateTagRequest: Description cannot exceed 250 characters.");
    }
}
