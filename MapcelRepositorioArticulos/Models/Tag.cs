namespace MapcelRepositorioArticulos.Models;

public class Tag
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Color { get; set; }
    public string Description { get; set; }
    public string CompanyId { get; set; }
    
    public Tag(string id, string name, string color, string description, string companyId)
    {
        Id = id;
        Name = name;
        Color = color;
        Description = description;
        CompanyId = companyId;
    }
}

public sealed class TagDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Color { get; init; }
    public string? Description { get; init; }
    public required string CompanyId { get; init; }
}
