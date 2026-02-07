/**
 * File Service Module
 * Provides Promise-based data fetching methods for file management
 * Simulates async HTTP calls with mock data
 */

const FileService = (function() {
  'use strict';
  
  // Cache for file data to avoid multiple file loads
  let fileCache = null;
  
  /**
   * Clear the file cache (useful for development/testing)
   */
  function clearCache() {
    fileCache = null;
  }
  
  /**
   * Load mock data from JSON file
   * @returns {Promise<Object>} Promise resolving to the mock data
   */
  function loadMockData() {
    return fetch('./data/articles-mock-data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load mock data: ' + response.statusText);
        }
        return response.json();
      })
      .catch(error => {
        console.error('Error loading mock data:', error);
        throw error;
      });
  }
  
  /**
   * Get files for a specific company
   * @param {string} companyId - The company ID to filter files by
   * @returns {Promise<Array<Object>>} Promise resolving to array of file objects
   */
  function getFiles(companyId) {
    return loadMockData().then(data => {
      const files = data.files || [];
      
      // Filter files by company
      const companyFiles = files.filter(file => file.companyId === companyId);
      
      return companyFiles;
    });
  }
  
  /**
   * Get a single file by its ID
   * @param {string} fileId - The file ID
   * @returns {Promise<Object|null>} Promise resolving to file object or null
   */
  function getFileById(fileId) {
    return loadMockData().then(data => {
      const files = data.files || [];
      const file = files.find(f => f.id === fileId);
      
      return file || null;
    });
  }
  
  /**
   * Upload one or more files with optional description
   * Simulates async file upload operation
   * @param {FileList|Array<File>} files - Files to upload
   * @param {string} description - Optional description for the files
   * @param {string} companyId - Company ID to associate files with
   * @returns {Promise<Array<Object>>} Promise resolving to array of uploaded file objects
   */
  function uploadFiles(files, description, companyId) {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const uploadedFiles = [];
          const currentDate = new Date().toISOString().split('T')[0];
          
          // Convert FileList to Array if needed
          const filesArray = Array.from(files);
          
          filesArray.forEach((file, index) => {
            const fileId = 'file-' + Date.now() + '-' + index;
            const fileSizeInKB = (file.size / 1024).toFixed(1);
            const fileSizeDisplay = fileSizeInKB > 1024 
              ? (fileSizeInKB / 1024).toFixed(1) + ' MB'
              : fileSizeInKB + ' KB';
            
            const uploadedFile = {
              id: fileId,
              name: file.name,
              size: fileSizeDisplay,
              description: description || file.name + ' para la empresa',
              upload_date: currentDate,
              companyId: companyId,
              linked_articles: []
            };
            
            uploadedFiles.push(uploadedFile);
          });
          
          // In a real implementation, this would save to backend
          // For now, we just return the file objects
          resolve(uploadedFiles);
          
        } catch (error) {
          reject(new Error('Error uploading files: ' + error.message));
        }
      }, 1500); // Simulate 1.5 second upload time
    });
  }
  
  /**
   * Update file metadata (description)
   * @param {string} fileId - The file ID
   * @param {string} newDescription - New description text
   * @returns {Promise<Object>} Promise resolving to updated file object
   */
  function updateFileMetadata(fileId, newDescription) {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        getFileById(fileId).then(file => {
          if (!file) {
            reject(new Error('File not found: ' + fileId));
            return;
          }
          
          // Create updated file object
          const updatedFile = {
            ...file,
            description: newDescription
          };
          
          // In a real implementation, this would update the backend
          // For now, we just return the updated object
          resolve(updatedFile);
          
        }).catch(error => {
          reject(error);
        });
      }, 500); // Simulate 0.5 second update time
    });
  }
  
  /**
   * Delete a file
   * @param {string} fileId - The file ID to delete
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function deleteFile(fileId) {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        getFileById(fileId).then(file => {
          if (!file) {
            reject(new Error('File not found: ' + fileId));
            return;
          }
          
          // In a real implementation, this would delete from backend
          // For now, we just return success
          resolve(true);
          
        }).catch(error => {
          reject(error);
        });
      }, 500); // Simulate 0.5 second delete time
    });
  }
  
  /**
   * Download a file
   * In a real implementation, this would trigger a file download
   * For now, it just simulates the action
   * @param {string} fileId - The file ID to download
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function downloadFile(fileId) {
    return new Promise((resolve, reject) => {
      getFileById(fileId).then(file => {
        if (!file) {
          reject(new Error('File not found: ' + fileId));
          return;
        }
        
        // In a real implementation, this would download the file
        // For now, we just show a message
        console.log('Downloading file:', file.name);
        resolve(true);
        
      }).catch(error => {
        reject(error);
      });
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
   * @param {string} articleId - The article ID to filter files by
   * @returns {Promise<Array<Object>>} Promise resolving to array of file objects linked to the article
   */
  function getFilesByArticle(articleId) {
    // Validate articleId parameter
    if (!articleId || typeof articleId !== 'string') {
      return Promise.resolve([]);
    }
    
    return loadMockData().then(data => {
      const files = data.files || [];
      
      // Filter files that have this article in their linked_articles array
      const linkedFiles = files.filter(file => 
        Array.isArray(file.linked_articles) && file.linked_articles.includes(articleId)
      );
      
      return linkedFiles;
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
    clearCache
  };
})();
