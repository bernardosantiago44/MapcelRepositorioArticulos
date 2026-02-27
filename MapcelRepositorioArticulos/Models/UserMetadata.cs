using System.Text.Json.Serialization;

namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// Represents the payload decrypted from the secure metadata query parameter.
/// </summary>
public sealed class UserMetadata
{
    [JsonPropertyName("company_code")]
    public Guid CompanyCode { get; init; }

    [JsonPropertyName("user_id")]
    public string UserId { get; init; } = string.Empty;
}
