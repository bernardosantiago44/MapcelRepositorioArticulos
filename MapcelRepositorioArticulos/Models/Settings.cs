namespace MapcelRepositorioArticulos.Models;

public class CompanySettings
{
    public bool AllowUserUploads { get; set; }
    public bool AllowUserTagCreation { get; set; }
    public bool RequireClientComments { get; set; }

    public CompanySettings()
    {
        AllowUserUploads = false;
        AllowUserTagCreation = false;
        RequireClientComments = false;
    }
    
    public CompanySettings(bool allowUserTagCreation, bool allowUserUploads, bool requireClientComments)
    {
        AllowUserTagCreation = allowUserTagCreation;
        AllowUserUploads = allowUserUploads;
        RequireClientComments = requireClientComments;
    }
}