using MapcelRepositorioArticulos.Models;
using System.Data;
using System.Text;
using Microsoft.Data.SqlClient;
using Constants = MapcelRepositorioArticulos.Utils.Constants;

namespace MapcelRepositorioArticulos.DataService;

public sealed class IntegratedArticleService(IConfiguration configuration, IWebHostEnvironment env, DirectoryBuilder directoryBuilder) : BaseService(configuration), IArticlesService
{
    private readonly string _articlesRootPath = Path.Combine(env.IsDevelopment() ? env.WebRootPath : env.ContentRootPath, "articles");

    private const string SqlSelectArticlesWithQuery = """
        SELECT
            a.article_id,
            a.title,
            a.description,
            a.status,
            a.created_at,
            a.updated_at,
            a.client_comments,
            a.external_link,
            (
                SELECT STRING_AGG(CONVERT(varchar(36), at.tag_id), ',')
                FROM [RepositorioArticulos].[dbo].[article_tags] at
                WHERE at.article_id = a.article_id
            ) AS tags
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
                    SELECT 1
                    FROM [RepositorioArticulos].[dbo].[article_tags] at_filter
                    WHERE at_filter.article_id = a.article_id
                      AND at_filter.tag_id IN (
                          SELECT TRY_CAST(value AS int)
                          FROM STRING_SPLIT(@tagIds, ',')
                          WHERE TRY_CAST(value AS int) IS NOT NULL
                      )
                )
              )
        ORDER BY a.created_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
        
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
                    SELECT 1
                    FROM [RepositorioArticulos].[dbo].[article_tags] at_filter
                    WHERE at_filter.article_id = a.article_id
                      AND at_filter.tag_id IN (
                          SELECT TRY_CAST(value AS int)
                          FROM STRING_SPLIT(@tagIds, ',')
                          WHERE TRY_CAST(value AS int) IS NOT NULL
                      )
                )
              );
        """;
    private const string SqlInsertArticle = """
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
        
    """;
    private const string SqlInsertArticleTagsFromCsv = """
       INSERT INTO [RepositorioArticulos].[dbo].[article_tags] (article_id, tag_id)
       SELECT
           @ArticleId,
           t.tag_id
       FROM string_split(@TagIdsCsv, ',') s
       INNER JOIN [RepositorioArticulos].[dbo].[tags] t
           ON t.tag_id = TRY_CAST(s.value AS int)
          AND t.company_code = @CompanyCode;
   
    """;
    private const string SqlInsertFileArticlesFromCsv = """
        INSERT INTO [RepositorioArticulos].[dbo].[file_articles] (file_id, article_id)
        SELECT
            f.file_id,
            @ArticleId
        FROM string_split(@FileIdsCsv, ',') s
        INNER JOIN [RepositorioArticulos].[dbo].[files] f
            ON f.file_id = TRY_CAST(s.value AS int)
           AND f.company_code = @CompanyCode;
    """;
    private const string SqlUpdateArticle = """
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
    """;
    private const string SqlDeleteArticleTags = """
        DELETE at
        FROM [RepositorioArticulos].[dbo].[article_tags] at
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a ON a.article_id = at.article_id
        WHERE at.article_id = @ArticleId
          AND a.company_code = @CompanyCode;
    """;
    private const string SqlDeleteFileArticles = """
        DELETE fa
        FROM [RepositorioArticulos].[dbo].[file_articles] fa
        INNER JOIN [RepositorioArticulos].[dbo].[articles] a ON a.article_id = fa.article_id
        WHERE fa.article_id = @ArticleId
          AND a.company_code = @CompanyCode;
    """;
    
