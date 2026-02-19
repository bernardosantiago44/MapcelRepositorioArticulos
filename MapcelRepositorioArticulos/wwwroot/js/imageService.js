/**
 * Image Service Module
 * Provides Promise-based data fetching methods for image management
 */

const ImageService = (function() {
  'use strict';
  let imagesCache = new Map(); // Cache images by ID to avoid multiple loads
  
  
  /**
   * Get images for a specific company
   * @param {string} companyId - The company ID to filter images by
   * @returns {Promise<Array<Object>>} Promise resolving to array of image objects
   */
  function getImages(companyId, page = 1, pageSize = 10) {
    const params = new URLSearchParams({
      companyId,
      imagesOnly: true,
      page,
      pageSize
    });

    return fetch(`/api/files/images?${params}`)
      .then(response => {
        if (response.status === 404) {
          // remove that id from cache if not found
          imagesCache.delete(companyId);
          return {data:[]};
        }
        if (!response.ok) throw new Error("API Error");
        return response.json();
      })
      .then((pagedResult) => {
        const images = Array.isArray(pagedResult.data) ? pagedResult.data : [];
        // Cache images by ID
        images.forEach(image => {
          imagesCache.set(image.id, image);
        });
        return pagedResult.data;
      });
  }
  
  /**
   * Get a single image by its ID
   * @param {string} imageId - The image ID
   * @returns {Promise<Object|null>} Promise resolving to image object or null
   */
  function getImageById(imageId) {
    // Check cache first
    if (imagesCache.has(imageId)) {
      return Promise.resolve(imagesCache.get(imageId));
    }

    // We call the specific endpoint for an image by ID
    return fetch(`/api/files/images/${imageId}`)
      .then(response => {
        // If the server returns 404, we return null to match your original logic
        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Server error: ${response.statusText}`);
        }

        return response.json().data[0];
      })
      .catch(error => {
        console.error("Error fetching image:", error);
        return null; 
      });
  }
  
  /**
   * Update image metadata (description)
   * @param {string} imageId - The image ID
   * @param {string} newDescription - New description text
   * @param {string} companyCode - The company code
   * @return {Promise<Object>} Promise resolving to the updated image object
   */
  function updateImageMetadata(imageId, newDescription, companyCode) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      "description": newDescription
    });

    const requestOptions = {
      method: "PUT",
      headers: myHeaders,
      body: raw,
      redirect: "follow"
    };

    return fetch(`/api/files/${imageId}?companyId=${companyCode}`, requestOptions)
      .then(response => {
        if (response.status === 404) {
          console.warn(`Image with ID ${imageId} not found for update.`);
        }
        if (!response.ok) {
          throw new Error(`Failed to update image metadata: ${response.statusText}`);
        }
        return response.json();
      })
      .catch(error => {
        console.error('Error updating image metadata:', error);
        throw error;
      });
  }
  
  /**
   * Delete a single image
   * @param {string} imageId - The image ID to delete
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function deleteImage(imageId) {
    const requestOptions = {
      method: "DELETE",
      redirect: "follow"
    };

    return fetch(`/api/files/${imageId}?companyId=${appState.selectedCompanyId}`, requestOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to delete image: ${response.statusText}`);
        }
        return true;
      });
  }

  /**
   * Returns the URLs of the selected images' IDs
   * @param imageIds
   * @return {Promise<{id: *, url: *}[]>}
   */
  function getImagesURLs(imageIds) {
    if (!imageIds || imageIds.length === 0) {
      return Promise.resolve([]);
    }
    
    const idsParam = imageIds.join(',');
    return fetch(`/api/files/ids=${idsParam}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch images: ${response.statusText}`);
        }
        return response.json();
      })
      .then(images => {
        return images.map(img => ({ id: img.id, url: img.thumbnailUrl }));
      })
      .catch(error => {
        console.error('Error fetching image URLs:', error);
        return [];
      });
  }
  
  /**
   * Delete multiple images at once
   * @param {Array<string>} imageIds - Array of image IDs to delete
   * @returns {Promise<Object>} Promise resolving to result object with deleted count
   */
  function bulkDeleteImages(imageIds) {
    if (!imageIds || imageIds.length === 0) {
      return Promise.reject(new Error('No images specified for deletion'));
    }
    
    const companyId = appState.selectedCompanyId;
    const deletePromises = imageIds.map(imageId => {
      const requestOptions = {
        method: "DELETE",
        redirect: "follow"
      };
      return fetch(`/api/files/${imageId}?companyId=${companyId}`, requestOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to delete image ${imageId}: ${response.statusText}`);
          }
          return true;
        });
    });
    
    return Promise.all(deletePromises)
      .then(() => {
        return {
          success: true,
          deletedCount: imageIds.length,
          deletedIds: imageIds
        };
      })
      .catch(error => {
        console.error('Error during bulk delete:', error);
        throw error;
      });
  }
  
  /**
   * Download an image
   * @param {string} imageId - The image ID to download
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function downloadImage(imageId) {
    const companyId = appState.selectedCompanyId;
    
    return fetch(`/api/files/${imageId}/download?companyId=${companyId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        // Get filename from image data or use a default
        return getImageById(imageId).then(image => {
          const filename = image ? image.name : `image-${imageId}`;
          
          // Create blob URL and trigger download
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up blob URL
          URL.revokeObjectURL(blobUrl);
          
          return true;
        });
      })
      .catch(error => {
        console.error('Error downloading image:', error);
        throw error;
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
   * @param {FileList|Array<File>} imageFiles - Image files to upload
   * @param {Array<Object>} imageDimensions - Array of {width, height} objects for each file (kept for backwards compatibility)
   * @param {string} description - Optional description for the images (batch) (kept for backwards compatibility)
   * @param {string} companyId - Company ID to associate images with
   * @returns {Promise<Array<Object>>} Promise resolving to array of uploaded image objects
   */
  function uploadImages(imageFiles, imageDimensions, description, companyId) {
    // Convert FileList to Array if needed
    const filesArray = Array.from(imageFiles);
    
    const uploadPromises = filesArray.map(file => {
      const formData = new FormData();
      formData.append('file', file);
      
      const requestOptions = {
        method: "POST",
        body: formData,
        redirect: "follow"
      };
      
      return fetch(`/api/files?companyId=${companyId}`, requestOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(result => {
          // The API returns { file: {...}, downloadUrl: "..." }
          return result.file;
        });
    });
    
    return Promise.all(uploadPromises)
      .catch(error => {
        console.error('Error uploading images:', error);
        throw error;
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
    
    return fetch(`/api/files/forArticleId=${encodeURIComponent(articleId)}`)
      .then(response => {
        if (response.status === 404) {
          return [];
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch files for article: ${response.statusText}`);
        }
        return response.json();
      })
      .then(files => {
        // Filter to only include images
        const images = files.filter(file => file.isImage === true);
        return images;
      })
      .catch(error => {
        console.error('Error fetching images for article:', error);
        return [];
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
