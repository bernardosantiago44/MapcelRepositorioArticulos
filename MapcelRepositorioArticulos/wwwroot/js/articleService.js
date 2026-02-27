/**
 * Article Service Module
 * Provides Promise-based data fetching methods for companies, tags, and articles with API integration
 */

const ArticleService = (function() {
  'use strict';
  
  let tagCache = new Map();  // Separate cache for tags by company
  let companiesCache = new Map(); // Company map cache
  let articlesCache = new Map(); // Article map cache (keyed by article ID)
  
  /**
   * Clear the data cache (useful for development/testing)
   */
  function clearCache() {
    tagCache.clear();
    companiesCache.clear();
    articlesCache.clear();
  }
  
  /**
   * Clear only the tag cache (useful when tags are modified)
   */
  function clearTagCache() {
    tagCache.clear();
  }

  function getTagCache() {
    return tagCache;
  }

  function clearCompaniesCache() {
    companiesCache.clear();
  }
  
  function getArticlesCache() {
    return articlesCache;
  }

  
  /**
   * Get tags specific to a company from the new centralized tags array
   * @param {string} companyId - The company ID to filter tags by
   * @returns {Promise<Array<{id: string, name: string, color: string, description: string, companyId: string}>>} Promise resolving to array of tags
   */
  function getTags(companyId) {
    // Check cache first
    if (tagCache && tagCache.has(companyId)) {
      return Promise.resolve(tagCache.get(companyId));
    }

    return fetch(`${API_BASE_URL}/tags/${encodeURIComponent(companyId)}`, {
      headers: { "Accept": "application/json" }
    })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Failed to load tags: " + res.status);
      }

      const companyTags = res.json();
      return companyTags;
    })
    .then(function (companyTags) {
      // Cache the tags for this company
      tagCache.set(companyId, companyTags);
      return companyTags;
    });
  }
  
  /**
   * Get a tag by its ID
   * @param {string} tagId - The tag ID
   * @returns {Promise<Object|null>} Promise resolving to tag object or null
   */
  function getTagById(tagId) {
    // Check if tag is in cache
    if (tagCache) {
      for (const companyId of tagCache.keys()) {
        const tags = tagCache.get(companyId);
        const tag = tags.find(t => t.id === tagId);
        if (tag) {
          return Promise.resolve(tag);
        }
      }
    }

    // Otherwise, fetch specific one from server
    return fetch(`${API_BASE_URL}/tags/${encodeURIComponent(tagId)}`, {
      headers: { "Accept": "application/json" }
    })
    .then(function (res) {
      if (res.status === 404) return null;

      if (!res.ok) {
        throw new Error("Failed to load tag: " + res.status);
      }

      return res.json();
    });
  }
  
  /**
   * Create a new tag (POST equivalent)
   * @param {Object} tagData - Tag data object {name, color, description, companyId}
   * @returns {Promise<{status: string, data: Object}>} Promise resolving to the created tag
   */
  function createTag(tagData) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const raw = JSON.stringify(tagData);

    const requestOptions = {
      method: "POST",
      headers: headers,
      body: raw,
      redirect: "follow"
    };

    return fetch(`${API_BASE_URL}/tags?companyCode=${encodeURIComponent(tagData.companyId)}`, requestOptions)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to create tag: " + response.status);
      }
      return response.json();
    })
    .then(function (result) {
      // Clear tag cache to force refresh on next getTags call
      clearTagCache();
      return { status: "success", data: result };
    })
    .catch(function (error) {
      console.error("Error creating tag:", error);
      throw error;
    });
  }
  
  /**
   * Update an existing tag (PUT equivalent)
   * @param {string} tagId - Tag ID to update
   * @param {Object} tagData - Updated tag data {name, color, description}
   * @returns {Promise<{status: string, data: Object}>} Promise resolving to the updated tag
   */
  function updateTag(tagId, tagData) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const raw = JSON.stringify(tagData);

    const requestOptions = {
      method: "PUT",
      headers: headers,
      body: raw,
      redirect: "follow"
    };

    return fetch(`${API_BASE_URL}/tags/${tagId}`, requestOptions)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to update tag: " + response.status);
      }
      return response.json();
    })
    .then(function (result) {
      // Clear tag cache to force refresh on next getTags call
      clearTagCache();
      return { status: "success", data: result };
    })
    .catch(function (error) {
      console.error("Error updating tag:", error);
      throw error;
    });
  }
  
  /**
   * Delete a tag (DELETE equivalent)
   * @param {string} tagId - Tag ID to delete
   * @returns {Promise<{status: string}>} Promise resolving to status
   */
  function deleteTag(tagId) {
    const requestOptions = {
      method: "DELETE",
      redirect: "follow"
    };

    return fetch(`${API_BASE_URL}/tags/${tagId}`, requestOptions)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to delete tag: " + response.status);
      }
      // Clear tag cache to force refresh on next getTags call
      clearTagCache();
      return { status: "success" };
    })
    .catch(function (error) {
      console.error("Error deleting tag:", error);
      throw error;
    });
  }
  
  /**
   * Get articles filtered by company ID
   * Articles will have their tag IDs resolved to full tag objects
   * @param {object} params - Parameters for filtering articles
   * @returns {Promise<Array<Article>>} Promise resolving to array of filtered articles
   */
  async function getArticles(params = {}) {
    const qs = new URLSearchParams();

    // FIX: ensure search is string, not function
    const searchValue =
      typeof params.search === "function"
        ? params.search()              // if caller passed function
        : params.search;

    if (searchValue && String(searchValue).trim() !== "")
      qs.set("search", String(searchValue).trim());

    if (params.status && params.status !== "Todos")
      qs.set("status", params.status);

    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);

    if (params.tagId && params.tagId !== "Todas")
      qs.set("tagId", params.tagId);

    qs.set("page", String(params.page ?? 1));
    qs.set("pageSize", String(params.pageSize ?? 50));

    const url = `/api/articles/${encodeURIComponent(params.companyId)}?${qs.toString()}`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!res.ok) throw new Error(`getArticles failed: ${res.status}`);

    const response = await res.json();
    const allArticles = response.data || [];

    const tags = await getTags(params.companyId);

    // Resolve tag IDs to full tag objects
    const articlesWithResolvedTags = allArticles.map(article => {
      // Check if article.tags exists and is an array
      if (Array.isArray(article.tags)) {
        const resolvedTags = article.tags
          .map(tagId => tags.find(t => t.id === tagId))
          .filter(tag => tag !== undefined && tag !== null); // Remove unfound tags
        
        // Use spread operator for cleaner immutable update
        return { ...article, tags: resolvedTags };
      }
      
      return article;
    });

    for (const article of articlesWithResolvedTags) {
      // Cache each article by its ID for quick lookup later
      if (article.id) {
        articlesCache.set(article.id, article);
      }
    }

    return articlesWithResolvedTags;
  }

  