    /// <summary>
    /// Gets the Articles matching the given query.
    /// </summary>
    /// <param name="query"></param>
    /// <param name="cancellationToken"></param>
    /// <exception cref="ArgumentException">If the given query is null or invalid.</exception>
    /// <exception cref="SqlException">Any exception thrown by the SQL Service</exception>
    /// <returns></returns>
    public async Task<PagedResult<ArticleDetailsDto>> GetAsync(ArticleQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        query.ValidateQuery();
        
        var offset = (query.Page - 1) * query.PageSize;
        
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        
        await  using var command = new SqlCommand(SqlSelectArticlesWithQuery, connection);
        command.CommandType = CommandType.Text;
        
        // Mandatory Parameters
        command.Parameters.Add( new SqlParameter("@offset", SqlDbType.Int) { Value = offset } );
        command.Parameters.Add( new SqlParameter("@pageSize", SqlDbType.Int) { Value = query.PageSize } );
        command.Parameters.Add( new SqlParameter("@companyCode", SqlDbType.UniqueIdentifier) { Value = query.CompanyCode } );
        
        // Optional Parameters
        command.Parameters.Add(
            new SqlParameter("@status", SqlDbType.VarChar, Constants.ArticleStatusCharacterLength /*50*/)
            {
                Value = string.IsNullOrEmpty(query.Status) ? DBNull.Value : query.Status
            } 
        );
        command.Parameters.Add(
            new SqlParameter("@search", SqlDbType.NVarChar, int.MaxValue)
            {
                Value = string.IsNullOrWhiteSpace(query.Search) ? DBNull.Value : query.Search 
                
            }
        );
        command.Parameters.Add(
            new SqlParameter("@tagIds", SqlDbType.VarChar)
            {
                Value = !query.IsTagsFilterAvailable() ? DBNull.Value : query.CleanTagFiltersString()
            }
        );
        command.Parameters.Add(
            new SqlParameter("@articleId", SqlDbType.UniqueIdentifier)
            { 
                Value = query.ArticleId == null ? DBNull.Value : query.ArticleId.Value
            }
        );
        
        var articles = new List<ArticleDetailsDto>();
        string? htmlDescription = null;

        // Retrieve article description only for getById endpoint
        if (query.ArticleId.HasValue)
            htmlDescription = await directoryBuilder.GetArticleDescriptionHtml(query.CompanyCode, query.ArticleId.Value);

        var total = 0;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            articles.Add(new ArticleDetailsDto
            {
                Id = reader.GetGuid(0),
                CompanyCode = query.CompanyCode,
                Title = reader.GetString(1),
                Description = htmlDescription,
                Status = reader.GetString(3),
                CreatedAt = DateOnly.FromDateTime(reader.GetDateTime(4)),
                UpdatedAt = DateOnly.FromDateTime(reader.GetDateTime(5)),
                ClientComments = reader.IsDBNull(6) ? "" : reader.GetString(6),
                ExternalLink =  reader.IsDBNull(7) ? "" : reader.GetString(7),
                Tags = reader.IsDBNull(8) ? [] : reader.GetString(8).Split(','),
                CompanyName = "",
                FileIds = [] // TODO: Insert file ids
            });
        }

        if (!await reader.NextResultAsync(cancellationToken).ConfigureAwait(false))
            return new PagedResult<ArticleDetailsDto>(articles, total, query.Page, query.PageSize);
        
