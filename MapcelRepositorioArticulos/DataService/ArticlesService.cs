using System.Data;
using MapcelRepositorioArticulos.Models;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace MapcelRepositorioArticulos.DataService;

public interface IArticlesService
{
    /// <summary>
    /// Fetch all Articles from the SQL Database
    /// matching the given query.
    /// </summary>
    /// <param name="query">ArticleQuery</param>
    /// <param name="cancellationToken"></param>
    /// <returns>PagedResult: ArticleRowDto</returns>
    public Task<PagedResult<ArticleDetailsDto>> GetAsync(ArticleQuery query, CancellationToken cancellationToken);
    
    /// <summary>
    /// Creates a new Article record in the SQL Database
    /// for the given company code with the given request.
    /// </summary>
    /// <param name="companyCode">Guid</param>
    /// <param name="request">CreateArticleRequest</param>
    /// <param name="cancellationToken"></param>
    /// <returns>ArticleRowDto</returns>
    /// <exception cref="ArgumentException"></exception>
    public Task<ArticleDetailsDto> CreateAsync(Guid companyCode, CreateArticleRequest request, CancellationToken cancellationToken);
    
    /// <summary>
    /// Updates all fields of the given article id for
    /// the given company in the SQL Database,
    /// matching the given request.
    /// </summary>
    /// <param name="articleId">int</param>
    /// <param name="companyCode">Guid</param>
    /// <param name="request">UpdateArticleRequest</param>
    /// <param name="cancellationToken"></param>
    /// <returns>ArticleDetailsDto?</returns>
    public Task<ArticleDetailsDto?> UpdateAsync(int articleId, Guid companyCode, UpdateArticleRequest request, CancellationToken cancellationToken);
    
    /// <summary>
    /// Deletes the specified article id within the given company code.
    /// </summary>
    /// <param name="articleId">int</param>
    /// <param name="companyCode">Guid</param>
    /// <param name="cancellationToken"></param>
    /// <returns>True if the operation was successful, false otherwise.</returns>
    public Task<bool> DeleteAsync(int articleId, Guid companyCode, CancellationToken cancellationToken);
    
    Task<int> BulkUpdateSingleTagAsync(
        Guid companyCode,
        int[] articleIds,
        int tagId,
        string action,
        CancellationToken cancellationToken);


}

public sealed class ArticlesService(IConfiguration configuration) : BaseService(configuration), IArticlesService
{
    // -------------------
    // --- SQL Queries ---
    // -------------------
    // TODO: Add date range filters
    private const string SqlSelectArticlesWithQuery = @"
            WITH ArticleBase AS (
                SELECT a.article_id
                FROM [RepositorioArticulos].[dbo].[articles] a
                WHERE a.company_code = @companyCode
                  AND (@status IS NULL OR a.status = @status)
                  AND (@articleId IS NULL OR a.article_id = @articleId)
                  AND (
                        @search IS NULL
                        OR a.title LIKE '%' + @search + '%'
                        OR a.description LIKE '%' + @search + '%'
                      )
                  AND (
                        @tagIds IS NULL OR EXISTS (
                            SELECT 1 FROM [RepositorioArticulos].[dbo].[article_tags] filter_at
                            WHERE filter_at.article_id = a.article_id
                            AND filter_at.tag_id IN (SELECT value FROM STRING_SPLIT(@tagIds, ','))
                        )
                      )
                ORDER BY a.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            )
            SELECT 
                a.article_id,
                a.title,
                a.description,
                a.status,
                a.created_at,
                a.updated_at,
                tag_data.tags,
                file_data.files,
                client_comments,
                external_link
            FROM ArticleBase b
            JOIN [RepositorioArticulos].[dbo].[articles] a ON b.article_id = a.article_id
            OUTER APPLY (
                SELECT STRING_AGG(t.tag_id, ',') AS tags
                FROM [RepositorioArticulos].[dbo].[article_tags] at
                JOIN [RepositorioArticulos].[dbo].[tags] t ON at.tag_id = t.tag_id
                WHERE at.article_id = a.article_id
            ) AS tag_data
            OUTER APPLY (
                SELECT STRING_AGG(fa.file_id, ',') AS files
                FROM [RepositorioArticulos].[dbo].[file_articles] fa
                WHERE fa.article_id = a.article_id
            ) as file_data
            ORDER BY a.created_at DESC;

