/**
 * File Service Module
 * Provides Promise-based data fetching methods for file management
 */

const FileService = (function() {
  'use strict';

  // Cache for file data to avoid multiple file loads
  let fileCache = null;
  const filesByArticleCache = new Map();

  // === AUTH SUPPORT ===
  // Provide a way for your app to supply the token.
  // Option A: store token in localStorage under "access_token"
  // Option B: replace getAccessToken() to read from your auth state/store.
  function getAccessToken() {
    try {
      return localStorage.getItem('access_token'); // adjust if needed
    } catch {
      return null;
    }
  }

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
    if (!Array.isArray(files) || files.length === 0) return;
    ensureCache();
    files.forEach(file => {
      if (file && file.id) {
        fileCache.byId.set(String(file.id), file);
      }
    });
  }

  function clearCache() {
    fileCache = null;
  }

  function invalidateFilesByArticleCache(articleId) {
    filesByArticleCache.delete(String(articleId));
  }

  function invalidateAllCaches() {
    clearCache();
    filesByArticleCache.clear();
  }

  /**
   * Get files for a specific company
   */
  function getFiles(companyCode, page = 1, pageSize = 10) {
    const params = new URLSearchParams({ page, pageSize });

    return fetch(`${API_BASE_URL}/files/${encodeURIComponent(companyCode)}?${params}`)
        .then(response => {
          if (response.status === 404) {
            // no files
            return { data: [] };
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
   * NOTE: Your backend returns a PagedResult for this endpoint currently (it calls ExecuteGetAllAsync),
   * but this frontend expects a file object. If your backend really returns a PagedResult here,
   * you should extract the first element from data.
   */
  function getFileById(fileId, companyCode) {
    return fetch(`${API_BASE_URL}/files/${encodeURIComponent(companyCode)}/${encodeURIComponent(fileId)}`)
        .then(response => {
          if (response.status === 404) return null;
          if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
          return response.json();
        })
        .then(payload => {
          // Handle both DTO and PagedResult shapes safely
          if (!payload) return null;
          if (Array.isArray(payload.data)) return payload.data[0] ?? null;
          return payload;
        })
        .catch(error => {
          console.error("Error fetching file:", error);
          return null;
        });
  }

  /**
   * Upload one or more files
   * Backend: POST /api/files/{companyCode} (multipart/form-data, field "file") [Authorize]
   */
  function uploadFiles(files, description, companyCode) {
    const filesArray = Array.from(files);

    const uploadPromises = filesArray.map(file => {
      const formData = new FormData();
      formData.append('file', file);

      return fetch(`${API_BASE_URL}/files/${encodeURIComponent(companyCode)}`, {
        method: 'POST',
        headers: {},
        body: formData
      })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to upload file: ${response.statusText}`);
            }
            return response.json();
          })
          .then(result => {
            // result shape from backend: { file: createdFile, downloadUrl: "..." }
            const created = result?.file ?? result;
            // Invalidate caches after mutation
            invalidateAllCaches();
            return {
              ...created,
              downloadUrl: result?.downloadUrl // keep if you want to display it
            };
          });
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Update file metadata (description)
   * Backend: PUT /api/files/{companyCode}/{id} [Authorize]
   */
  function updateFileMetadata(fileId, newDescription, companyCode) {
    return fetch(`${API_BASE_URL}/files/${encodeURIComponent(companyCode)}/${encodeURIComponent(fileId)}`, {
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
        })
        .then(updated => {
          invalidateAllCaches();
          return updated;
        });
  }

  /**
   * Delete a file
   * Backend: DELETE /api/files/{companyCode}/{id} [Authorize]
   */
  function deleteFile(fileId, companyCode) {
    return fetch(`${API_BASE_URL}/files/${encodeURIComponent(companyCode)}/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: {}
    })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to delete file: ${response.statusText}`);
          }
          invalidateAllCaches();
          return true;
        });
  }

  /**
   * Download a file
   * Backend: GET /api/files/{companyCode}/{id}/download
   * If you later add [Authorize] to Download, add authHeader() here too.
   */
  function downloadFile(fileId, companyCode, downloadUrlOverride) {
    const url =
        downloadUrlOverride ||
        `${API_BASE_URL}/files/${encodeURIComponent(companyCode)}/${encodeURIComponent(fileId)}/download`;

    return fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          const objectUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = objectUrl;

          // Leaving download empty allows browser to use Content-Disposition filename.
          // Some browsers behave better with a fallback name:
          a.download = '';

          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(objectUrl);
          document.body.removeChild(a);
          return true;
        });
  }

  /**
   * Search files by name or description (client-side)
   */
  function searchFiles(companyCode, searchTerm) {
    return getFiles(companyCode).then(files => {
      if (!searchTerm || searchTerm.trim() === '') return files;

      const term = searchTerm.toLowerCase();
      return files.filter(file => {
        return file.name.toLowerCase().includes(term) ||
            (file.description && file.description.toLowerCase().includes(term));
      });
    });
  }

  /**
   * Get files linked to a specific article
   */
  function getFilesByArticle(articleId, imagesOnly = false) {
    if (!articleId) return Promise.reject(new Error("articleId is required"));

    const key = String(articleId);

    if (filesByArticleCache.has(key)) {
      return Promise.resolve(filesByArticleCache.get(key).filter(file => file.isImage === imagesOnly));
    }

    return fetch(`${API_BASE_URL}/files/forArticleId=${encodeURIComponent(key)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    })
        .then(function (response) {
          if (response.status === 404) {
            filesByArticleCache.set(key, []);
            return [];
          }

          if (!response.ok) {
            throw new Error("Failed to fetch files for article " + key);
          }

          return response.json();
        })
        .then(function (data) {
          filesByArticleCache.set(key, data);
          return data.filter(file => file.isImage === imagesOnly);
        });
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
    getCache,
    invalidateFilesByArticleCache
  };
})();