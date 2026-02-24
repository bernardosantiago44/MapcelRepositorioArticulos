using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace MapcelRepositorioArticulos.DataService;

public static class SymmetricCipher
{
    public static string Encrypt(string text, string key)
    {
        if (string.IsNullOrEmpty(key))
            throw new ArgumentException("Key must have valid value.", nameof(key));
        if (string.IsNullOrEmpty(text))
            throw new ArgumentException("The text must have valid value.", nameof(text));

        var convertedText = ToBase64Url(text);
        var plainBytes = Encoding.UTF8.GetBytes(convertedText);

        using var sha = SHA512.Create();
        var aesKey = new byte[24];
        Buffer.BlockCopy(sha.ComputeHash(Encoding.UTF8.GetBytes(key)), 0, aesKey, 0, 24);

        using var aes = Aes.Create();
        if (aes == null) throw new ArgumentException("Parameter must not be null.", nameof(aes));

        aes.Key = aesKey;

        using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
        using var resultStream = new MemoryStream();

        using (var crypto = new CryptoStream(resultStream, encryptor, CryptoStreamMode.Write))
        {
            crypto.Write(plainBytes, 0, plainBytes.Length);
            crypto.FlushFinalBlock();
        }

        var ciphertext = resultStream.ToArray();

        var combined = new byte[aes.IV.Length + ciphertext.Length];
        Buffer.BlockCopy(aes.IV, 0, combined, 0, aes.IV.Length);
        Buffer.BlockCopy(ciphertext, 0, combined, aes.IV.Length, ciphertext.Length);

        return Convert.ToBase64String(combined);
    }

    public static string Decrypt(string encryptedText, string key)
    {
        if (string.IsNullOrEmpty(key))
            throw new ArgumentException("Key must have valid value.", nameof(key));
        if (string.IsNullOrEmpty(encryptedText))
            throw new ArgumentException("The encrypted text must have valid value.", nameof(encryptedText));

        var convertedText = FromBase64Url(encryptedText);
        var combined = Convert.FromBase64String(encryptedText);

        using var sha = SHA512.Create();
        var aesKey = new byte[24];
        Buffer.BlockCopy(sha.ComputeHash(Encoding.UTF8.GetBytes(key)), 0, aesKey, 0, 24);

        using var aes = Aes.Create();
        if (aes == null) throw new ArgumentException("Parameter must not be null.", nameof(aes));

        aes.Key = aesKey;

        var ivLen = aes.BlockSize / 8; // 16 bytes for AES
        if (combined.Length <= ivLen)
            throw new CryptographicException("Invalid encrypted payload.");

        var iv = new byte[ivLen];
        Buffer.BlockCopy(combined, 0, iv, 0, ivLen);

        var ciphertext = new byte[combined.Length - ivLen];
        Buffer.BlockCopy(combined, ivLen, ciphertext, 0, ciphertext.Length);

        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
        using var resultStream = new MemoryStream();

        using (var crypto = new CryptoStream(resultStream, decryptor, CryptoStreamMode.Write))
        {
            crypto.Write(ciphertext, 0, ciphertext.Length);
            crypto.FlushFinalBlock(); // this is where padding is validated
        }

        return Encoding.UTF8.GetString(resultStream.ToArray());
    }
    
    static string ToBase64Url(string base64)
        => base64.Replace('+', '-').Replace('/', '_').TrimEnd('=');
    
    static string FromBase64Url(string base64Url)
    {
        var s = base64Url.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return s;
    }
}