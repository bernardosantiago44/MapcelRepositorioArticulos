using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// Represents the full JSON payload inside the encrypted <c>X-Company-Context</c> header.
/// Used for both admin-generated and externally-provided company contexts.
/// </summary>
public sealed class CompanyContextPayload
{
    [JsonPropertyName("company_code")]
    public string CompanyCode { get; init; } = string.Empty;

    [JsonPropertyName("user_id")]
    public string? UserId { get; init; }

    [JsonPropertyName("is_admin")]
    public bool IsAdmin { get; init; }

    [JsonPropertyName("issued_at")]
    public string? IssuedAt { get; init; }

    [JsonPropertyName("checksum")]
    public string? Checksum { get; init; }

    /// <summary>
    /// Computes the expected HMAC-SHA256 checksum for this payload using the given key.
    /// The checksum covers <c>company_code|is_admin|issued_at</c>.
    /// </summary>
    public static string ComputeChecksum(string companyCode, bool isAdmin, string issuedAt, string key)
    {
        var data = $"{companyCode}|{isAdmin}|{issuedAt}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexStringLower(hash);
    }

    /// <summary>
    /// Validates the integrity of this payload by recomputing the checksum.
    /// Returns <c>true</c> when checksum is present and matches the expected value.
    /// </summary>
    public bool ValidateChecksum(string key)
    {
        if (string.IsNullOrEmpty(Checksum) || string.IsNullOrEmpty(IssuedAt))
            return false;

        var expected = ComputeChecksum(CompanyCode, IsAdmin, IssuedAt, key);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(Checksum));
    }
}
