/**
 * UI Helper Module for Article Detail Sidebar
 * Provides functions to render article details in the sidebar
 * 
 * Dependencies:
 * - dataModels.js (must be loaded before this module for getStatusConfiguration function)
 * - tagBadge.js (must be loaded before this module for renderTagBadges function)
 * - imageService.js (for fetching images linked to articles)
 * - fileService.js (for fetching files linked to articles)
 * - imagePreviewModal.js (for opening image lightbox)
 * - utils.js (for escapeHtml and getFileExtension functions)
 */

const ArticleDetailUI = (function() {
  'use strict';
  
  /**
   * Format date from YYYY-MM-DD to a more readable format
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {string} Formatted date
   */
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
  }
  
  /**
   * Render status badge HTML
   * @param {string} status - Status value
   * @param {Object} statusConfig - Status configuration
   * @returns {string} HTML for status badge
   */
  function renderStatusBadge(status, statusConfig) {
    const backgroundColor = statusConfig.color || '#8c8c8c';
    const label = statusConfig.label || status;
    
    return `
      <span
        class="inline-block px-3 py-1 rounded bg-[${backgroundColor}] text-white text-xs font-semibold uppercase"
      >
        ${label}
      </span>
    `;
  }
  
  /**
   * Render external link button or "no link" message
   * @param {string} externalLink - External link URL
   * @returns {string} HTML for external link section
   */
  function renderExternalLinkSection(externalLink) {
    if (!externalLink || externalLink.trim() === '') {
      return `
        <div
          class="p-3 
            bg-gray-100 
            rounded-lg 
            text-gray-400 
            text-[13px] 
            italic 
            text-center"
        >
          Sin enlace externo
        </div>

      `;
    }
    
    return `
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Enlace al ticket
        </label>

        <div class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <div class="flex items-center gap-2 text-sm text-gray-800 truncate">
            <i data-lucide="external-link" class="h-4 w-4 text-gray-500"></i>

            <a
              href=${externalLink}
              target="_blank"
              class="truncate hover:underline"
            >
              ${externalLink}
            </a>
          </div>

          <button
            type="button"
            class="ml-3 text-gray-500 hover:text-gray-700"
            title="Copiar"
            onclick="navigator.clipboard.writeText('${externalLink}')"
          >
            <i data-lucide="copy" class="h-5 w-5"></i>
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Render a content section with title and body
   * @param {string} sectionTitle - Section title
   * @param {string} content - Section content
   * @returns {string} HTML for content section
   */
  function renderContentSection(sectionTitle, content) {
    const displayContent = content && content.trim() !== '' 
      ? '<div class="markdown-body">' + Utils.renderMarkdown(content) + '</div>'
      : '<em style="color: #8c8c8c;">No hay información disponible</em>';
    
    return `
      <div style="margin-bottom: 20px;">
        <div style="
          font-size: 13px;
          font-weight: 600;
          color: #262626;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">${sectionTitle}</div>
        <div style="
          font-size: 14px;
          line-height: 1.6;
          color: #595959;
        ">${displayContent}</div>
      </div>
    `;
  }
  
  /**
   * Get file icon based on file extension
   * @param {string} filename - File name
   * @returns {string} Lucide icon name
   */
  function getFileIcon(filename) {
    const extension = Utils.getFileExtension(filename);
    
    const iconMap = {
      pdf: 'file-text',
      doc: 'file-text',
      docx: 'file-text',
      txt: 'file-text',
      md: 'file-text',
      xls: 'file-spreadsheet',
      xlsx: 'file-spreadsheet',
      csv: 'file-spreadsheet',
      ppt: 'file-presentation',
      pptx: 'file-presentation',
      zip: 'file-archive',
      rar: 'file-archive',
      '7z': 'file-archive',
      json: 'file-json',
      xml: 'file-code',
      sql: 'database',
      js: 'file-code',
      ts: 'file-code',
      html: 'file-code',
      css: 'file-code'
    };
    
    return iconMap[extension] || 'file';
  }
  
  /**
   * Render an image thumbnail for the attachments section
   * @param {Object} image - Image object
   * @returns {string} HTML for image thumbnail
   */
  function renderImageThumbnail(image) {
    const escapedId = Utils.escapeHtml(image.id);
    const escapedName = Utils.escapeHtml(image.name);
    const escapedThumbnailUrl = Utils.escapeHtml(image.thumbnail_url);
    
    return `
      <div 
        class="relative aspect-square w-16 h-16 rounded-md overflow-hidden border border-gray-200 cursor-pointer group flex-shrink-0"
        data-image-id="${escapedId}"
        tabindex="0"
        role="button"
        aria-label="Ver imagen ${escapedName}"
        title="${escapedName}"
      >
        <img 
          src="${escapedThumbnailUrl}" 
          alt="${escapedName}"
          class="w-full h-full object-cover"
        />
        <!-- Hover overlay -->
        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
          <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center">
            <i data-lucide="eye" class="w-5 h-5 text-white"></i>
          </div>
        </div>
        <!-- Filename on hover -->
        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ${escapedName}
        </div>
      </div>
    `;
  }
  
  /**
   * Render a file item badge for the attachments section
   * @param {Object} file - File object
   * @returns {string} HTML for file item
   */
  function renderFileItem(file) {
    const escapedId = Utils.escapeHtml(file.id);
    const escapedName = Utils.escapeHtml(file.name);
    const escapedSize = Utils.escapeHtml(file.size);
    const iconName = getFileIcon(file.name);
    
    return `
      <div 
        class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors duration-150"
        data-file-id="${escapedId}"
        tabindex="0"
        role="button"
        aria-label="Descargar ${escapedName}"
        title="Clic para descargar ${escapedName}"
      >
        <i data-lucide="${iconName}" class="w-4 h-4 text-gray-500 flex-shrink-0"></i>
        <span class="text-sm text-gray-700 truncate flex-1">${escapedName}</span>
        <span class="text-xs text-gray-400 flex-shrink-0">${escapedSize}</span>
        <i data-lucide="download" class="w-3 h-3 text-gray-400 flex-shrink-0"></i>
      </div>
    `;
  }
  
  /**
   * Render the attachments section HTML (images and files)
   * @param {Array<Object>} images - Array of image objects
   * @param {Array<Object>} files - Array of file objects
   * @returns {string} HTML for attachments section
   */
  function renderAttachmentsSection(images, files) {
    const hasImages = images && images.length > 0;
    const hasFiles = files && files.length > 0;
    const hasAttachments = hasImages || hasFiles;
    
    // Empty state
    if (!hasAttachments) {
      return `
        <div
          class="p-3 
            bg-gray-100 
            rounded-lg
            text-gray-400 
            text-[13px] 
            italic 
            text-center"
        >
          Sin archivos adjuntos
        </div>
      `;
    }
    
    let html = '';
    
    // Images ribbon
    if (hasImages) {
      const imagesThumbnails = images.map(img => renderImageThumbnail(img)).join('');
      html += `
        <div class="mb-3">
          <div class="text-xs font-medium text-gray-500 mb-2">Imágenes (${images.length})</div>
          <div class="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
            ${imagesThumbnails}
          </div>
        </div>
      `;
    }
    
    // Files list
    if (hasFiles) {
      const filesItems = files.map(file => renderFileItem(file)).join('');
      html += `
        <div>
          <div class="text-xs font-medium text-gray-500 mb-2">Archivos (${files.length})</div>
          <div class="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
            ${filesItems}
          </div>
        </div>
      `;
    }
    
    return html;
  }
  
  /**
   * Handle image thumbnail click/keypress
   * @param {string} imageId - Image ID to preview
   */
  function handleImageClick(imageId) {
    if (imageId && typeof ImagePreviewModal !== 'undefined') {
      ImagePreviewModal.openPreview(imageId);
    }
  }
  
  /**
   * Handle file item click/keypress
   * @param {string} fileId - File ID to download
   */
  function handleFileClick(fileId) {
    if (fileId && typeof FileService !== 'undefined') {
      FileService.downloadFile(fileId)
        .then(function() {
          if (typeof dhtmlx !== 'undefined') {
            dhtmlx.message({ type: 'success', text: 'Descargando archivo...' });
          }
        })
        .catch(function(err) {
          console.error('Error downloading file:', err);
          if (typeof dhtmlx !== 'undefined') {
            dhtmlx.message({ type: 'error', text: 'Error al descargar' });
          }
        });
    }
  }
  
  /**
   * Attach event listeners to image thumbnails and file items
   * @param {HTMLElement} container - Container element with thumbnails and files
   */
  function attachAttachmentEventListeners(container) {
    // Attach click and keyboard handlers to image thumbnails
    const imageThumbnails = container.querySelectorAll('[data-image-id]');
    imageThumbnails.forEach(function(thumbnail) {
      const imageId = thumbnail.getAttribute('data-image-id');
      
      thumbnail.addEventListener('click', function() {
        handleImageClick(imageId);
      });
      
      thumbnail.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleImageClick(imageId);
        }
      });
    });
    
    // Attach click and keyboard handlers to file items
    const fileItems = container.querySelectorAll('[data-file-id]');
    fileItems.forEach(function(fileItem) {
      const fileId = fileItem.getAttribute('data-file-id');
      
      fileItem.addEventListener('click', function() {
        handleFileClick(fileId);
      });
      
      fileItem.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleFileClick(fileId);
        }
      });
    });
  }
  
  /**
   * Render the loading spinner HTML
   * @returns {string} HTML for loading spinner
   */
  function renderLoadingSpinner() {
    return `
      <div class="flex items-center justify-center py-4 text-gray-400">
        <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm">Cargando adjuntos...</span>
      </div>
    `;
  }
  
  /**
   * Load and render attachments for an article
   * This function should be called after the sidebar HTML is attached to the DOM
   * @param {string} articleId - Article ID to load attachments for
   */
  function loadAttachments(articleId) {
    const attachmentsContainer = document.getElementById('article-attachments-container');
    
    if (!attachmentsContainer) {
      console.warn('Attachments container not found in DOM');
      return;
    }
    
    // Validate articleId
    if (!articleId || typeof articleId !== 'string') {
      attachmentsContainer.innerHTML = renderAttachmentsSection([], []);
      return;
    }
    
    // Show loading state
    attachmentsContainer.innerHTML = renderLoadingSpinner();
    
    // Fetch images and files in parallel
    Promise.all([
      ImageService.getImagesByArticle(articleId),
      FileService.getFilesByArticle(articleId)
    ])
      .then(function(results) {
        const images = results[0];
        const files = results[1];
        
        // Render attachments
        attachmentsContainer.innerHTML = renderAttachmentsSection(images, files);
        
        // Attach event listeners for click and keyboard interactions
        attachAttachmentEventListeners(attachmentsContainer);
        
        // Re-initialize lucide icons for the new content
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      })
      .catch(function(error) {
        console.error('Error loading attachments:', error);
        attachmentsContainer.innerHTML = `
          <div style="
            padding: 12px;
            background-color: #fff5f5;
            border-radius: 4px;
            color: #ff4d4f;
            font-size: 13px;
            text-align: center;
          ">Error al cargar adjuntos</div>
        `;
      });
  }
  
  /**
   * Render the complete article detail sidebar
   * @param {Article} article - Article object with properties:
   *   - id {string}: Article ID
   *   - title {string}: Article title
   *   - description {string}: Article description
   *   - status {string}: Article status (Producción|Borrador|Cerrado)
   *   - tags {Array<{label: string, color: string}>}: Array of tag objects
   *   - externalLink {string}: External link URL
   *   - clientComments {string}: Client comments
   *   - createdAt {string}: Creation date (YYYY-MM-DD)
   *   - updatedAt {string}: Last update date (YYYY-MM-DD)
   * @param {string} companyName - Company name to display
   * @param {boolean} showEditButton - Whether to show edit button (true for administrators, false for regular users)
   * @returns {string} Complete HTML string for article detail sidebar
   */
  function renderArticleDetailSidebar(article, companyName, showEditButton) {
    const statusConfig = getStatusConfiguration(article.status);
    
    const editButtonHtml = showEditButton ? `
      <button
        id="edit-article-btn"
        class="w-full p-3 bg-green-500 hover:bg-green-400 text-white border-none rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-200"
      >
        Editar Artículo
      </button>
    ` : '';
    
    return `
      <div style="
        padding: 20px;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      ">
        <!-- Header: Status and ID -->
        <div style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          ${renderStatusBadge(article.status, statusConfig)}
          <span style="font-size: 12px; color: #8c8c8c; font-weight: 500;">${article.id}</span>
        </div>
        
        <!-- Metadata: Created and Updated dates -->
        <div style="
          font-size: 12px;
          color: #8c8c8c;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e8e8e8;
        ">
          <span>Creado: ${formatDate(article.createdAt)}</span>
          <span style="margin: 0 8px;">|</span>
          <span>Modificado: ${formatDate(article.updatedAt)}</span>
        </div>
        
        <!-- Title -->
        <h2 style="
          font-size: 20px;
          font-weight: 700;
          color: #262626;
          line-height: 1.4;
          margin: 0 0 16px 0;
          word-wrap: break-word;
        ">${article.title}</h2>
        
        <!-- Context: Company Name -->
        <div
          class="text-sm text-gray-600 mb-5 p-2.5 bg-gray-100 rounded-lg"
        >
          <strong>Empresa:</strong> ${companyName}
        </div>

        
        <!-- Tags Section -->
        <div style="margin-bottom: 24px;">
          <div style="
            font-size: 13px;
            font-weight: 600;
            color: #262626;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Etiquetas</div>
          ${renderTagBadges(article.tags)}
        </div>
        
        <!-- External Link Section -->
        <div style="margin-bottom: 24px;">
          <div style="
            font-size: 13px;
            font-weight: 600;
            color: #262626;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Enlace Externo</div>
          ${renderExternalLinkSection(article.externalLink)}
        </div>
        
        <!-- Description Section -->
        ${renderContentSection('Descripción del artículo', article.description)}
        
        <!-- Client Comments Section -->
        ${renderContentSection('Comentarios del cliente', article.clientComments)}
        
        <!-- Attachments Section: Images and Files -->
        <div style="margin-bottom: 24px;">
          <div style="
            font-size: 13px;
            font-weight: 600;
            color: #262626;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Archivos e Imágenes adjuntos</div>
          <div id="article-attachments-container" data-article-id="${article.id}">
            <!-- Attachments will be loaded asynchronously -->
            <div class="flex items-center justify-center py-4 text-gray-400">
              <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm">Cargando adjuntos...</span>
            </div>
          </div>
        </div>
        
        <!-- Edit Button (Admin Only) -->
        ${editButtonHtml}
      </div>
    `;
  }
  
  /**
   * Render empty state for sidebar when no article is selected
   * @returns {string} HTML for empty state
   */
  function renderEmptyState() {
    return `
      <div style="
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        text-align: center;
        color: #8c8c8c;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">
          Ningún artículo seleccionado
        </div>
        <div style="font-size: 14px;">
          Seleccione un artículo de la lista para ver sus detalles
        </div>
      </div>
    `;
  }
  
  // Public API
  return {
    renderArticleDetailSidebar: renderArticleDetailSidebar,
    renderEmptyState: renderEmptyState,
    loadAttachments: loadAttachments,
    formatDate: formatDate
  };
})();
