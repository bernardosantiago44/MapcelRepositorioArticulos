using System.Text.Json;
using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Serilog;

namespace MapcelRepositorioArticulos.Middleware;

/// <summary>
/// Middleware that decrypts the <c>X-Company-Context</c> header, validates its integrity,
/// and stores the resolved <see cref="CompanyContext"/> in <c>HttpContext.Items</c>.
/// Returns <c>401 Unauthorized</c> when the header is missing or invalid.
/// </summary>
public sealed class CompanyContextMiddleware(RequestDelegate next, IConfiguration configuration)
{
    /// <summary>
    /// Path prefixes that are exempt from requiring the <c>X-Company-Context</c> header.
    /// </summary>
    private static readonly string[] ExemptPrefixes =
    [
        "/api/admin/select-company",
        "/api/companies"
    ];

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Skip non-API routes (MVC views, static files) and exempt endpoints.
        if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
            && !path.StartsWith("/debug/", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        if (IsExempt(path))
        {
            await next(context);
            return;
        }

        var header = context.Request.Headers["X-Company-Context"].ToString();
        if (string.IsNullOrWhiteSpace(header))
        {
            Log.Warning("CompanyContextMiddleware: missing X-Company-Context header for {Path}", path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var key = configuration["Crypto:MetadataKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            Log.Error("CompanyContextMiddleware: Crypto:MetadataKey is not configured");
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            return;
        }

        try
        {
            var decrypted = SymmetricCipher.Decrypt(header, key);
            var payload = JsonSerializer.Deserialize<CompanyContextPayload>(decrypted);

            if (payload is null || string.IsNullOrWhiteSpace(payload.CompanyCode))
            {
                Log.Warning("CompanyContextMiddleware: invalid payload for {Path}", path);
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            // Validate checksum when present (admin-generated contexts always include one).
            if (payload.IsAdmin)
            {
                if (!payload.ValidateChecksum(key))
                {
                    Log.Warning("CompanyContextMiddleware: checksum validation failed for {Path}", path);
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return;
                }
            }

            context.Items[CompanyContext.HttpContextKey] =
                new CompanyContext(payload.CompanyCode, payload.IsAdmin);

            await next(context);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "CompanyContextMiddleware: decryption failed for {Path}", path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        }
    }

    private static bool IsExempt(string path)
    {
        foreach (var prefix in ExemptPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
