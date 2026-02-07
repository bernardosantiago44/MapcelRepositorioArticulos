/**
 * Files Card View UI
 * Renders files in a card/gallery view with custom HTML and Tailwind CSS
 */

const FilesCardViewUI = (function() {
  'use strict';
  
  /**
   * Render the card view HTML
   * @param {Array<Object>} files - Array of file objects
   * @returns {string} HTML string for the card view
   */
  function renderCardView(files) {
    if (!files || files.length === 0) {
      return renderEmptyState();
    }
    
    const cardsHTML = files.map(file => renderCard(file)).join('');
    
    return `
      <div class="p-6 bg-gray-50 h-full overflow-auto">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${cardsHTML}
        </div>
      </div>
    `;
  }
  
  /**
   * Render a single file card
   * @param {Object} file - File object
   * @returns {string} HTML string for a card
   */
  function renderCard(file) {
    const fileExtension = getFileExtension(file.name);
    const iconClass = getFileIconClass(fileExtension);
    const formattedDate = formatDate(file.upload_date);
    
    return `
      <div 
        class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer relative"
        data-file-id="${file.id}"
        onclick="FilesCardViewUI.handleCardClick('${file.id}')"
      >
        <!-- Checkbox -->
        <div class="absolute top-3 left-3">
          <input 
            type="checkbox" 
            class="file-card-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            data-file-id="${file.id}"
            onclick="event.stopPropagation(); FilesCardViewUI.handleCheckboxChange('${file.id}')"
          />
        </div>
        
        <!-- File Icon -->
        <div class="flex justify-center mb-4 mt-2">
          <i class="${iconClass}" style="font-size: 64px; color: #94a3b8;"></i>
        </div>
        
        <!-- File Info -->
        <div class="text-center mb-3">
          <h3 class="text-sm font-semibold text-gray-900 mb-1 truncate" title="${file.name}">
            ${file.name}
          </h3>
          <p class="text-xs text-gray-500">
            ${file.size}
          </p>
        </div>
        
        <!-- Description -->
        ${file.description ? `
          <p class="text-xs text-gray-600 mb-3 line-clamp-2" title="${file.description}">
            ${file.description}
          </p>
        ` : ''}
        
        <!-- Footer -->
        <div class="flex items-center justify-between pt-3 border-t border-gray-100">
          <span class="text-xs text-gray-500">${formattedDate}</span>
          ${file.linked_articles && file.linked_articles.length > 0 ? `
            <span class="text-xs font-medium text-blue-600">
              ${file.linked_articles.length} artículo${file.linked_articles.length > 1 ? 's' : ''}
            </span>
          ` : ''}
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No hay archivos</h3>
        <p class="text-sm text-gray-500 mb-4">
          No se encontraron archivos para esta empresa.
        </p>
        <button 
          onclick="FilesCardViewUI.handleUploadClick()"
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Subir primer archivo
        </button>
      </div>
    `;
  }
  
  /**
   * Get file extension from filename
   * @param {string} filename - File name
   * @returns {string} File extension
   */
  function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }
  
  /**
   * Get icon class for file type
   * @param {string} extension - File extension
   * @returns {string} CSS class for icon
   */
  function getFileIconClass(extension) {
    const iconMap = {
      'pdf': 'fa fa-file-pdf-o',
      'doc': 'fa fa-file-word-o',
      'docx': 'fa fa-file-word-o',
      'xls': 'fa fa-file-excel-o',
      'xlsx': 'fa fa-file-excel-o',
      'csv': 'fa fa-file-excel-o',
      'ppt': 'fa fa-file-powerpoint-o',
      'pptx': 'fa fa-file-powerpoint-o',
      'txt': 'fa fa-file-text-o',
      'jpg': 'fa fa-file-image-o',
      'jpeg': 'fa fa-file-image-o',
      'png': 'fa fa-file-image-o',
      'gif': 'fa fa-file-image-o',
      'svg': 'fa fa-file-image-o',
      'zip': 'fa fa-file-archive-o',
      'rar': 'fa fa-file-archive-o',
      'mp4': 'fa fa-file-video-o',
      'avi': 'fa fa-file-video-o',
      'mp3': 'fa fa-file-audio-o',
      'wav': 'fa fa-file-audio-o',
      'json': 'fa fa-file-code-o',
      'xml': 'fa fa-file-code-o',
      'html': 'fa fa-file-code-o',
      'css': 'fa fa-file-code-o',
      'js': 'fa fa-file-code-o',
      'sql': 'fa fa-file-code-o'
    };
    
    return iconMap[extension] || 'fa fa-file-o';
  }
  
  /**
   * Format date for display
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {string} Formatted date
   */
  function formatDate(dateString) {
    if (!dateString) return '—';
    
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const parts = dateString.split('-');
    
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const month = months[parseInt(parts[1], 10) - 1];
      const year = parts[0];
      
      return `${day} ${month} ${year}`;
    }
    
    return dateString;
  }
  
  /**
   * Handle card click
   * @param {string} fileId - File ID
   */
  function handleCardClick(fileId) {
    // This will be handled by the main files tab manager
    if (window.FilesTabManager && window.FilesTabManager.handleFileSelect) {
      window.FilesTabManager.handleFileSelect(fileId);
    }
  }
  
  /**
   * Handle checkbox change
   * @param {string} fileId - File ID
   */
  function handleCheckboxChange(fileId) {
    // This will be handled by the main files tab manager
    if (window.FilesTabManager && window.FilesTabManager.handleFileCheckboxChange) {
      window.FilesTabManager.handleFileCheckboxChange(fileId);
    }
  }
  
  /**
   * Handle upload button click
   */
  function handleUploadClick() {
    if (window.FilesTabManager && window.FilesTabManager.openUploadModal) {
      window.FilesTabManager.openUploadModal();
    }
  }
  
  // Public API
  return {
    renderCardView,
    handleCardClick,
    handleCheckboxChange,
    handleUploadClick
  };
})();
