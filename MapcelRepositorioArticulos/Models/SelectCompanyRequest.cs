using System.Text.Json.Serialization;

namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// Request body for <c>POST /api/admin/select-company</c>.
/// </summary>
public sealed class SelectCompanyRequest
{
    [JsonPropertyName("companyCode")]
    public string CompanyCode { get; init; } = string.Empty;
}
