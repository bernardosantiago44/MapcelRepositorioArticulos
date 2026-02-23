using System.Text.Json.Serialization;

namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// Represents the payload decrypted from the secure metadata query parameter.
/// </summary>
public sealed class UserMetadata
{
    [JsonPropertyName("company_code")]
    public string CompanyCode { get; init; } = string.Empty;

    [JsonPropertyName("user_id")]
    public string UserId { get; init; } = string.Empty;
}