        if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) total = reader.GetInt32(0);
        return new PagedResult<ArticleDetailsDto>(articles, total, query.Page, query.PageSize);
    }

    public async Task<ArticleDetailsDto> CreateAsync(
        Guid companyCode, 
        CreateArticleRequest request, 
        CancellationToken cancellationToken
    )
    {
        ValidateCompanyCode(companyCode);
        request.Validate();
        
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        
        await using var createArticleCommand = new SqlCommand(SqlInsertArticle, connection);
        createArticleCommand.CommandType = CommandType.Text;

        createArticleCommand.Parameters.Add(
            new SqlParameter("@companyCode", SqlDbType.UniqueIdentifier) { Value = companyCode } 
        );
        createArticleCommand.Parameters.Add(
            new SqlParameter("@Title", SqlDbType.NVarChar, size: Constants.ArticleTitleCharacterLength)
            {
                Value = request.Title.Trim()
            }
        );
        createArticleCommand.Parameters.Add(
            new SqlParameter("@Description", SqlDbType.NVarChar, size: -1)
            {
                Value = (object?)request.Description ?? DBNull.Value
            }
        );
        createArticleCommand.Parameters.Add(
            new SqlParameter("@ExternalLink", SqlDbType.NVarChar, size: -1)
            {
                Value = (object?)request.ExternalLink ?? DBNull.Value
            }
        );
        createArticleCommand.Parameters.Add(
            new SqlParameter("@ClientComments", SqlDbType.NVarChar, size: -1)
            {
                Value = (object?)request.ClientComments ?? DBNull.Value
            });
        createArticleCommand.Parameters.Add(
            new SqlParameter("@Status", SqlDbType.VarChar, 50)
            {
                Value = request.Status.Trim()
            }
        );

        var articleResult = await createArticleCommand.ExecuteScalarAsync(cancellationToken);
        if (articleResult == null || articleResult == DBNull.Value) 
            throw new InvalidOperationException("ArticleService.CreateAsync: Failed to create article.");
        
        var insertedId = articleResult switch
        {
            Guid g => g,
            string s when Guid.TryParse(s, out var parsed) => parsed,
            _ => throw new InvalidCastException(
                $"Expected Guid result, but got {articleResult.GetType().FullName}."
            )
        };
        
        directoryBuilder.EnsureArticlesDirectoryPathExists(companyCode);
        directoryBuilder.EnsureArticleDirectoryStructureExists(companyCode, insertedId);
        await directoryBuilder.SaveArticleDescriptionHtml(
            companyCode, 
            insertedId, 
            request.Description, 
            cancellationToken
        );
        
        if (request.TagIds is { Length: > 0 }) // TagIds may be null
        {
            // 1.1 Build the 'insert article tags' command
            var csv = string.Join(",", request.TagIds);
            await using var insertArticleTagsCommand = new SqlCommand(SqlInsertArticleTagsFromCsv, connection);
            insertArticleTagsCommand.CommandType = CommandType.Text;
            
            insertArticleTagsCommand.Parameters.Add(
                new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = insertedId }
            );
            insertArticleTagsCommand.Parameters.Add(
                new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode }
            );
            insertArticleTagsCommand.Parameters.Add(
                new SqlParameter("@TagIdsCsv", SqlDbType.VarChar, -1) { Value = csv }
            );

            await insertArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);
        }
        
        // If the request carries files, insert each file link into the file_articles table
        if (request.FileIds is { Length: > 0 }) // FileIds may be null
        {
            var csv = string.Join(",", request.FileIds);

            await using var insertFileArticlesCommand = new SqlCommand(SqlInsertFileArticlesFromCsv, connection);
            insertFileArticlesCommand.CommandType = CommandType.Text;

            insertFileArticlesCommand.Parameters.Add(
                new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = insertedId }
            );
            insertFileArticlesCommand.Parameters.Add(
                new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode }
            );
            insertFileArticlesCommand.Parameters.Add(
                new SqlParameter("@FileIdsCsv", SqlDbType.VarChar, -1) { Value = csv }
            );

            await insertFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        var created = new ArticleDetailsDto
        {
            Id = insertedId,
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
            FileIds = request.FileIds?.Select(x => x.ToString()).ToArray() ?? []
        };
        return created;
    }

    public async Task<ArticleDetailsDto?> UpdateAsync(Guid articleId, Guid companyCode, UpdateArticleRequest request, CancellationToken cancellationToken)
    {
        ValidateCompanyCode(articleId);
        ValidateArticleId(articleId);
        request.Validate();
        
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);
        
        await using var updateArticleCommand = new SqlCommand(SqlUpdateArticle, connection);
        updateArticleCommand.CommandType = CommandType.Text;
        
        updateArticleCommand.Parameters.Add(
            new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId }
        );
        updateArticleCommand.Parameters.Add(
            new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode }
        );
        updateArticleCommand.Parameters.Add(
            new SqlParameter("@Title", SqlDbType.NVarChar, size: Constants.ArticleTitleCharacterLength) { Value = request.Title.Trim() }
        );
        updateArticleCommand.Parameters.Add(
            new SqlParameter("@Description", SqlDbType.NVarChar, size: -1)
            {
                Value = (object?)request.Description ?? DBNull.Value
            }
        );
        updateArticleCommand.Parameters.Add(
            new SqlParameter("@ExternalLink", SqlDbType.NVarChar, size: -1)
            {
                Value = (object?)request.ExternalLink ?? DBNull.Value
            }
        );
        updateArticleCommand.Parameters.Add(
            new SqlParameter("@ClientComments", SqlDbType.NVarChar, size: -1)
            {
                Value = (object?)request.ClientComments ?? DBNull.Value
            }
        );
        updateArticleCommand.Parameters.Add(
            new SqlParameter("@Status", SqlDbType.VarChar, size: Constants.ArticleStatusCharacterLength)
            {
                Value = request.Status.Trim()
            }
        );

        var affected = await updateArticleCommand.ExecuteNonQueryAsync(cancellationToken);
        if (affected == 0) return null;
        
        // Delete tags and repopulate them
        if (request.TagIds is not null)
        {
            // 2.1 Delete existing article tags (tenant-safe via join to articles)
            await using var deleteArticleTagsCommand = new SqlCommand(SqlDeleteArticleTags, connection);
            deleteArticleTagsCommand.CommandType = CommandType.Text;

            deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
            deleteArticleTagsCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            await deleteArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);

            // 2.2 Insert new article tags (if any)
            if (request.TagIds.Length > 0)
            {
                var csv = string.Join(",", request.TagIds);

                await using var insertArticleTagsCommand = new SqlCommand(SqlInsertArticleTagsFromCsv, connection);
                insertArticleTagsCommand.CommandType = CommandType.Text;

                insertArticleTagsCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
                insertArticleTagsCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
                insertArticleTagsCommand.Parameters.Add(new SqlParameter("@TagIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

                await insertArticleTagsCommand.ExecuteNonQueryAsync(cancellationToken);
            }
        }
        
        // Delete files and repopulate them 
        if (request.FileIds is not null)
        {
            // 3.1 Delete existing file links (tenant-safe via join to articles)
            await using var deleteFileArticlesCommand = new SqlCommand(SqlDeleteFileArticles, connection);
            deleteFileArticlesCommand.CommandType = CommandType.Text;

            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
            deleteFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });

            await deleteFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);

            // 3.2 Insert new file links (if any)
            if (request.FileIds.Length > 0)
            {
                var csv = string.Join(",", request.FileIds);

                await using var insertFileArticlesCommand = new SqlCommand(SqlInsertFileArticlesFromCsv, connection);
                insertFileArticlesCommand.CommandType = CommandType.Text;

                insertFileArticlesCommand.Parameters.Add(new SqlParameter("@ArticleId", SqlDbType.UniqueIdentifier) { Value = articleId });
                insertFileArticlesCommand.Parameters.Add(new SqlParameter("@CompanyCode", SqlDbType.UniqueIdentifier) { Value = companyCode });
                insertFileArticlesCommand.Parameters.Add(new SqlParameter("@FileIdsCsv", SqlDbType.VarChar, -1) { Value = csv });

                await insertFileArticlesCommand.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        var updated = new ArticleDetailsDto
        {
            Id = articleId,
            CompanyCode = companyCode,
            Title = request.Title,
            Description = request.Description,
            ClientComments = request.ClientComments,
            Status = request.Status.Trim(),
            CompanyName = "",
            CreatedAt = new DateOnly(),
            UpdatedAt = new DateOnly(),
            ExternalLink = request.ExternalLink,
            Tags = request.TagIds ?? [],
            TagNames = []
        };

        return updated;
    }

    public async Task<bool> DeleteAsync(Guid articleId, Guid companyCode, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public async Task<int> BulkUpdateSingleTagAsync(Guid companyCode, int[] articleIds, int tagId, string action,
        CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public async Task<ArticleDetailsDto> UpdateAggregateAsync(UpdateArticleCommand command, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
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