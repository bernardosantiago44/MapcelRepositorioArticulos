namespace MapcelRepositorioArticulos.Exceptions;

/// <summary>
/// Thrown when a logic rule prevents an operation from being completed.
/// </summary>
/// <param name="message"></param>
/// <param name="cause"></param>
public class BusinessRuleException(string message, string cause) : Exception(message)
{
    public string Cause = cause;
}