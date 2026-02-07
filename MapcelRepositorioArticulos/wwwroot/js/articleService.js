/**
 * Article Service Module
 * Provides Promise-based data fetching methods for companies, tags, and articles
 */

const ArticleService = (function() {
  'use strict';
  
  // Cache for mock data to avoid multiple file loads
  let mockDataCache = null;
  let tagCache = null;  // Separate cache for tags by company
  
  /**
   * Clear the data cache (useful for development/testing)
   */
  function clearCache() {
    mockDataCache = null;
    tagCache = null;
  }
  
  /**
   * Clear only the tag cache (useful when tags are modified)
   */
  function clearTagCache() {
    tagCache = null;
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
    return loadMockData().then(data => {
      return data.companies || [];
    });
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
    
    return loadMockData().then(data => {
      const tags = data.tags || [];
      
      // Filter tags by company
      const companyTags = tags.filter(tag => tag.companyId === companyId);
      
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
    return loadMockData().then(data => {
      const tags = data.tags || [];
      const tag = tags.find(t => t.id === tagId);
      return tag || null;
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
   * Get tags specific to a company (LEGACY method for backward compatibility)
   * Tags are extracted from articles belonging to the company and deduplicated
   * @param {string} companyId - The company ID to filter tags by
   * @returns {Promise<Array<{label: string, color: string}>>} Promise resolving to array of unique tags
   * @deprecated Use getTags() instead for the new centralized tag management
   */
  function getTagsByCompany(companyId) {
    return loadMockData().then(data => {
      const articles = data.articles || [];
      
      // Filter articles by company
      const companyArticles = articles.filter(article => article.companyId === companyId);
      
      // Extract all tags from company articles
      const allTags = [];
      companyArticles.forEach(article => {
        if (article.tags && Array.isArray(article.tags)) {
          article.tags.forEach(tag => {
            allTags.push(tag);
          });
        }
      });
      
      // Deduplicate tags by label
      const uniqueTagsMap = new Map();
      allTags.forEach(tag => {
        if (!uniqueTagsMap.has(tag.label)) {
          uniqueTagsMap.set(tag.label, tag);
        }
      });
      
      return Array.from(uniqueTagsMap.values());
    });
  }
  
  /**
   * Get articles filtered by company ID
   * Articles will have their tag IDs resolved to full tag objects
   * @param {string} companyId - The company ID to filter articles by
   * @returns {Promise<Array<Article>>} Promise resolving to array of filtered articles
   */
  function getArticles(companyId) {
    return loadMockData().then(data => {
      const articles = data.articles || [];
      const tags = data.tags || [];
      
      // Filter articles by company
      const filteredArticles = articles.filter(article => article.companyId === companyId);
      
      // Resolve tag IDs to full tag objects for each article
      const articlesWithResolvedTags = filteredArticles.map(article => {
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
      });
      
      return articlesWithResolvedTags;
    });
  }
  
  /**
   * Get a single article by ID with resolved tag objects
   * @param {string} articleId - The article ID
   * @returns {Promise<Article|null>} Promise resolving to article object or null
   */
  function getArticleById(articleId) {
    return loadMockData().then(data => {
      const articles = data.articles || [];
      const tags = data.tags || [];
      const article = articles.find(article => article.id === articleId);
      
      if (!article) {
        return null;
      }
      
      // Resolve tag IDs to full tag objects
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
    });
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
    getTagsByCompany: getTagsByCompany,  // Legacy method for backward compatibility
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
