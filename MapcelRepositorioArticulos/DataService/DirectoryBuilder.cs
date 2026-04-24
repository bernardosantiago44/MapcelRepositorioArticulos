using System.Text;
using MapcelRepositorioArticulos.Models;
using Serilog.Core;
using Constants = MapcelRepositorioArticulos.Utils.Constants;

namespace MapcelRepositorioArticulos.DataService;

public class DirectoryBuilder(IWebHostEnvironment env)
{
    private readonly string _articlesRootPath = Path.Combine(env.WebRootPath, ArticlesSubdirectoryName);
    private const string ArticlesSubdirectoryName = "articles";

    /// <summary>
    /// Get the relative Article's master directory string path for the given companyCode.
    /// </summary>
    /// <param name="companyCode">Guid of the company hosting the article</param>
    /// <returns>The string of the subdirectory: /{companyCode}</returns>
    private string GetArticlesDirectoryPath(Guid companyCode)
    {
        ValidateCompanyCode(companyCode);

        return Path.Combine(_articlesRootPath, companyCode.ToString());
    }

    /// <summary>
    /// Creates the articles' master subdirectory for the given companyCode if it doesn't exist already.
    /// </summary>
    /// <param name="companyCode">Guid of the company</param>
    /// <returns>The company's Articles subdirectory relative path</returns>
    public string EnsureArticlesDirectoryPathExists(Guid companyCode)
    {
        var companyDirectoryPath = GetArticlesDirectoryPath(companyCode);

        Directory.CreateDirectory(companyDirectoryPath);

        return companyDirectoryPath;
    }

    /// <summary>
    /// Get the specific article's subdirectory string path for the given company code and article id. 
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <returns>String of the article's subdirectory: /{companyCode}/{articleId}</returns>
    private string GetArticleDirectoryPath(Guid companyCode, Guid articleId)
    {
        ValidateArticleId(articleId);

        var companyDirectoryPath = GetArticlesDirectoryPath(companyCode);
        return Path.Combine(companyDirectoryPath, articleId.ToString());
    }

    /// <summary>
    /// Creates the specific article's subdirectory for the given company code and article id
    /// if it doesn't exist already.
    /// Creates with it the /images and /files subdirectories inside the article's directory.
    /// Creates the description's field empty HTML file 
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <returns>The article's subdirectory: /{companyCode}/{articleId}</returns>
    public string EnsureArticleDirectoryStructureExists(Guid companyCode, Guid articleId)
    {
        var articleDirectoryPath = GetArticleDirectoryPath(companyCode, articleId);

        Directory.CreateDirectory(articleDirectoryPath);
        Directory.CreateDirectory(GetArticleImagesDirectoryPath(companyCode, articleId));
        Directory.CreateDirectory(GetArticleFilesDirectoryPath(companyCode, articleId));

        var descriptionFilePath = Path.Combine(articleDirectoryPath, "description.txt");

        if (!File.Exists(descriptionFilePath))
        {
            File.WriteAllText(descriptionFilePath, string.Empty);
        }

        return articleDirectoryPath;
    }

    /// <summary>
    /// Returns the path for the HTML description file for the given companyCode and articleId. 
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <returns></returns>
    private string GetArticleDescriptionFilePath(Guid companyCode, Guid articleId)
    {
        var articleDirectoryPath = GetArticleDirectoryPath(companyCode, articleId);
        return Path.Combine(articleDirectoryPath, "description.txt");
    }

    /// <summary>
    /// Lists and returns all article's linked files and images in a key-value map of type:name.
    /// Only those files attached to this article when it was created are returned.
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <returns>Dictionary {"files": [], "images": []}</returns>
    public Dictionary<string, List<string>> GetArticleFiles(Guid companyCode, Guid articleId)
    {
        var filesDirectory = GetArticleFilesDirectoryPath(companyCode, articleId);
        var imagesDirectory =  GetArticleImagesDirectoryPath(companyCode, articleId);
        var result = new Dictionary<string, List<string>> { { "files", [] }, { "images", [] } };

        foreach (var file in Directory.EnumerateFiles(filesDirectory).Select(Path.GetFileNameWithoutExtension))
        {
            if (file != null) result["files"].Add(file);
        }
        
        foreach (var image in Directory.EnumerateFiles(imagesDirectory).Select(Path.GetFileNameWithoutExtension))
        {
            if (image != null) result["images"].Add(image);
        }

        return result;
    }

    /// <summary>
    /// Returns the article's /images subdirectory for the given companyCode and articleId. 
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <returns></returns>
    private string GetArticleImagesDirectoryPath(Guid companyCode, Guid articleId)
    {
        var articleDirectoryPath = GetArticleDirectoryPath(companyCode, articleId);
        return Path.Combine(articleDirectoryPath, "images");
    }

    public string GetArticleImageFilePath(Guid companyCode, Guid articleId, string imageName)
    {
        var imagesDirectoryPath = GetArticleImagesDirectoryPath(companyCode, articleId);
        return Path.Combine(imagesDirectoryPath, imageName);
    }

