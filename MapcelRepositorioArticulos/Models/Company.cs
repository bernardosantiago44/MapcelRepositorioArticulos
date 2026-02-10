namespace MapcelRepositorioArticulos.Models;

public class Company
{
    public string Id { get; set; }
    public string Name { get; set; }
    public CompanySettings Settings { get; set; }

    public Company(string id, string name, CompanySettings settings)
    {
        Id = id;
        Name = name;
        Settings = settings;
    }

    public Company() { }
}