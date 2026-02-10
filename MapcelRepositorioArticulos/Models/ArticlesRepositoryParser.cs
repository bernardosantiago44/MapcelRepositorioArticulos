using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
namespace MapcelRepositorioArticulos.Models;

public static class ArticlesRepositoryParser
{
    private static readonly JsonSerializerOptions Options = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        Converters =
        {
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) // or null
        },
        IncludeFields = false
    };

    public static RepositoryStore FromJson(string json)
    {
        return JsonSerializer.Deserialize<RepositoryStore>(json, Options);
    }

    public static RepositoryStore FromFile(string path)
    {
        var json = File.ReadAllText(path);
        return FromJson(json);
    }

    public static string ToJson(RepositoryStore repo)
    {
        return JsonSerializer.Serialize(repo, Options);
    }

    public static void ToFile(RepositoryStore repo, string path)
    {
        var json = ToJson(repo);
        File.WriteAllText(path, json);
    }
}