    public string GetArticleFilePath(Guid companyCode, Guid articleId, string fileName)
    {
        var filesDirectoryPath = GetArticleFilesDirectoryPath(companyCode, articleId);
        return Path.Combine(filesDirectoryPath, fileName);
    }

    /// <summary>
    /// Returns the article's /files subdirectory for the given companyCode and articleId.
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <returns></returns>
    private string GetArticleFilesDirectoryPath(Guid companyCode, Guid articleId)
    {
        var articleDirectoryPath = GetArticleDirectoryPath(companyCode, articleId);
        return Path.Combine(articleDirectoryPath, "files");
    }

    /// <summary>
    /// Retrieves the article's HTML description, or empty if not found. 
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <returns>String: HTML content</returns>
    public async Task<string> GetArticleDescriptionHtml(Guid companyCode, Guid articleId)
    {
        ValidateCompanyCode(companyCode);
        ValidateArticleId(articleId);
        
        var descriptionFilePath = GetArticleDescriptionFilePath(companyCode, articleId);
        if (!File.Exists(descriptionFilePath))
        {
            return string.Empty;
        }
        
        var html = await File.ReadAllTextAsync(descriptionFilePath);
        return html;
    }

    /// <summary>
    /// Writes the given HTML content to the article's description file path.
    /// </summary>
    /// <param name="companyCode"></param>
    /// <param name="articleId"></param>
    /// <param name="descriptionHtml">HTML Content to write</param>
    /// <param name="cancellationToken"></param>
    /// <exception cref="OperationCanceledException"></exception>
    public async Task SaveArticleDescriptionHtml(
        Guid companyCode, 
        Guid articleId, 
        string? descriptionHtml, 
        CancellationToken cancellationToken)
    {
        ValidateCompanyCode(companyCode);
        ValidateArticleId(articleId);
        
        var descriptionFilePath = GetArticleDescriptionFilePath(companyCode, articleId);
        await File.WriteAllTextAsync(
            path: descriptionFilePath, 
            contents: descriptionHtml, 
            encoding: new UTF8Encoding(), 
            cancellationToken
        );
    }

    /// <summary>
    /// Saves the provided files in the collection to the article directory under the given company code.
    /// </summary>
    /// <param name="companyCode">Company's UUID</param>
    /// <param name="articleId">Article's UUID</param>
    /// <param name="files">collection of non-image files to be uploaded.</param>
    /// <param name="cancellationToken"></param>
    /// <exception cref="ArgumentException">if companyCode or articleId are invalid.</exception>
    public async Task SaveArticleFiles(Guid companyCode, Guid articleId, List<FileUploadDto> files,
        CancellationToken cancellationToken)
    {
        if (files.Count == 0) return;
        ValidateCompanyCode(companyCode);
        ValidateArticleId(articleId);
        
        foreach (var fileUpload in files)
        {
            var filePath = GetArticleFilePath(companyCode, articleId, fileUpload.File.FileName);

            await using var fs = new FileStream(
                filePath,
                FileMode.Create,
                FileAccess.Write,
                FileShare.None,
                bufferSize: Constants.FileUploadBufferSize, 
                useAsync: true);
            await fileUpload.File.CopyToAsync(fs, cancellationToken);
        }
    }

    public async Task SaveArticleImages(Guid companyCode, Guid articleId, List<FileUploadDto> images,
        CancellationToken cancellationToken)
    {
        if (images.Count == 0) return;
        ValidateCompanyCode(companyCode);
        ValidateArticleId(articleId);
        
        foreach (var imageUpload in images)
        {
            var imagePath = GetArticleImageFilePath(companyCode, articleId, imageUpload.File.FileName);
            await using var fs = new FileStream(
                imagePath,
                FileMode.Create,
                FileAccess.Write,
                FileShare.None,
                bufferSize: Constants.FileUploadBufferSize,
                useAsync:true);
            await imageUpload.File.CopyToAsync(fs, cancellationToken);
        }
    }

    public void DeleteArticle(Guid companyCode, Guid articleId)
    {
        ValidateCompanyCode(companyCode);
        ValidateArticleId(articleId);
        
        var articlePath = GetArticleDirectoryPath(companyCode, articleId);
        if (!Directory.Exists(articlePath)) return;
        Directory.Delete(articlePath, true);
    }
    
    /// <summary>
    /// Validates the provided companyCode is not null or empty.
    /// </summary>
    /// <param name="companyCode"></param>
    /// <exception cref="ArgumentException">If the companyCode is null or empty.</exception>
    private static void ValidateCompanyCode(Guid companyCode)
    {
        if (companyCode == Guid.Empty)
            throw new ArgumentException("Company code cannot be empty.", nameof(companyCode));
    }

    /// <summary>
    /// Validates the provided articleId is not null or empty.
    /// </summary>
    /// <param name="articleId"></param>
    /// <exception cref="ArgumentException">If the articleId is null or empty.</exception>
    private static void ValidateArticleId(Guid articleId)
    {
        if (articleId == Guid.Empty)
            throw new ArgumentException("Article id cannot be empty.", nameof(articleId));
    }
}