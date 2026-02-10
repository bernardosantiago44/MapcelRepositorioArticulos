/**
 * Article Service Module
 * Provides Promise-based data fetching methods for companies, tags, and articles
 */

const ArticleService = (function() {
  'use strict';
  
  // Cache for mock data to avoid multiple file loads
  let mockDataCache = null;
  let tagCache = null;  // Separate cache for tags by company
  let companiesCache = new Map(); // Company map cache
  
  /**
   * Clear the data cache (useful for development/testing)
   */
  function clearCache() {
    mockDataCache = null;
    tagCache = null;
    companiesCache.clear();
  }
  
  /**
   * Clear only the tag cache (useful when tags are modified)
   */
  function clearTagCache() {
    tagCache = null;
  }

  function clearCompaniesCache() {
    companiesCache.clear();
  }
  
  /**
   * Load mock data from JSON file
   * @param {boolean} forceRefresh - Force reload even if cached
   * @returns {Promise<Object>} Promise resolving to the mock data
   */
  function loadMockData(forceRefresh) {
    if (mockDataCache && !forceRefresh) {
      return Promise.resolve(mockDataCache);
    }
    
    return fetch('./data/articles-mock-data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load mock data: ' + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        mockDataCache = data;
        return data;
      })
      .catch(error => {
        console.error('Error loading mock data:', error);
        throw error;
      });
  }
  
  /**
   * Get all companies
   * @returns {Promise<Array<Company>>} Promise resolving to array of company objects
   */
  function getCompanies() {
    if (companiesCache.size > 0) {
      return Promise.resolve(Array.from(companiesCache.values()));
    }

    const companies =  fetch(`/api/companies`, {
      headers: { "Accept": "application/json" }
    })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Failed to load companies: " + res.status);
      }

      return res.json();
    })
    .then(function(data) {
      // Cache companies in map for quick access
      data.forEach(company => {
        companiesCache.set(company.id, company);
      });
      return data;
    });

    return companies;
  }
  
  /**
   * Get tags specific to a company from the new centralized tags array
   * @param {string} companyId - The company ID to filter tags by
   * @returns {Promise<Array<{id: string, name: string, color: string, description: string, companyId: string}>>} Promise resolving to array of tags
   */
  function getTags(companyId) {
    // Check cache first
    if (tagCache && tagCache[companyId]) {
      return Promise.resolve(tagCache[companyId]);
    }

    return fetch(`/api/tags?companyId=${encodeURIComponent(companyId)}`, {
      headers: { "Accept": "application/json" }
    })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Failed to load tags: " + res.status);
      }

      const companyTags = res.json();

      // Initialize cache if needed
      if (!tagCache) {
        tagCache = {};
      }

      // Cache the tags for this company
      tagCache[companyId] = companyTags;

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
      for (const companyId in tagCache) {
        const tags = tagCache[companyId];
        const tag = tags.find(t => t.id === tagId);
        if (tag) {
          return Promise.resolve(tag);
        }
      }
    }

    // Otherwise, fetch specific one from server
    return fetch(`/api/tags/${encodeURIComponent(tagId)}`, {
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
    return new Promise(function(resolve, reject) {
      if (!tagData.name || !tagData.color || !tagData.companyId) {
        reject(new Error('Tag name, color, and companyId are required'));
        return;
      }
      
      // NOTE: Using Date.now() + random for mock data only.
      // In production, the backend should generate proper UUIDs or auto-increment IDs
      var newId = 'tag-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      var newTag = {
        id: newId,
        name: tagData.name,
        color: tagData.color,
        description: tagData.description || '',
        companyId: tagData.companyId
      };
      
      console.log('Creating new tag:', newTag);
      
      // Add to mock data cache if available
      if (mockDataCache && mockDataCache.tags) {
        mockDataCache.tags.push(newTag);
      }
      
      // Clear tag cache to force refresh
      clearTagCache();
      
      resolve({ status: 'success', data: newTag });
    });
  }
  
  /**
   * Update an existing tag (PUT equivalent)
   * @param {string} tagId - Tag ID to update
   * @param {Object} tagData - Updated tag data {name, color, description}
   * @returns {Promise<{status: string, data: Object}>} Promise resolving to the updated tag
   */
  function updateTag(tagId, tagData) {
    return new Promise(function(resolve, reject) {
      if (!tagData.name || !tagData.color) {
        reject(new Error('Tag name and color are required'));
        return;
      }
      
      console.log('Updating tag ' + tagId, tagData);
      
      // Update in mock data cache if available
      if (mockDataCache && mockDataCache.tags) {
        var index = mockDataCache.tags.findIndex(function(tag) {
          return tag.id === tagId;
        });
        if (index !== -1) {
          var updatedTag = {
            id: tagId,
            name: tagData.name,
            color: tagData.color,
            description: tagData.description || '',
            companyId: mockDataCache.tags[index].companyId  // Preserve companyId
          };
          mockDataCache.tags[index] = updatedTag;
          
          // Clear tag cache to force refresh
          clearTagCache();
          
          resolve({ status: 'success', data: updatedTag });
          return;
        }
      }
      
      reject(new Error('Tag not found'));
    });
  }
  
  /**
   * Delete a tag (DELETE equivalent)
   * @param {string} tagId - Tag ID to delete
   * @returns {Promise<{status: string}>} Promise resolving to status
   */
  function deleteTag(tagId) {
    return new Promise(function(resolve, reject) {
      console.log('Deleting tag ' + tagId);
      
      // Delete from mock data cache if available
      if (mockDataCache && mockDataCache.tags) {
        var index = mockDataCache.tags.findIndex(function(tag) {
          return tag.id === tagId;
        });
        if (index !== -1) {
          mockDataCache.tags.splice(index, 1);
          
          // Clear tag cache to force refresh
          clearTagCache();
          
          resolve({ status: 'success' });
          return;
        }
      }
      
      reject(new Error('Tag not found'));
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

    if (params.companyId) qs.set("companyId", params.companyId);

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

    const url = `/api/articles?${qs.toString()}`;

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

    return articlesWithResolvedTags;
  }

  
/**
 * Get a single article from backend
 * Server already resolves tag names (no client mapping)
 * @param {string} articleId
 * @returns {Promise<Object|null>}
 */
  async function getArticleById(articleId) {
    if (!articleId) return null;

    const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}`, {
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
  function getArticlesByIds(articleIds) {
    if (!articleIds || articleIds.length === 0) {
      return Promise.resolve([]);
    }
    
    return loadMockData().then(data => {
      const articles = data.articles || [];
      const tags = data.tags || [];
      
      // Find all articles that match the requested IDs
      const matchedArticles = articles.filter(article => articleIds.indexOf(article.id) !== -1);
      
      // Resolve tags for each article
      return matchedArticles.map(article => {
        if (article.tags && Array.isArray(article.tags)) {
          const resolvedTags = article.tags.map(tagId => {
            const tag = tags.find(t => t.id === tagId);
            return tag || null;
          }).filter(tag => tag !== null);
          
          return Object.assign({}, article, { tags: resolvedTags });
        }
        return article;
      });
    });
  }
  
  /**
   * Get company by ID
   * @param {string} companyId - The company ID
   * @returns {Promise<Company|null>} Promise resolving to company object or null
   */
  function getCompanyById(companyId) {
    return loadMockData().then(data => {
      const companies = data.companies || [];
      const company = companies.find(company => company.id === companyId);
      return company || null;
    });
  }
  
  /**
   * Create a new article (POST equivalent)
   * @param {Object} data - Article data object
   * @returns {Promise<{status: string, data: Article}>} Promise resolving to the created article
   */
  function createArticle(data) {
    return new Promise(function(resolve) {
      var newId = 'issue-' + Math.floor(Math.random() * 10000);
      var today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      var newRecord = Object.assign({}, data, {
        id: newId,
        createdAt: today,
        updatedAt: today
      });
      
      console.log('Creating new article:', newRecord);
      
      // Add to mock data cache if available
      if (mockDataCache && mockDataCache.articles) {
        mockDataCache.articles.push(newRecord);
      }
      
      resolve({ status: 'success', data: newRecord });
    });
  }
  
  /**
   * Update an existing article (PUT equivalent)
   * @param {string} id - Article ID to update
   * @param {Object} data - Updated article data
   * @returns {Promise<{status: string, data: Article}>} Promise resolving to the updated article
   */
  function updateArticle(id, data) {
    return new Promise(function(resolve) {
      var today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      var updatedRecord = Object.assign({}, data, {
        id: id,
        updatedAt: today
      });
      
      console.log('Updating article ' + id, updatedRecord);
      
      // Update in mock data cache if available
      if (mockDataCache && mockDataCache.articles) {
        var index = mockDataCache.articles.findIndex(function(article) {
          return article.id === id;
        });
        if (index !== -1) {
          // Preserve original createdAt
          updatedRecord.createdAt = mockDataCache.articles[index].createdAt;
          mockDataCache.articles[index] = updatedRecord;
        }
      }
      
      resolve({ status: 'success', data: updatedRecord });
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
  function bulkUpdateTags(articleIds, tagId, action) {
    return new Promise(function(resolve, reject) {
      if (!articleIds || articleIds.length === 0) {
        reject(new Error('No articles specified for bulk update'));
        return;
      }
      
      if (!tagId) {
        reject(new Error('No tag specified for bulk update'));
        return;
      }
      
      if (action !== 'add' && action !== 'remove') {
        reject(new Error('Invalid action: must be "add" or "remove"'));
        return;
      }
      
      console.log('Bulk updating tags: ' + action + ' tag ' + tagId + ' for articles:', articleIds);
      
      // Update in mock data cache
      if (mockDataCache && mockDataCache.articles) {
        var updatedCount = 0;
        
        articleIds.forEach(function(articleId) {
          var articleIndex = mockDataCache.articles.findIndex(function(article) {
            return article.id === articleId;
          });
          
          if (articleIndex !== -1) {
            var article = mockDataCache.articles[articleIndex];
            
            // Ensure tags is an array
            if (!article.tags) {
              article.tags = [];
            }
            
            var tagIndex = article.tags.indexOf(tagId);
            
            if (action === 'add') {
              // Add tag if not already present
              if (tagIndex === -1) {
                article.tags.push(tagId);
                updatedCount++;
              }
            } else if (action === 'remove') {
              // Remove tag if present
              if (tagIndex !== -1) {
                article.tags.splice(tagIndex, 1);
                updatedCount++;
              }
            }
            
            // Update the updatedAt timestamp
            article.updatedAt = new Date().toISOString().split('T')[0];
          }
        });
        
        resolve({ status: 'success', updatedCount: updatedCount });
      } else {
        reject(new Error('Mock data not loaded'));
      }
    });
  }
  
  // Public API
  return {
    getCompanies: getCompanies,
    getTags: getTags,
    getTagById: getTagById,
    createTag: createTag,
    updateTag: updateTag,
    deleteTag: deleteTag,
    getArticles: getArticles,
    getArticleById: getArticleById,
    getArticlesByIds: getArticlesByIds,  // Bulk fetch for multiple articles
    getCompanyById: getCompanyById,
    createArticle: createArticle,
    updateArticle: updateArticle,
    bulkUpdateTags: bulkUpdateTags,  // Bulk update tags for multiple articles
    clearCache: clearCache,  // Expose cache clearing for development/testing
    clearTagCache: clearTagCache  // Expose tag cache clearing
  };
})();