/**
 * Get a single article from backend
 * Server already resolves tag names (no client mapping)
 * @param {string} articleId
 * @param {string} companyId
 * @returns {Promise<Object|null>}
 */
  async function getArticleById(articleId, companyId) {
    if (!articleId) return null;

    const url = `/api/articles/${encodeURIComponent(companyId)}/${encodeURIComponent(articleId)}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getArticleById failed: ${res.status}`);

    const article = await res.json();
    const tags = await getTags(article.companyId);  // Get tags for the company to resolve tag IDs

    if (article.tags && Array.isArray(article.tags)) {
      const resolvedTags = article.tags.map(tagId => {
        const tag = tags.find(t => t.id === tagId);
        if (tag) {
          return tag;
        }
        return null;
      }).filter(tag => tag !== null);

      return Object.assign({}, article, { tags: resolvedTags });
    }

    return article;
  }

  
  /**
   * Get multiple articles by their IDs (bulk fetch)
   * More efficient than calling getArticleById multiple times
   * @param {Array<string>} articleIds - Array of article IDs
   * @returns {Promise<Array<Article>>} Promise resolving to array of articles (with resolved tags)
   */
    function getArticlesByIds(articleIds, companyId) {
      const resultsMap = new Map();
      const idsToFetch = [];

      // 1. Check cache and categorize IDs
      articleIds.forEach(id => {
        const cached = articlesCache.get(id);
        if (cached) {
          resultsMap.set(id, cached);
        } else {
          idsToFetch.push(id);
        }
      });

      // 2. Short-circuit if all items were in cache
      if (idsToFetch.length === 0) {
        const orderedResults = articleIds.map(id => resultsMap.get(id));
        return Promise.resolve(orderedResults);
      }

      // 3. Create an array of Promises for the missing articles
      const fetchPromises = idsToFetch.map(id => {
        return getArticleById(id, companyId)
          .then(article => {
            if (article) {
              articlesCache.set(id, article); // Hydrate cache for future use
              resultsMap.set(id, article);
            }
            return article;
          })
          .catch(err => {
            console.error(`Failed to fetch article ${id}:`, err);
            return null; // Resolve with null so Promise.all doesn't reject early
          });
      });

      // 4. Execute all fetches simultaneously
      return Promise.all(fetchPromises).then(() => {
        // 5. Reconstruct the list in the original order, filtering out missing/failed items
        return articleIds
          .map(id => resultsMap.get(id))
          .filter(article => article != null);
      });
    }
  
  
  /**
   * Create a new article (POST equivalent)
   * @param {Object} data - Article data object
   * @returns {Promise<{status: string, data: Article}>} Promise resolving to the created article
   */
  function createArticle(data, companyId) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      title: data.title,
      description: data.description,
      externalLink: data.externalLink,
      status: data.status,
      clientComments: data.clientComments,
      tagIds: data.tags,
      fileIds: data.fileIds
    });

    const requestOptions = {
      method: "POST",
      headers: headers,
      body: raw,
      redirect: "follow"
    };

    return fetch(`${API_BASE_URL}/articles/${encodeURIComponent(companyId)}`, requestOptions)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to create article: " + response.status);
      }
      return response.json();
    })
    .then(function (result) {
      articlesCache.set(result.id, result);
      return { status: "success", data: result };
    })
    .catch(function (error) {
      console.error("Error creating article:", error);
      throw error;
    });
  }
  
  /**
   * Update an existing article (PUT equivalent)
   * @param {string} id - Article ID to update
   * @param {Object} data - Updated article data
   * @returns {Promise<{status: string, data: Article}>} Promise resolving to the updated article
   */
  function updateArticle(id, data, companyId) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      title: data.title || null,
      description: data.description || null,
      externalLink: data.externalLink || null,
      clientComments: data.clientComments || null,
      status: data.status || null,
      tagIds: data.tags || null,
      fileIds: data.fileIds || null
    });

    const requestOptions = {
      method: "PUT",
      headers: headers,
      body: raw,
      redirect: "follow"
    };

    return fetch(`${API_BASE_URL}/articles/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}`, requestOptions)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to update article: " + response.status);
      }
      return response.json();
    })
    .then(function (result) {
      articlesCache.set(id, result);
      return { status: "success", data: result };
    })
    .catch(function (error) {
      console.error("Error updating article:", error);
      throw error;
    });
  }
  
  /**
   * Bulk update tags for multiple articles
   * This method handles both adding and removing tags from multiple articles at once.
   * 
   * @param {Array<string>} articleIds - Array of article IDs to update
   * @param {string} tagId - The tag ID to add or remove
   * @param {('add'|'remove')} action - Whether to 'add' or 'remove' the tag
   * @returns {Promise<{status: string, updatedCount: number}>} Promise resolving to the result
   */
  function bulkUpdateTags(articleIds, tagId, action, companyId) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      "articleIds": articleIds,
      "tagId": tagId,
      "action": action
    });

    const requestOptions = {
      method: "POST",
      headers: headers,
      body: raw,
      redirect: "follow"
    };

    return fetch(`${API_BASE_URL}/articles/${encodeURIComponent(companyId)}/bulk-tags`, requestOptions)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to bulk update tags: " + response.status);
        }
        return response.json();
      })
      .then(function (result) {
        // Clear article cache to force refresh
        articlesCache.clear();
        return { status: "success", updatedCount: result.updatedCount !== undefined ? result.updatedCount : articleIds.length };
      });
  }
  
  // Public API
  return {
    getTags: getTags,
    getTagById: getTagById,
    createTag: createTag,
    updateTag: updateTag,
    deleteTag: deleteTag,
    getArticles: getArticles,
    getArticleById: getArticleById,
    getArticlesByIds: getArticlesByIds,  // Bulk fetch for multiple articles
    createArticle: createArticle,
    updateArticle: updateArticle,
    bulkUpdateTags: bulkUpdateTags,  // Bulk update tags for multiple articles
    clearCache: clearCache,  // Expose cache clearing for development/testing
    clearTagCache: clearTagCache,  // Expose tag cache clearing
    getTagCache: getTagCache  // Expose tag cache for debugging/testing
  };
})();
