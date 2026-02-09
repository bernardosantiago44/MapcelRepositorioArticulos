namespace MapcelRepositorioArticulos.Models;

public class CompanySettings
{
    public bool AllowUserTagCreation { get; set; }
    public bool AllowUserUploads { get; set; }
    public bool RequireClientComments { get; set; }

    public CompanySettings(bool allowUserTagCreation, bool allowUserUploads, bool requireClientComments)
    {
        AllowUserTagCreation = allowUserTagCreation;
        AllowUserUploads = allowUserUploads;
        RequireClientComments = requireClientComments;
    }
}