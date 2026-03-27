/**
 * Files Grid Helper
 * Configures and manages the DHTMLX Grid for the files list view
 */

const FilesGridHelper = (function() {
  'use strict';
  
  /**
   * Initialize the files grid with columns and configuration
   * @param {Object} gridCell - DHTMLX Layout cell to attach grid to
   * @param {Function} onFileSelect - Callback when a file is selected
   * @returns {Object} The initialized grid instance
   */
  function initializeGrid(gridCell, onFileSelect) {
    const grid = gridCell.attachGrid();
    
    // Configure grid
    grid.setImagePath('./Dhtmlx/codebase/imgs/');
    grid.setHeader([
      '',              // Checkbox column
      'Nombre',        // File name with icon
      'Tamaño',        // File size
      'Descripción',   // Description
      'Fecha',         // Upload date
      'Artículos',     // Linked articles
      'Acciones'       // Actions (view, download, edit, delete)
    ]);
    
    grid.setColTypes('ch,ro,ro,ro,ro,ro,ro');
    grid.setColAlign('center,left,right,left,center,center,center');
    grid.setColSorting('na,str,str,str,str,na,na');
    grid.setInitWidths('50,300,100,*,120,120,150');
    
    // Enable features
    grid.enableMultiselect(true);
    grid.enableSmartRendering(true);
    
    grid.init();
    
    // Attach row selection event
    grid.attachEvent('onRowSelect', function(rowId) {
      if (onFileSelect) {
        onFileSelect(rowId);
      }
    });
    
    return grid;
  }
  
  /**
   * Load files data into the grid
   * @param {Object} grid - DHTMLX Grid instance
   * @param {string} companyCode - Company code to filter files by
   * @param {string} searchTerm - Optional search term
   */
   function loadFilesData(grid, companyCode, searchTerm, pagedResult) {
    grid.clearAll();
    
    const dataPromise = pagedResult
      ? Promise.resolve(pagedResult)
      : (searchTerm 
        ? FileService.searchFiles(companyCode, searchTerm)
        : FileService.getFilesPagedResult(companyCode));
    
    dataPromise
      .then(result => {
        const files = Array.isArray(result) ? result : (result && result.data) ? result.data : [];
        files.forEach(file => {
          const rowId = file.id;
          
          grid.addRow(rowId, [
            0,  // Unchecked checkbox
            renderFileNameCell(file),
            file.size,
            file.description || '—',
            formatDate(file.upload_date),
            renderArticlesCell(file.linked_articles),
            renderActionsCell(file.id)
          ]);
        });
      })
      .catch(error => {
        console.error('Error loading files:', error);
        dhtmlx.message({
          type: 'error',
          text: 'Error al cargar archivos: ' + error.message
        });
      });
  }
  
  /**
   * Render the file name cell with icon
   * @param {Object} file - File object
   * @returns {string} HTML string for the cell
   */
  function renderFileNameCell(file) {
    const fileExtension = getFileExtension(file.name);
    const iconClass = getFileIconClass(fileExtension);
    
    return `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="${iconClass}" style="font-size: 18px; color: #64748b;"></i>
        <span style="font-weight: 500;">${file.name}</span>
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
   * @param {string} fileId - File ID
   * @returns {string} HTML string for the cell
   */
  function renderActionsCell(fileId) {
    return `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <button 
          onclick="FilesGridHelper.handleViewFile('${fileId}')"
          class="action-btn"
          title="Ver archivo"
          style="border: none; background: none; cursor: pointer; padding: 4px;"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #64748b;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
        </button>
        <button 
          onclick="FilesGridHelper.handleDownloadFile('${fileId}')"
          class="action-btn"
          title="Descargar archivo"
          style="border: none; background: none; cursor: pointer; padding: 4px;"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #64748b;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
        </button>
        <button 
          onclick="FilesGridHelper.handleEditFile('${fileId}')"
          class="action-btn"
          title="Editar descripción"
          style="border: none; background: none; cursor: pointer; padding: 4px;"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #64748b;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </button>
        <button 
          onclick="FilesGridHelper.handleDeleteFile('${fileId}')"
          class="action-btn"
          title="Eliminar archivo"
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
   * Handle view file action
   * @param {string} fileId - File ID
   */
  function handleViewFile(fileId) {
    FileService.getFileById(fileId, CompanyRouting.getCompanyCodeFromUrl())
      .then(file => {
        if (file) {
          dhtmlx.message({
            type: 'info',
            text: 'Visualizando archivo: ' + file.name
          });
          // In a real app, this would open a file viewer
        }
      })
      .catch(error => {
        console.error('Error viewing file:', error);
      });
  }
  
  /**
   * Handle download file action
   * @param {string} fileId - File ID
   */
  function handleDownloadFile(fileId) {
    FileService.downloadFile(fileId, CompanyRouting.getCompanyCodeFromUrl())
      .then(() => {
        dhtmlx.message({
          type: 'success',
          text: 'Descargando archivo...'
        });
      })
      .catch(error => {
        console.error('Error downloading file:', error);
        dhtmlx.message({
          type: 'error',
          text: 'Error al descargar archivo'
        });
      });
  }
  
  /**
   * Handle edit file action
   * @param {string} fileId - File ID
   */
  function handleEditFile(fileId) {
    // This will be called from the global scope, so we need to access the current grid
    // We'll emit a custom event that the main app can listen to
    if (window.FilesTabManager && window.FilesTabManager.openEditDescriptionModal) {
      window.FilesTabManager.openEditDescriptionModal(fileId);
    }
  }
  
  /**
   * Handle delete file action
   * @param {string} fileId - File ID
   */
  function handleDeleteFile(fileId) {
    dhtmlx.confirm({
      title: 'Confirmar eliminación',
      text: '¿Estás seguro de que deseas eliminar este archivo?',
      ok: 'Eliminar',
      cancel: 'Cancelar',
      callback: function(result) {
        if (result) {
          FileService.deleteFile(fileId, CompanyRouting.getCompanyCodeFromUrl())
            .then(() => {
              dhtmlx.message({
                type: 'success',
                text: 'Archivo eliminado correctamente'
              });
              
              // Reload the grid
              if (window.FilesTabManager && window.FilesTabManager.refreshFilesList) {
                window.FilesTabManager.refreshFilesList();
              }
            })
            .catch(error => {
              console.error('Error deleting file:', error);
              dhtmlx.message({
                type: 'error',
                text: 'Error al eliminar archivo'
              });
            });
        }
      }
    });
  }
  
  // Public API
  return {
    initializeGrid,
    loadFilesData,
    handleViewFile,
    handleDownloadFile,
    handleEditFile,
    handleDeleteFile
  };
})();