            -- 2. Get the total count using the EXACT SAME filters
            SELECT COUNT(1)
            FROM [RepositorioArticulos].[dbo].[articles] a
            WHERE a.company_code = @companyCode
              AND (@status IS NULL OR a.status = @status)
              AND (@articleId IS NULL OR a.article_id = @articleId)
              AND (
                    @search IS NULL
                    OR a.title LIKE '%' + @search + '%'
                    OR a.description LIKE '%' + @search + '%'
                  )
              AND (
                    @tagIds IS NULL OR EXISTS (
                        SELECT 1 FROM [RepositorioArticulos].[dbo].[article_tags] filter_at
                        WHERE filter_at.article_id = a.article_id
                        AND filter_at.tag_id IN (SELECT value FROM STRING_SPLIT(@tagIds, ','))
                    )
                  );
        ";
    private const string SqlInsertArticle = @"
        INSERT INTO [RepositorioArticulos].[dbo].[articles]
        (
            company_code,
            title,
            description,
            external_link,
            client_comments,
            status
        )
        OUTPUT INSERTED.article_id
        VALUES
        (
            @CompanyCode,
            @Title,
            @Description,
            @ExternalLink,
            @ClientComments,
            @Status
        );
    ";
    private const string SqlUpdateArticle = @"
        UPDATE [RepositorioArticulos].[dbo].[articles]
        SET
            title = @Title,
            description = @Description,
            external_link = @ExternalLink,
            client_comments = @ClientComments,
            status = @Status,
            updated_at = SYSDATETIME()
        WHERE article_id = @ArticleId
          AND company_code = @CompanyCode;
    ";
    private const string SqlDeleteArticleTags = @"
        DELETE at
        FROM [RepositorioArticulos].[dbo].[article_tags] at
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a ON a.article_id = at.article_id
        WHERE at.article_id = @ArticleId
          AND a.company_code = @CompanyCode;
    ";
    private const string SqlInsertArticleTagsFromCsv = @"
        INSERT INTO [RepositorioArticulos].[dbo].[article_tags] (article_id, tag_id)
        SELECT
            @ArticleId,
            t.tag_id
        FROM string_split(@TagIdsCsv, ',') s
        INNER JOIN [RepositorioArticulos].[dbo].[tags] t
            ON t.tag_id = TRY_CAST(s.value AS int)
           AND t.company_code = @CompanyCode;
    ";
    private const string SqlDeleteFileArticles = @"
        DELETE fa
        FROM [RepositorioArticulos].[dbo].[file_articles] fa
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a ON a.article_id = fa.article_id
        WHERE fa.article_id = @ArticleId
          AND a.company_code = @CompanyCode;";
    private const string SqlDeleteArticle = @"
        DELETE a
        FROM [RepositorioArticulos].[dbo].[articles] a
        WHERE a.article_id = @ArticleId
          AND a.company_code = @CompanyCode;
    ";
    private const string SqlSelectMultipleTags = @"
        SELECT
        t.tag_id,
        t.company_code,
        t.name,
        t.color,
        t.description
    FROM [RepositorioArticulos].[dbo].[tags] AS t
        INNER JOIN @TagIds AS ids ON t.tag_id = ids.Id
    WHERE t.company_code = @CompanyCode
    ORDER BY t.tag_id;
    ";
    private const string SqlBulkAddTagToArticles = @"
        IF NOT EXISTS (SELECT 1 FROM [RepositorioArticulos].[dbo].[tags] WHERE tag_id = @TagId AND company_code = @CompanyCode)
        BEGIN
            SELECT CAST(-1 AS int);
            RETURN;
        END;

        ;WITH ids AS
        (
            SELECT DISTINCT TRY_CAST(value AS int) AS article_id
            FROM string_split(@ArticleIdsCsv, ',')
            WHERE TRY_CAST(value AS int) IS NOT NULL
        )
        INSERT INTO [RepositorioArticulos].[dbo].[article_tags] (article_id, tag_id)
        SELECT a.article_id, @TagId
        FROM [RepositorioArticulos].[dbo].[articles] a
        INNER JOIN ids i ON i.article_id = a.article_id
        WHERE a.company_code = @CompanyCode
          AND NOT EXISTS
          (
              SELECT 1
              FROM [RepositorioArticulos].[dbo].[article_tags] at
              WHERE at.article_id = a.article_id
                AND at.tag_id = @TagId
          );

