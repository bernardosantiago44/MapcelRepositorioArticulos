/**
 * Images Gallery View UI
 * Renders images in a gallery/card view with custom HTML and Tailwind CSS
 * Supports lazy loading for performance optimization
 */

const ImagesGalleryViewUI = (function() {
  'use strict';
  
  // Track loaded images for lazy loading
  let observerInstance = null;
  
  /**
   * Render the gallery view HTML
   * @param {Array<Object>} images - Array of image objects
   * @param {Array<string>} selectedImageIds - Array of selected image IDs
   * @returns {string} HTML string for the gallery view
   */
  function renderGalleryView(images, selectedImageIds = []) {
    if (!images || images.length === 0) {
      return renderEmptyState();
    }
    
    const cardsHTML = images.map(image => renderCard(image, selectedImageIds)).join('');
    
    return `
      <div class="p-6 bg-gray-50 h-full overflow-auto" id="images-gallery-container">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          ${cardsHTML}
        </div>
      </div>
    `;
  }
  
  /**
   * Render a single image card
   * @param {Object} image - Image object
   * @param {Array<string>} selectedImageIds - Array of selected image IDs
   * @returns {string} HTML string for a card
   */
  function renderCard(image, selectedImageIds = []) {
    const formattedDate = Utils.formatDate(image.upload_date);
    const isSelected = selectedImageIds.includes(image.id);
    const fileExtension = Utils.getFileExtension(image.name);
    const extensionColor = getExtensionBadgeColor(fileExtension);
    
    // Escape user-controlled data to prevent XSS
    const escapedName = Utils.escapeHtml(image.name);
    const escapedDescription = Utils.escapeHtml(image.description);
    const escapedDimensions = Utils.escapeHtml(image.dimensions);
    const escapedSize = Utils.escapeHtml(image.size);
    const escapedThumbnailUrl = Utils.escapeHtml(image.thumbnail_url);
    const escapedId = Utils.escapeHtml(image.id);
    
    return `
      <div 
        class="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer relative group ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}"
        data-image-id="${escapedId}"
      >
        <!-- Checkbox -->
        <div class="absolute top-3 left-3 z-10">
          <input 
            type="checkbox" 
            class="image-card-checkbox w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer bg-white"
            data-image-id="${escapedId}"
            ${isSelected ? 'checked' : ''}
            onclick="event.stopPropagation(); ImagesGalleryViewUI.handleCheckboxChange('${escapedId}')"
          />
        </div>
        
        <!-- Extension Badge -->
        <div class="absolute top-3 right-3 z-10">
          <span class="px-2 py-1 text-xs font-semibold rounded ${extensionColor}">
            ${fileExtension.toUpperCase()}
          </span>
        </div>
        
        <!-- Thumbnail with Lazy Loading -->
        <div class="relative aspect-video bg-gray-100 overflow-hidden" onclick="ImagesGalleryViewUI.handleCardClick('${escapedId}')">
          <img 
            data-src="${escapedThumbnailUrl}"
            alt="${escapedName}"
            class="lazy-image w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            style="opacity: 0; transition: opacity 0.3s ease-in-out;"
          />
          <!-- Loading placeholder -->
          <div class="absolute inset-0 flex items-center justify-center bg-gray-100 lazy-placeholder">
            <svg class="w-10 h-10 text-gray-300 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          
          <!-- Hover Actions Overlay -->
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div class="flex items-center space-x-2">
              <button 
                onclick="event.stopPropagation(); ImagesGalleryViewUI.handleViewImage('${escapedId}')"
                class="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                title="Ver imagen"
              >
                <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </button>
              <button 
                onclick="event.stopPropagation(); ImagesGalleryViewUI.handleDownloadImage('${escapedId}')"
                class="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                title="Descargar"
              >
                <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
              </button>
              <button 
                onclick="event.stopPropagation(); ImagesGalleryViewUI.handleEditImage('${escapedId}')"
                class="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                title="Editar descripción"
              >
                <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
              </button>
              <button 
                onclick="event.stopPropagation(); ImagesGalleryViewUI.handleDeleteImage('${escapedId}')"
                class="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Image Info -->
        <div class="p-4" onclick="ImagesGalleryViewUI.handleCardClick('${escapedId}')">
          <h3 class="text-sm font-semibold text-gray-900 mb-1 truncate" title="${escapedName}">
            ${escapedName}
          </h3>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>${escapedDimensions}</span>
            <span>${escapedSize}</span>
          </div>
          ${escapedDescription ? `
            <p class="text-xs text-gray-600 line-clamp-2 mb-2" title="${escapedDescription}">
              ${escapedDescription}
            </p>
          ` : ''}
          <div class="flex items-center justify-between pt-2 border-t border-gray-100">
            <span class="text-xs text-gray-500">${formattedDate}</span>
            ${image.linked_articles && image.linked_articles.length > 0 ? `
              <span class="text-xs font-medium text-blue-600">
                ${image.linked_articles.length} artículo${image.linked_articles.length > 1 ? 's' : ''}
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render empty state
   * @returns {string} HTML string for empty state
   */
  function renderEmptyState() {
    return `
      <div class="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg class="h-24 w-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No hay imágenes</h3>
        <p class="text-sm text-gray-500 mb-4">
          No se encontraron imágenes para esta empresa.
        </p>
      </div>
    `;
  }
  
  /**
   * Get Tailwind color classes for extension badge
   * @param {string} extension - File extension
   * @returns {string} Tailwind CSS classes for badge color
   */
  function getExtensionBadgeColor(extension) {
    const colorMap = {
      'jpg': 'bg-green-100 text-green-800',
      'jpeg': 'bg-green-100 text-green-800',
      'png': 'bg-blue-100 text-blue-800',
      'gif': 'bg-purple-100 text-purple-800',
      'svg': 'bg-orange-100 text-orange-800',
      'webp': 'bg-teal-100 text-teal-800',
      'bmp': 'bg-gray-100 text-gray-800',
      'ico': 'bg-yellow-100 text-yellow-800'
    };
    
    return colorMap[extension] || 'bg-gray-100 text-gray-800';
  }
  
  /**
   * Initialize lazy loading for images
   * Uses IntersectionObserver for performance
   */
  function initializeLazyLoading() {
    // Disconnect previous observer if exists
    if (observerInstance) {
      observerInstance.disconnect();
    }
    
    // Check for IntersectionObserver support
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately
      loadAllImages();
      return;
    }
    
    const options = {
      root: document.getElementById('images-gallery-container'),
      rootMargin: '50px',
      threshold: 0.1
    };
    
    observerInstance = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          
          if (src) {
            img.src = src;
            img.onload = function() {
              img.style.opacity = '1';
              // Hide the placeholder
              const placeholder = img.parentElement.querySelector('.lazy-placeholder');
              if (placeholder) {
                placeholder.style.display = 'none';
              }
            };
            img.onerror = function() {
              // Show placeholder with error state
              img.style.display = 'none';
            };
            observer.unobserve(img);
          }
        }
      });
    }, options);
    
    // Observe all lazy images
    setTimeout(() => {
      const lazyImages = document.querySelectorAll('.lazy-image');
      lazyImages.forEach(img => {
        observerInstance.observe(img);
      });
    }, 100);
  }
  
  /**
   * Fallback function to load all images immediately
   */
  function loadAllImages() {
    const lazyImages = document.querySelectorAll('.lazy-image');
    lazyImages.forEach(img => {
      const src = img.dataset.src;
      if (src) {
        img.src = src;
        img.onload = function() {
          img.style.opacity = '1';
          const placeholder = img.parentElement.querySelector('.lazy-placeholder');
          if (placeholder) {
            placeholder.style.display = 'none';
          }
        };
      }
    });
  }
  
  /**
   * Handle card click
   * @param {string} imageId - Image ID
   */
  function handleCardClick(imageId) {
    if (window.ImagesTabManager && window.ImagesTabManager.handleImageSelect) {
      window.ImagesTabManager.handleImageSelect(imageId);
    }
  }
  
  /**
   * Handle checkbox change
   * @param {string} imageId - Image ID
   */
  function handleCheckboxChange(imageId) {
    if (window.ImagesTabManager && window.ImagesTabManager.handleImageCheckboxChange) {
      window.ImagesTabManager.handleImageCheckboxChange(imageId);
    }
  }
  
  /**
   * Handle view image action
   * @param {string} imageId - Image ID
   */
  function handleViewImage(imageId) {
    if (window.ImagesTabManager && window.ImagesTabManager.openImagePreview) {
      window.ImagesTabManager.openImagePreview(imageId);
    }
  }
  
  /**
   * Handle download image action
   * @param {string} imageId - Image ID
   */
  function handleDownloadImage(imageId) {
    if (window.ImagesTabManager && window.ImagesTabManager.downloadImage) {
      window.ImagesTabManager.downloadImage(imageId);
    }
  }
  
  /**
   * Handle edit image action
   * @param {string} imageId - Image ID
   */
  function handleEditImage(imageId) {
    if (window.ImagesTabManager && window.ImagesTabManager.openEditDescriptionModal) {
      window.ImagesTabManager.openEditDescriptionModal(imageId);
    }
  }
  
  /**
   * Handle delete image action
   * @param {string} imageId - Image ID
   */
  function handleDeleteImage(imageId) {
    if (window.ImagesTabManager && window.ImagesTabManager.deleteSingleImage) {
      window.ImagesTabManager.deleteSingleImage(imageId);
    }
  }
  
  /**
   * Update checkbox state for a specific image
   * @param {string} imageId - Image ID
   * @param {boolean} isSelected - Selection state
   */
  function updateCheckboxState(imageId, isSelected) {
    const checkbox = document.querySelector(`.image-card-checkbox[data-image-id="${imageId}"]`);
    if (checkbox) {
      checkbox.checked = isSelected;
      
      // Update card border style
      const card = checkbox.closest('[data-image-id]');
      if (card) {
        if (isSelected) {
          card.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
        } else {
          card.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
        }
      }
    }
  }
  
  /**
   * Update all checkboxes state
   * @param {boolean} isSelected - Selection state for all
   */
  function updateAllCheckboxes(isSelected) {
    const checkboxes = document.querySelectorAll('.image-card-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = isSelected;
      
      // Update card border style
      const card = checkbox.closest('[data-image-id]');
      if (card) {
        if (isSelected) {
          card.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
        } else {
          card.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
        }
      }
    });
  }
  
  // Public API
  return {
    renderGalleryView,
    initializeLazyLoading,
    handleCardClick,
    handleCheckboxChange,
    handleViewImage,
    handleDownloadImage,
    handleEditImage,
    handleDeleteImage,
    updateCheckboxState,
    updateAllCheckboxes
  };
})();
