/**
 * Images Grid Helper
 * Configures and manages the DHTMLX Grid for the images list view
 */

const ImagesGridHelper = (function() {
  'use strict';
  
  /**
   * Initialize the images grid with columns and configuration
   * @param {Object} gridCell - DHTMLX Layout cell to attach grid to
   * @param {Function} onImageSelect - Callback when an image is selected
   * @returns {Object} The initialized grid instance
   */
  function initializeGrid(gridCell, onImageSelect) {
    const grid = gridCell.attachGrid();
    
    // Configure grid
    grid.setImagePath('./Dhtmlx/codebase/imgs/');
    grid.setHeader([
      '',              // Checkbox column
      'Nombre',        // Image name with icon
      'Dimensiones',   // Image dimensions
      'Tamaño',        // File size
      'Descripción',   // Description
      'Fecha',         // Upload date
      'Artículos',     // Linked articles
      'Acciones'       // Actions (view, download, edit, delete)
    ]);
    
    grid.setColTypes('ch,ro,ro,ro,ro,ro,ro,ro');
    grid.setColAlign('center,left,center,right,left,center,center,center');
    grid.setColSorting('na,str,str,str,str,str,na,na');
    grid.setInitWidths('50,250,120,100,*,120,100,150');
    
    // Enable features
    grid.enableMultiselect(true);
    grid.enableSmartRendering(true);
    
    grid.init();
    
    // Attach row selection event
    grid.attachEvent('onRowSelect', function(rowId) {
      if (onImageSelect) {
        onImageSelect(rowId);
      }
    });
    
    return grid;
  }
  
  /**
   * Load images data into the grid
   * @param {Object} grid - DHTMLX Grid instance
   * @param {string} companyCode - Company code to filter images by
   * @param {string} searchTerm - Optional search term
   */
  function loadImagesData(grid, companyCode, searchTerm, pagedResult) {
    grid.clearAll();
    
    const dataPromise = pagedResult
      ? Promise.resolve(pagedResult)
      : (searchTerm 
        ? ImageService.searchImages(companyCode, searchTerm)
        : ImageService.getImagesPagedResult(companyCode));
    
    dataPromise
      .then(result => {
        const images = Array.isArray(result) ? result : (result && result.data) ? result.data : [];
        images.forEach(image => {
          const rowId = image.id;
          
          // Escape user data for grid cells
          const escapedDimensions = Utils.escapeHtml(image.dimensions) || '—';
          const escapedSize = Utils.escapeHtml(image.size);
          const escapedDescription = Utils.escapeHtml(image.description) || '—';
          
          grid.addRow(rowId, [
            0,  // Unchecked checkbox
            renderImageNameCell(image),
            escapedDimensions,
            escapedSize,
            escapedDescription,
            Utils.formatDate(image.upload_date),
            renderArticlesCell(image.linked_articles),
            renderActionsCell(image.id)
          ]);
        });
      })
      .catch(error => {
        if (error.status === 404) {
          // No images found, render empty state
          grid.clearAll();
        } else {
          console.error('Error loading images:', error);
          dhtmlx.message({
            type: 'error',
            text: 'Error al cargar imágenes: ' + error.message
          });
        }
      });
  }
  
  /**
   * Render the image name cell with icon
   * @param {Object} image - Image object
   * @returns {string} HTML string for the cell
   */
  function renderImageNameCell(image) {
    const fileExtension = Utils.getFileExtension(image.name);
    const escapedName = Utils.escapeHtml(image.name);
    
    return `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fa fa-file-image-o" style="font-size: 18px; color: #64748b;"></i>
        <span style="font-weight: 500;">${escapedName}</span>
      </div>
    `;
  }
  
  /**
   * Render the articles cell
   * @param {Array<string>} linkedArticles - Array of article IDs
   * @returns {string} HTML string for the cell
   */
  function renderArticlesCell(linkedArticles) {
    if (!linkedArticles || linkedArticles.length === 0) {
      return '—';
    }
    
    return `<span style="color: #3b82f6; font-weight: 500;">${linkedArticles.length}</span>`;
  }
  
  /**
   * Render the actions cell with icon buttons
   * @param {string} imageId - Image ID
   * @returns {string} HTML string for the cell
   */
  function renderActionsCell(imageId) {
    return `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <button 
          onclick="ImagesGridHelper.handleViewImage('${imageId}')"
          class="action-btn"
          title="Ver imagen"
          style="border: none; background: none; cursor: pointer; padding: 4px;"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #64748b;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
        </button>
        <button 
          onclick="ImagesGridHelper.handleDownloadImage('${imageId}')"
          class="action-btn"
          title="Descargar imagen"
          style="border: none; background: none; cursor: pointer; padding: 4px;"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #64748b;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
        </button>
        <button 
          onclick="ImagesGridHelper.handleEditImage('${imageId}')"
          class="action-btn"
          title="Editar descripción"
          style="border: none; background: none; cursor: pointer; padding: 4px;"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #64748b;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </button>
        <button 
          onclick="ImagesGridHelper.handleDeleteImage('${imageId}')"
          class="action-btn"
          title="Eliminar imagen"
          style="border: none; background: none; cursor: pointer; padding: 4px;"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #ef4444;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;
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
  
  // Public API
  return {
    initializeGrid,
    loadImagesData,
    handleViewImage,
    handleDownloadImage,
    handleEditImage,
    handleDeleteImage
  };
})();