        SELECT @@ROWCOUNT;
    ";
    private const string SqlBulkRemoveTagFromArticles = @"
        IF NOT EXISTS (SELECT 1 FROM [RepositorioArticulos].[dbo].[tags] WHERE tag_id = @TagId AND company_code = @CompanyCode)
        BEGIN
            SELECT CAST(-1 AS int);
            RETURN;
        END;

        ;WITH ids AS
        (
            SELECT DISTINCT TRY_CAST(value AS int) AS article_id
            FROM string_split(@ArticleIdsCsv, ',')
            WHERE TRY_CAST(value AS int) IS NOT NULL
        )
        DELETE at
        FROM [RepositorioArticulos].[dbo].[article_tags] at
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a ON a.article_id = at.article_id
        INNER JOIN ids i ON i.article_id = a.article_id
        WHERE a.company_code = @CompanyCode
          AND at.tag_id = @TagId;

        SELECT @@ROWCOUNT;
    ";
    private const string SqlInsertFileArticlesFromCsv = @"
        INSERT INTO [RepositorioArticulos].[dbo].[article_tags] (file_id, article_id)
        SELECT
            f.file_id,
            @ArticleId
        FROM string_split(@FileIdsCsv, ',') s
        INNER JOIN [RepositorioArticulos].[dbo].[files] f
            ON f.file_id = TRY_CAST(s.value AS int)
           AND f.company_code = @CompanyCode;
    ";

    
    
