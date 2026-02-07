/**
 * Image Preview Modal
 * Lightbox-style modal to view images in full resolution
 */

const ImagePreviewModal = (function() {
  'use strict';
  
  let currentOverlay = null;
  
  /**
   * Open the image preview modal
   * @param {string} imageId - Image ID to preview
   */
  function openPreview(imageId) {
    ImageService.getImageById(imageId)
      .then(image => {
        if (!image) {
          dhtmlx.message({
            type: 'error',
            text: 'Imagen no encontrada'
          });
          return;
        }
        
        showPreviewModal(image);
      })
      .catch(error => {
        console.error('Error loading image:', error);
        dhtmlx.message({
          type: 'error',
          text: 'Error al cargar imagen'
        });
      });
  }
  
  /**
   * Show the preview modal
   * @param {Object} image - Image object
   */
  function showPreviewModal(image) {
    // Close existing modal if any
    closePreview();
    
    // Escape user-controlled data to prevent XSS
    const escapedName = Utils.escapeHtml(image.name);
    const escapedDescription = Utils.escapeHtml(image.description);
    const escapedDimensions = Utils.escapeHtml(image.dimensions);
    const escapedSize = Utils.escapeHtml(image.size);
    const escapedThumbnailUrl = Utils.escapeHtml(image.thumbnail_url);
    const escapedId = Utils.escapeHtml(image.id);
    
    // Build higher resolution URL (with safe base URL)
    const highResUrl = image.thumbnail_url ? 
      Utils.escapeHtml(image.thumbnail_url.replace('/400/', '/1200/').replace('/225', '/675')) : '';
    
    // Create modal HTML
    const modalHTML = `
      <div 
        id="image-preview-overlay" 
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90 animate-fade-in"
        onclick="ImagePreviewModal.handleOverlayClick(event)"
      >
        <!-- Close Button -->
        <button 
          onclick="ImagePreviewModal.closePreview()"
          class="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors z-10"
          title="Cerrar (Esc)"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
        
        <!-- Navigation Arrows (for future gallery navigation) -->
        <!--
        <button 
          class="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-gray-300 transition-colors"
          title="Anterior"
        >
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        <button 
          class="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-gray-300 transition-colors"
          title="Siguiente"
        >
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
        -->
        
        <!-- Image Container -->
        <div class="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center">
          <!-- Loading Indicator -->
          <div id="image-preview-loading" class="absolute inset-0 flex items-center justify-center">
            <div class="flex flex-col items-center">
              <svg class="animate-spin h-12 w-12 text-white mb-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-white text-sm">Cargando imagen...</span>
            </div>
          </div>
          
          <!-- Main Image -->
          <img 
            id="image-preview-img"
            src="${highResUrl}"
            alt="${escapedName}"
            class="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl opacity-0 transition-opacity duration-300"
            onload="ImagePreviewModal.handleImageLoad()"
            onerror="ImagePreviewModal.handleImageError()"
            onclick="event.stopPropagation()"
          />
          
          <!-- Image Info Panel -->
          <div 
            class="mt-4 px-4 py-3 bg-black bg-opacity-50 rounded-lg text-white max-w-lg"
            onclick="event.stopPropagation()"
          >
            <h3 class="text-lg font-semibold mb-1 truncate">${escapedName}</h3>
            <div class="flex items-center space-x-4 text-sm text-gray-300">
              <span>${escapedDimensions}</span>
              <span>•</span>
              <span>${escapedSize}</span>
              ${image.linked_articles && image.linked_articles.length > 0 ? `
                <span>•</span>
                <span>${image.linked_articles.length} artículo${image.linked_articles.length > 1 ? 's' : ''}</span>
              ` : ''}
            </div>
            ${escapedDescription ? `
              <p class="mt-2 text-sm text-gray-200">${escapedDescription}</p>
            ` : ''}
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="absolute bottom-4 right-4 flex items-center space-x-2">
          <button 
            onclick="event.stopPropagation(); ImagePreviewModal.downloadImage('${escapedId}')"
            class="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors flex items-center space-x-2"
            title="Descargar"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            <span>Descargar</span>
          </button>
        </div>
      </div>
    `;
    
    // Append to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    currentOverlay = document.getElementById('image-preview-overlay');
    
    // Add keyboard listener for ESC
    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }
  
  /**
   * Handle image load event
   */
  function handleImageLoad() {
    const loadingIndicator = document.getElementById('image-preview-loading');
    const img = document.getElementById('image-preview-img');
    
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    if (img) {
      img.style.opacity = '1';
    }
  }
  
  /**
   * Handle image error event
   */
  function handleImageError() {
    const loadingIndicator = document.getElementById('image-preview-loading');
    
    if (loadingIndicator) {
      loadingIndicator.innerHTML = `
        <div class="flex flex-col items-center">
          <svg class="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span class="text-white text-sm">Error al cargar la imagen</span>
        </div>
      `;
    }
  }
  
  /**
   * Handle overlay click (close if clicking background)
   * @param {Event} event - Click event
   */
  function handleOverlayClick(event) {
    if (event.target.id === 'image-preview-overlay') {
      closePreview();
    }
  }
  
  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      closePreview();
    }
  }
  
  /**
   * Close the preview modal
   */
  function closePreview() {
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }
    
    // Remove keyboard listener
    document.removeEventListener('keydown', handleKeyDown);
    
    // Restore body scroll
    document.body.style.overflow = '';
  }
  
  /**
   * Download image
   * @param {string} imageId - Image ID
   */
  function downloadImage(imageId) {
    ImageService.downloadImage(imageId)
      .then(() => {
        dhtmlx.message({
          type: 'success',
          text: 'Descargando imagen...'
        });
      })
      .catch(error => {
        console.error('Error downloading image:', error);
        dhtmlx.message({
          type: 'error',
          text: 'Error al descargar imagen'
        });
      });
  }
  
  // Public API
  return {
    openPreview,
    closePreview,
    handleOverlayClick,
    handleImageLoad,
    handleImageError,
    downloadImage
  };
})();
