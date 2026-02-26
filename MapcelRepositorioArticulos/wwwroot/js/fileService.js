/**
 * File Service Module
 * Provides Promise-based data fetching methods for file management
 */

const FileService = (function() {
  'use strict';
  
  // Cache for file data to avoid multiple file loads
  let fileCache = null;
  const filesByArticleCache = new Map();

  function ensureCache() {
    if (!fileCache) {
      fileCache = {
        byId: new Map()
      };
    }
  }

  function getCache() {
    ensureCache();
    return fileCache;
  }

  function cacheFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    ensureCache();
    files.forEach(file => {
      if (file && file.id) {
        fileCache.byId.set(file.id, file);
      }
    });
  }

  function getCachedFilesArray() {
    if (!fileCache || !fileCache.byId) {
      return [];
    }

    return Array.from(fileCache.byId.values());
  }
  
  /**
   * Clear the file cache (useful for development/testing)
   */
  function clearCache() {
    fileCache = null;
  }
  
  
  /**
   * Get files for a specific company
   * @param {string} companyId - The company ID to filter files by
   * @returns {Promise<Array<Object>>} Promise resolving to array of file objects
   */
  function getFiles(companyId, page = 1, pageSize = 10) {
    const params = new URLSearchParams({
      page,
      pageSize
    });

    return fetch(`/api/files/${encodeURIComponent(companyId)}?${params}`)
      .then(response => {
        if (response.status === 404) {
          // Cache empty result to prevent future calls
          cacheFiles([]);
          return [];
        }
        if (!response.ok) throw new Error("API Error");
        return response.json();
      })
      .then(pagedResult => {
        const files = Array.isArray(pagedResult.data) ? pagedResult.data : [];
        cacheFiles(files);
        return files;
      });
  }
  
  /**
   * Get a single file by its ID
   * @param {string} fileId - The file ID
   * @returns {Promise<Object|null>} Promise resolving to file object or null
   */
  function getFileById(fileId, companyId) {
    return fetch(`/api/files/${encodeURIComponent(companyId)}/${encodeURIComponent(fileId)}`)
      .then(response => {
        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Server error: ${response.statusText}`);
        }

        return response.json();
      })
      .catch(error => {
        console.error("Error fetching file:", error);
        return null;
      });
  }
  
  /**
   * Upload one or more files with optional description
   * @param {FileList|Array<File>} files - Files to upload
   * @param {string} description - Optional description for the files
   * @param {string} companyId - Company ID to associate files with
   * @returns {Promise<Array<Object>>} Promise resolving to array of uploaded file objects
   */
  function uploadFiles(files, description, companyId) {
    // Convert FileList to Array if needed
    const filesArray = Array.from(files);
    
    // Upload all files in parallel
    const uploadPromises = filesArray.map(file => {
      const formData = new FormData();
      formData.append('file', file);
      
      return fetch(`/api/files/${encodeURIComponent(companyId)}`, {
        method: 'POST',
        body: formData
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to upload file: ${response.statusText}`);
          }
          return response.json();
        })
        .then(result => result.file);
    });
    
    return Promise.all(uploadPromises);
  }
  
  /**
   * Update file metadata (description)
   * @param {string} fileId - The file ID
   * @param {string} newDescription - New description text
   * @returns {Promise<Object>} Promise resolving to updated file object
   */
  function updateFileMetadata(fileId, newDescription, companyId) {
    return fetch(`/api/files/${encodeURIComponent(companyId)}/${encodeURIComponent(fileId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: newDescription
      })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to update file: ${response.statusText}`);
        }
        return response.json();
      });
  }
  
  /**
   * Delete a file
   * @param {string} fileId - The file ID to delete
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function deleteFile(fileId, companyId) {
    return fetch(`/api/files/${encodeURIComponent(companyId)}/${encodeURIComponent(fileId)}`, {
      method: 'DELETE'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to delete file: ${response.statusText}`);
        }
        return true;
      });
  }
  
  /**
   * Download a file
   * @param {string} fileId - The file ID to download
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function downloadFile(fileId, companyId) {
    return fetch(`/api/files/${encodeURIComponent(companyId)}/${encodeURIComponent(fileId)}/download`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        // Get filename from Content-Disposition header or use default
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = ''; // Browser will use filename from Content-Disposition
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return true;
      });
  }
  
  /**
   * Search files by name or description
   * @param {string} companyId - Company ID to filter files by
   * @param {string} searchTerm - Search term to filter by
   * @returns {Promise<Array<Object>>} Promise resolving to array of filtered file objects
   */
  function searchFiles(companyId, searchTerm) {
    return getFiles(companyId).then(files => {
      if (!searchTerm || searchTerm.trim() === '') {
        return files;
      }
      
      const term = searchTerm.toLowerCase();
      
      return files.filter(file => {
        return file.name.toLowerCase().includes(term) ||
               (file.description && file.description.toLowerCase().includes(term));
      });
    });
  }
  
  /**
   * Get files linked to a specific article
   * @param {string|number} articleId - The article ID to filter files by
   * @returns {Promise<Array<Object>>} Promise resolving to array of file objects linked to the article
   */
  function getFilesByArticle(articleId, imagesOnly = false) {
    if (!articleId) {
      return Promise.reject(new Error("articleId is required"));
    }

    const key = String(articleId);

    // Return cached value immediately
    if (filesByArticleCache.has(key)) {
      return Promise.resolve(filesByArticleCache.get(key).filter(file =>  file.isImage == imagesOnly));
    }

    return fetch(`/api/files/forArticleId=${encodeURIComponent(key)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    })
      .then(function (response) {
        if (response.status === 404) {
        // Cache empty result
        filesByArticleCache.set(key, []);
        return [];
      }

      if (!response.ok) {
        throw new Error("Failed to fetch files for article " + key);
      }

      return response.json();
      })
      .then(function (data) {
        // Store in cache
        console.log(`Fetched files for article ${key}:`, data);
        filesByArticleCache.set(key, data);
        return data.filter(file =>  file.isImage == imagesOnly);
      });
  }

  // Optional cache invalidation
  function invalidateFilesByArticleCache(articleId) {
    filesByArticleCache.delete(String(articleId));
}
  
  // Public API
  return {
    getFiles,
    getFileById,
    getFilesByArticle,
    uploadFiles,
    updateFileMetadata,
    deleteFile,
    downloadFile,
    searchFiles,
    clearCache,
    getCache
  };
})();