    public async Task<PagedResult<ArticleDetailsDto>> GetAsync(ArticleQuery query, CancellationToken cancellationToken)
    {
        var rows = new List<ArticleDetailsDto>();

        if (query is null) throw new ArgumentNullException(nameof(query));
        if (query.Page <= 0) throw new ArgumentOutOfRangeException(nameof(query.Page));
        if (query.PageSize <= 0) throw new ArgumentOutOfRangeException(nameof(query.PageSize));

        int offset = (query.Page - 1) * query.PageSize;

        var companyCode = query.CompanyCode;
        if (companyCode == Guid.Empty)
            throw new ArgumentException("CompanyCode is required.", nameof(query.CompanyCode));

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new SqlCommand(SqlSelectArticlesWithQuery, connection);
        command.CommandType = CommandType.Text;

        // Mandatory parameters
        command.Parameters.Add(new SqlParameter("@offset", SqlDbType.Int) { Value = offset });
        command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = query.PageSize });
        command.Parameters.Add(new SqlParameter("@companyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
        
        // Optional parameters
        command.Parameters.Add(new SqlParameter("@status", SqlDbType.VarChar, 50) { Value = string.IsNullOrWhiteSpace(query.Status) ? DBNull.Value : query.Status });
        command.Parameters.Add(new SqlParameter("@search", SqlDbType.NVarChar, int.MaxValue) { Value = string.IsNullOrWhiteSpace(query.Search) ? DBNull.Value : query.Search });
        command.Parameters.Add(new SqlParameter("@tagIds", SqlDbType.VarChar) { Value = !query.IsTagsFilterAvailable() ? DBNull.Value : query.CleanTagFiltersString() });
        command.Parameters.Add(new SqlParameter("@articleId", SqlDbType.Int) { Value = query.ArticleId == null ? DBNull.Value : query.ArticleId.Value });
        
        int total = 0;
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
        {
            var idPos = reader.GetOrdinal("article_id");
            var titlePos = reader.GetOrdinal("title");
            var descriptionPos = reader.GetOrdinal("description");
            var statusPos = reader.GetOrdinal("status");
            var createdAtPos = reader.GetOrdinal("created_at");
            var updatedAtPos = reader.GetOrdinal("updated_at");
            var tagsPos = reader.GetOrdinal("tags");
            var filesPos = reader.GetOrdinal("files");
            var externalLinkPos = reader.GetOrdinal("external_link");
            var clientCommentsPos = reader.GetOrdinal("client_comments");
            
            // Result set 1: page rows
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {

                rows.Add(new ArticleDetailsDto
                {
                    Id = reader.GetInt32(idPos).ToString(),
                    CompanyCode = companyCode,
                    Title = reader.IsDBNull(titlePos) ? "" : reader.GetString(titlePos),
                    Description = reader.IsDBNull(descriptionPos) ? "" : reader.GetString(descriptionPos),
                    Status = reader.IsDBNull(statusPos) ? "" : reader.GetString(statusPos),
                    CreatedAt = DateOnly.FromDateTime(reader.IsDBNull(createdAtPos) ? DateTime.MinValue : reader.GetDateTime(createdAtPos)),
                    UpdatedAt = DateOnly.FromDateTime(reader.IsDBNull(updatedAtPos) ? DateTime.Now : reader.GetDateTime(updatedAtPos)),
                    Tags = reader.IsDBNull(tagsPos) ? [] : reader.GetString(tagsPos).Split(','),
                    FileIds = reader.IsDBNull(filesPos) ? [] : reader.GetString(filesPos).Split(','),
                    ExternalLink = reader.IsDBNull(externalLinkPos) ? "" : reader.GetString(externalLinkPos),
                    ClientComments =  reader.IsDBNull(clientCommentsPos) ? "" : reader.GetString(clientCommentsPos),
                    CompanyName = ""
                });
            }

            // Result set 2: total
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false))
            {
                if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
            }
        }
        return new PagedResult<ArticleDetailsDto>(rows, total, query.Page, query.PageSize);
        
    }
    
    public async Task<ArticleDetailsDto> CreateAsync(Guid companyCode, CreateArticleRequest request, CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode); // CompanyCode should be a non-empty Guid.
        request.Validate(); // The request must contain a Title and a Status, at least.

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            // 1. Build the 'create new article' command  
            await using var createArticleCommand = new SqlCommand(SqlInsertArticle, connection);
            createArticleCommand.CommandType = CommandType.Text;

            createArticleCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            createArticleCommand.Parameters.Add(new SqlParameter("@Title", SqlDbType.NVarChar, 250) { Value = request.Title.Trim() });
            createArticleCommand.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar) { Value = (object?)request.Description ?? DBNull.Value });
            createArticleCommand.Parameters.Add(new SqlParameter("@ExternalLink", SqlDbType.NVarChar, 500) { Value = (object?)request.ExternalLink ?? DBNull.Value });
            createArticleCommand.Parameters.Add(new SqlParameter("@ClientComments", SqlDbType.NVarChar) { Value = (object?)request.ClientComments ?? DBNull.Value });
            createArticleCommand.Parameters.Add(new SqlParameter("@Status", SqlDbType.VarChar, 50) { Value = request.Status.Trim() });
            
            // Execute the creation
            var articleResult = await createArticleCommand.ExecuteScalarAsync(cancellationToken);
            if (articleResult is null) throw new InvalidOperationException("ArticleService.CreateAsync(Guid:request:token): Failed to create article.");
            var newArticleId = Convert.ToInt32(articleResult);
            
            // If the request carries tags, insert each tag into the article_tags table
            if (request.TagIds is { Length: > 0 }) // TagIds may be null
            {
                // 1.1 Build the 'insert article tags' command
                var csv = string.Join(",", request.TagIds);
                await using var insertArticleTagsCommand = new SqlCommand(SqlInsertArticleTagsFromCsv, connection);
                insertArticleTagsCommand.CommandType = CommandType.Text;
                
                insertArticleTagsCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = newArticleId });
                insertArticleTagsCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
                insertArticleTagsCommand.Parameters.Add(new SqlParameter("@TagIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

                await insertArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);
            }
            
            // If the request carries files, insert each file link into the file_articles table
            if (request.FileIds is { Length: > 0 }) // FileIds may be null
            {
                var csv = string.Join(",", request.FileIds);

                await using var insertFileArticlesCommand = new SqlCommand(SqlInsertFileArticlesFromCsv, connection);
                insertFileArticlesCommand.CommandType = CommandType.Text;

                insertFileArticlesCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = newArticleId });
                insertFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
                insertFileArticlesCommand.Parameters.Add(new SqlParameter("@FileIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

                await insertFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            var created = new ArticleDetailsDto
            {
                Id = newArticleId.ToString(),
                CompanyCode = companyCode,
                Title = request.Title,
                Description = request.Description,
                ClientComments = request.ClientComments,
                Status = request.Status,
                CompanyName = "",
                CreatedAt = new DateOnly(),
                UpdatedAt = new DateOnly(),
                ExternalLink = request.ExternalLink,
                Tags = request.TagIds ?? [],
                TagNames = [],
                FileIds = request.FileIds?.Select(x => x.ToString()).ToArray() ?? Array.Empty<string>()
            };
            return created;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticleService.CreateAsync(Guid:request:token) failed for companyCode={CompanyCode}", companyCode);
            throw;
        }
    }
    
    public async Task<ArticleDetailsDto?> UpdateAsync(int articleId, Guid companyCode, UpdateArticleRequest request, CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);
        ValidateId(articleId);
        request.Validate(); // Must contain Title and Status at least.

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            // 1. Build the 'update article' command
            await using var updateArticleCommand = new SqlCommand(SqlUpdateArticle, connection);
            updateArticleCommand.CommandType = CommandType.Text;

            updateArticleCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
            updateArticleCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            updateArticleCommand.Parameters.Add(new SqlParameter("@Title", SqlDbType.NVarChar, 250) { Value = request.Title.Trim() });
            updateArticleCommand.Parameters.Add(new SqlParameter("@Description", SqlDbType.NVarChar) { Value = (object?)request.Description ?? DBNull.Value });
            updateArticleCommand.Parameters.Add(new SqlParameter("@ExternalLink", SqlDbType.NVarChar, 500) { Value = (object?)request.ExternalLink ?? DBNull.Value });
            updateArticleCommand.Parameters.Add(new SqlParameter("@ClientComments", SqlDbType.NVarChar) { Value = (object?)request.ClientComments ?? DBNull.Value });
            updateArticleCommand.Parameters.Add(new SqlParameter("@Status", SqlDbType.VarChar, 50) { Value = request.Status.Trim() });

            var affected = await updateArticleCommand.ExecuteNonQueryAsync(cancellationToken);
            if (affected == 0) return null; // Not found OR not in tenant.

            // 2. If TagIds is provided:
            //    - null => keep existing tags
            //    - []   => clear all tags
            //    - [..] => replace tags
            if (request.TagIds is not null)
            {
                // 2.1 Delete existing article tags (tenant-safe via join to articles)
                await using var deleteArticleTagsCommand = new SqlCommand(SqlDeleteArticleTags, connection);
                deleteArticleTagsCommand.CommandType = CommandType.Text;

                deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
                deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

                await deleteArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);

                // 2.2 Insert new article tags (if any)
                if (request.TagIds.Length > 0)
                {
                    var csv = string.Join(",", request.TagIds);

                    await using var insertArticleTagsCommand = new SqlCommand(SqlInsertArticleTagsFromCsv, connection);
                    insertArticleTagsCommand.CommandType = CommandType.Text;

                    insertArticleTagsCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
                    insertArticleTagsCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
                    insertArticleTagsCommand.Parameters.Add(new SqlParameter("@TagIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

                    await insertArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);
                }
            }
            
            // 3. If FileIds is provided:
            //    - null => keep existing file links
            //    - []   => clear all file links
            //    - [..] => replace file links
            if (request.FileIds is not null)
            {
                // 3.1 Delete existing file links (tenant-safe via join to articles)
                await using var deleteFileArticlesCommand = new SqlCommand(SqlDeleteFileArticles, connection);
                deleteFileArticlesCommand.CommandType = CommandType.Text;

                deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
                deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

                await deleteFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);

                // 3.2 Insert new file links (if any)
                if (request.FileIds.Length > 0)
                {
                    var csv = string.Join(",", request.FileIds);

                    await using var insertFileArticlesCommand = new SqlCommand(SqlInsertFileArticlesFromCsv, connection);
                    insertFileArticlesCommand.CommandType = CommandType.Text;

                    insertFileArticlesCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
                    insertFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
                    insertFileArticlesCommand.Parameters.Add(new SqlParameter("@FileIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

                    await insertFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);
                }
            }
            
            var updated = new ArticleDetailsDto
            {
                Id = articleId.ToString(),
                CompanyCode = companyCode,
                Title = request.Title,
                Description = request.Description,
                ClientComments = request.ClientComments,
                Status = request.Status,
                CompanyName = "",
                CreatedAt = new DateOnly(),
                UpdatedAt = new DateOnly(),
                ExternalLink = request.ExternalLink,
                Tags = request.TagIds ?? [],      // if null => unknown/unchanged, but kept as [] for DTO consistency
                TagNames = []
            };

            return updated;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticleService.UpdateAsync(int:Guid:request:token) failed for articleId={ArticleId}, companyCode={CompanyCode}", articleId, companyCode);
            throw;
        }
    }
    
    public async Task<bool> DeleteAsync(int articleId, Guid companyCode, CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);
        ValidateId(articleId);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            // 1. Delete file_articles rows for this article (tenant-safe via join to articles)
            await using var deleteFileArticlesCommand = new SqlCommand(SqlDeleteFileArticles, connection);
            deleteFileArticlesCommand.CommandType = CommandType.Text;

            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            await deleteFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);

            // 2. Delete article_tags rows for this article (tenant-safe via join to articles)
            await using var deleteArticleTagsCommand = new SqlCommand(SqlDeleteArticleTags, connection);
            deleteArticleTagsCommand.CommandType = CommandType.Text;

            deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
            deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            await deleteArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);

            // 3. Delete the article row (tenant-safe)
            await using var deleteArticleCommand = new SqlCommand(SqlDeleteArticle, connection);
            deleteArticleCommand.CommandType = CommandType.Text;

            deleteArticleCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.Int) { Value = articleId });
            deleteArticleCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            var deleted = await deleteArticleCommand.ExecuteNonQueryAsync(cancellationToken);
            return deleted != 0;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticleService.DeleteAsync(int:Guid:token) failed for articleId={ArticleId}, companyCode={CompanyCode}", articleId, companyCode);
            throw;
        }
    }
    
    public async Task<int> BulkUpdateSingleTagAsync(
        Guid companyCode,
        int[] articleIds,
        int tagId,
        string action,
        CancellationToken cancellationToken)
    {
        ValidateCompany(companyCode);
        if (articleIds is null || articleIds.Length == 0) throw new ArgumentException("ArticleIds is required.", nameof(articleIds));
        if (tagId <= 0) throw new ArgumentOutOfRangeException(nameof(tagId), "TagId must be > 0.");
        if (string.IsNullOrWhiteSpace(action)) throw new ArgumentException("Action is required.", nameof(action));

        var normalized = action.Trim().ToLowerInvariant();
        if (normalized is not ("add" or "remove")) throw new ArgumentException("Action must be 'add' or 'remove'.", nameof(action));

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        try
        {
            var csv = string.Join(",", articleIds);

            var sql = normalized == "add" ? SqlBulkAddTagToArticles : SqlBulkRemoveTagFromArticles;

            await using var command = new SqlCommand(sql, connection);
            command.CommandType = CommandType.Text;

            command.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
            command.Parameters.Add(new SqlParameter("@TagId", SqlDbType.Int) { Value = tagId });
            command.Parameters.Add(new SqlParameter("@ArticleIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

            var result = await command.ExecuteScalarAsync(cancellationToken);
            if (result is null) throw new InvalidOperationException("ArticleService.BulkUpdateSingleTagAsync: Failed to execute bulk update.");

            var updatedCount = Convert.ToInt32(result);

            // -1 indicates the tag does not exist for this tenant
            if (updatedCount == -1)
                throw new KeyNotFoundException("Tag was not found for the provided companyCode.");

            return updatedCount;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "ArticleService.BulkUpdateSingleTagAsync failed for companyCode={CompanyCode}, tagId={TagId}, action={Action}", companyCode, tagId, action);
            throw;
        }
    }
    
    // ----------- Helper Validation Functions -----------
    private static void ValidateCompany(Guid companyCode)
    {
        if (companyCode == Guid.Empty)
            throw new ArgumentException("companyCode is required and cannot be empty.", nameof(companyCode));
    }

    private static void ValidateId(int articleId)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(articleId, nameof(articleId));
    }
}