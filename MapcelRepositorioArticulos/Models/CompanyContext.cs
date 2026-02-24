namespace MapcelRepositorioArticulos.Models;

/// <summary>
/// Resolved company context stored in <see cref="Microsoft.AspNetCore.Http.HttpContext.Items"/>
/// after the middleware decrypts and validates the <c>X-Company-Context</c> header.
/// </summary>
public sealed record CompanyContext(string CompanyCode, bool IsAdmin)
{
    /// <summary>
    /// Key used to store/retrieve the <see cref="CompanyContext"/> in <c>HttpContext.Items</c>.
    /// </summary>
    public const string HttpContextKey = "CompanyContext";
}
