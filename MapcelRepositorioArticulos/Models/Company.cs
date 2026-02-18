namespace MapcelRepositorioArticulos.Models;

public class Company
{
    public string Id { get; set; }
    public string Name { get; set; }
    public CompanySettings Settings { get; set; }

    public Company()
    {
        Id = string.Empty;
        Name = string.Empty;
        Settings = new CompanySettings();
    }
    public Company(string id, string name, CompanySettings settings)
    {
        Id = id;
        Name = name;
        Settings = settings;
    }

}

/// <summary>
/// Request object for updating a company's settings.
/// </summary>
public sealed class UpdateCompanyRequest
{
    public string? Name { get; set; }

    public bool? AllowUserUploads { get; set; }
    public bool? AllowUserTagCreation { get; set; }
    public bool? RequireClientComments { get; set; }

    /// <summary>
    /// Ensures the request contains at least one (or more)
    /// non-null value. Name cannot exceed 150 characters.
    /// </summary>
    /// <exception cref="ArgumentException">If all attributes are null or empty.</exception>
    public void Validate()
    {
        var hasName = !string.IsNullOrWhiteSpace(Name);
        var hasAnySetting = AllowUserUploads.HasValue || AllowUserTagCreation.HasValue || RequireClientComments.HasValue;

        if (!hasName && !hasAnySetting)
            throw new ArgumentException("UpdateCompanyRequest: provide Name and/or at least one setting.");

        if (hasName && Name!.Trim().Length > 150)
            throw new ArgumentException("UpdateCompanyRequest: Name cannot exceed 150 characters.");
    }
}
