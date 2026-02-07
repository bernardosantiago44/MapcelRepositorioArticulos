/**
 * File Metadata Editor UI
 * Modal for editing file descriptions
 */

const FileMetadataEditorUI = (function() {
  'use strict';
  
  let currentWindow = null;
  
  /**
   * Open the metadata editor modal
   * @param {string} fileId - File ID to edit
   * @param {Function} onSaveComplete - Callback function when save completes
   */
  function openEditModal(fileId, onSaveComplete) {
    // Load file data first
    FileService.getFileById(fileId)
      .then(file => {
        if (!file) {
          dhtmlx.message({
            type: 'error',
            text: 'Archivo no encontrado'
          });
          return;
        }
        
        // Create DHTMLX Window
        if (currentWindow) {
          currentWindow.unload();
        }
        
        currentWindow = new dhtmlXWindows();
        const editWindow = currentWindow.createWindow('file_metadata_window', 0, 0, 500, 500);
        editWindow.setText('Editar descripción');
        editWindow.centerOnScreen();
        editWindow.button('minmax').hide();
        
        // Attach HTML content
        editWindow.attachHTMLString(renderEditForm(file));
        
        // Setup event handlers after content is attached
        setTimeout(() => {
          setupEventHandlers(file, editWindow, onSaveComplete);
        }, 100);
      })
      .catch(error => {
        console.error('Error loading file:', error);
        dhtmlx.message({
          type: 'error',
          text: 'Error al cargar archivo'
        });
      });
  }
  
  /**
   * Render the edit form HTML
   * @param {Object} file - File object
   * @returns {string} HTML string for the edit form
   */
  function renderEditForm(file) {
    return `
      <div class="p-6 bg-white h-full flex flex-col">
        <!-- File Name (Read-only) -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Archivo
          </label>
          <div class="flex items-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
            <i class="fa fa-file-o text-gray-400"></i>
            <span class="text-sm text-gray-700 font-medium">${file.name}</span>
          </div>
        </div>
        
        <!-- Description Field -->
        <div class="flex-1 mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea 
            id="file-metadata-description"
            rows="5"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Agrega una descripción para el archivo..."
          >${file.description || ''}</textarea>
          <p class="mt-1 text-xs text-gray-500">
            Esta descripción ayudará a otros usuarios a entender el contenido del archivo.
          </p>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button 
            id="file-metadata-cancel-btn"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button 
            id="file-metadata-save-btn"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Guardar
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Setup event handlers for the edit form
   * @param {Object} file - File object
   * @param {Object} editWindow - DHTMLX Window instance
   * @param {Function} onSaveComplete - Callback function
   */
  function setupEventHandlers(file, editWindow, onSaveComplete) {
    const descriptionTextarea = document.getElementById('file-metadata-description');
    const cancelBtn = document.getElementById('file-metadata-cancel-btn');
    const saveBtn = document.getElementById('file-metadata-save-btn');
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
      editWindow.close();
    });
    
    // Save button
    saveBtn.addEventListener('click', () => {
      const newDescription = descriptionTextarea.value.trim();
      
      // Show loading state
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
      
      // Call file service to update metadata
      FileService.updateFileMetadata(file.id, newDescription)
        .then(updatedFile => {
          // Show success message
          dhtmlx.message({
            type: 'success',
            text: 'Descripción actualizada correctamente'
          });
          
          // Call completion callback
          if (onSaveComplete) {
            onSaveComplete(updatedFile);
          }
          
          // Close window
          editWindow.close();
        })
        .catch(error => {
          console.error('Error updating file metadata:', error);
          dhtmlx.message({
            type: 'error',
            text: 'Error al actualizar descripción: ' + error.message
          });
          
          // Reset button state
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar';
        });
    });
  }
  
  // Public API
  return {
    openEditModal
  };
})();
