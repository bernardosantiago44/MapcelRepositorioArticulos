/**
 * Image Service Module
 * Provides Promise-based data fetching methods for image management
 * Simulates async HTTP calls with mock data
 */

const ImageService = (function() {
  'use strict';
  
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
   * Get images for a specific company
   * @param {string} companyId - The company ID to filter images by
   * @returns {Promise<Array<Object>>} Promise resolving to array of image objects
   */
  function getImages(companyId) {
    return loadMockData().then(data => {
      const images = data.images || [];
      
      // Filter images by company
      const companyImages = images.filter(image => image.companyId === companyId);
      
      return companyImages;
    });
  }
  
  /**
   * Get a single image by its ID
   * @param {string} imageId - The image ID
   * @returns {Promise<Object|null>} Promise resolving to image object or null
   */
  function getImageById(imageId) {
    return loadMockData().then(data => {
      const images = data.images || [];
      const image = images.find(img => img.id === imageId);
      
      return image || null;
    });
  }
  
  /**
   * Update image metadata (description)
   * @param {string} imageId - The image ID
   * @param {string} newDescription - New description text
   * @returns {Promise<Object>} Promise resolving to updated image object
   */
  function updateImageMetadata(imageId, newDescription) {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        getImageById(imageId).then(image => {
          if (!image) {
            reject(new Error('Image not found: ' + imageId));
            return;
          }
          
          // Create updated image object
          const updatedImage = {
            ...image,
            description: newDescription
          };
          
          // In a real implementation, this would update the backend
          // For now, we just return the updated object
          resolve(updatedImage);
          
        }).catch(error => {
          reject(error);
        });
      }, 500); // Simulate 0.5 second update time
    });
  }
  
  /**
   * Delete a single image
   * @param {string} imageId - The image ID to delete
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function deleteImage(imageId) {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        getImageById(imageId).then(image => {
          if (!image) {
            reject(new Error('Image not found: ' + imageId));
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
   * Returns the URLs of the selected images' IDs
   * @param imageIds
   * @return {Promise<{id: *, url: *}[]>}
   */
  function getImagesURLs(imageIds) {
    return loadMockData().then(data => {
      const images = data.images || [];
      const urls = images
        .filter(img => imageIds.includes(img.id))
        .map(img => ({ id: img.id, url: img.thumbnail_url }));
      return urls;
    });
  }
  
  /**
   * Delete multiple images at once
   * @param {Array<string>} imageIds - Array of image IDs to delete
   * @returns {Promise<Object>} Promise resolving to result object with deleted count
   */
  function bulkDeleteImages(imageIds) {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!imageIds || imageIds.length === 0) {
          reject(new Error('No images specified for deletion'));
          return;
        }
        
        // In a real implementation, this would bulk delete from backend
        // For now, we just return the count of deleted images
        resolve({
          success: true,
          deletedCount: imageIds.length,
          deletedIds: imageIds
        });
        
      }, 800); // Simulate 0.8 second bulk delete time
    });
  }
  
  /**
   * Download an image
   * In a real implementation, this would trigger an image download
   * For now, it just simulates the action
   * @param {string} imageId - The image ID to download
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function downloadImage(imageId) {
    return new Promise((resolve, reject) => {
      getImageById(imageId).then(image => {
        if (!image) {
          reject(new Error('Image not found: ' + imageId));
          return;
        }
        
        // In a real implementation, this would download the image
        // For now, we just show a message
        console.log('Downloading image:', image.name);
        resolve(true);
        
      }).catch(error => {
        reject(error);
      });
    });
  }
  
  /**
   * Search images by name, description, or dimensions
   * @param {string} companyId - Company ID to filter images by
   * @param {string} searchTerm - Search term to filter by
   * @returns {Promise<Array<Object>>} Promise resolving to array of filtered image objects
   */
  function searchImages(companyId, searchTerm) {
    return getImages(companyId).then(images => {
      if (!searchTerm || searchTerm.trim() === '') {
        return images;
      }
      
      const term = searchTerm.toLowerCase();
      
      return images.filter(image => {
        return image.name.toLowerCase().includes(term) ||
               (image.description && image.description.toLowerCase().includes(term)) ||
               (image.dimensions && image.dimensions.toLowerCase().includes(term));
      });
    });
  }
  
  /**
   * Upload one or more images with optional description
   * Simulates async image upload operation
   * @param {FileList|Array<File>} imageFiles - Image files to upload
   * @param {Array<Object>} imageDimensions - Array of {width, height} objects for each file
   * @param {string} description - Optional description for the images (batch)
   * @param {string} companyId - Company ID to associate images with
   * @returns {Promise<Array<Object>>} Promise resolving to array of uploaded image objects
   */
  function uploadImages(imageFiles, imageDimensions, description, companyId) {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const uploadedImages = [];
          const currentDate = new Date().toISOString().split('T')[0];
          const batchTimestamp = Date.now();
          
          // Convert FileList to Array if needed
          const filesArray = Array.from(imageFiles);
          
          console.log('Uploading ' + filesArray.length + ' images to ' + companyId);
          
          filesArray.forEach((file, index) => {
            // Generate unique ID with timestamp, random string, and index
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const imageId = 'img-' + batchTimestamp + '-' + randomSuffix + '-' + index;
            const fileSizeInKB = (file.size / 1024).toFixed(1);
            const fileSizeDisplay = fileSizeInKB > 1024 
              ? (fileSizeInKB / 1024).toFixed(1) + ' MB'
              : fileSizeInKB + ' KB';
            
            // Get dimensions for this file with validation
            const dims = (imageDimensions && imageDimensions[index]) 
              ? imageDimensions[index] 
              : { width: 0, height: 0 };
            const dimensionsDisplay = dims.width + 'x' + dims.height;
            
            const uploadedImage = {
              id: imageId,
              name: file.name,
              dimensions: dimensionsDisplay,
              size: fileSizeDisplay,
              description: description || '',
              upload_date: currentDate,
              companyId: companyId,
              thumbnail_url: 'https://picsum.photos/seed/' + imageId + '/400/225',
              linked_articles: []
            };
            
            uploadedImages.push(uploadedImage);
          });
          
          // In a real implementation, this would save to backend
          // For now, we just return the image objects
          resolve(uploadedImages);
          
        } catch (error) {
          reject(new Error('Error uploading images: ' + error.message));
        }
      }, 1500); // Simulate 1.5 second upload time
    });
  }
  
  /**
   * Get images linked to a specific article
   * @param {string} articleId - The article ID to filter images by
   * @returns {Promise<Array<Object>>} Promise resolving to array of image objects linked to the article
   */
  function getImagesByArticle(articleId) {
    // Validate articleId parameter
    if (!articleId || typeof articleId !== 'string') {
      return Promise.resolve([]);
    }
    
    return loadMockData().then(data => {
      const images = data.images || [];
      
      // Filter images that have this article in their linked_articles array
      const linkedImages = images.filter(image => 
        Array.isArray(image.linked_articles) && image.linked_articles.includes(articleId)
      );
      
      return linkedImages;
    });
  }
  
  // Public API
  return {
    getImages,
    getImageById,
    getImagesByArticle,
    updateImageMetadata,
    deleteImage,
    bulkDeleteImages,
    downloadImage,
    searchImages,
    getImagesURLs,
    uploadImages
  };
})();
