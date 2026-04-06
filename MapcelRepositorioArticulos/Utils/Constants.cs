namespace MapcelRepositorioArticulos.Utils;

public static class Constants
{
    /// <summary>
    /// The length of the varchar status column in the table dbo.articles. 
    /// </summary>
    public const int ArticleStatusCharacterLength = 50;
    public const int ArticleTitleCharacterLength = 255;
    public const int FileDescriptionCharacterLength = 255;
    public const int FileExtensionCharacterLength = 10;

    public const int FileUploadBufferSize = 81920; // Best buffer size for file size range of 80 KiB to 50 MiB
}