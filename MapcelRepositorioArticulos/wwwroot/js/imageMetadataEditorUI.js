/**
 * Image Metadata Editor UI
 * Modal for editing image descriptions
 * Reuses the pattern from FileMetadataEditorUI
 */

const ImageMetadataEditorUI = (function() {
  'use strict';
  
  let currentWindow = null;
  let activeResolver = null;
  let activeRejecter = null;
  let dimensions = null;
  
  function closeCurrentWindow() {
    if (currentWindow) {
      try {
        currentWindow.unload();
      } catch (e) {
        // ignore window cleanup failures
      }
      currentWindow = null;
    }
  }

  /**
   * Prompt for metadata before uploading a new local file (description + desired filename)
   * @param {File} file - The local file about to be uploaded
   * @param {{description?: string, desiredFileName?: string}} initialMetadata - Optional metadata to prefill
   * @returns {Promise<{description: string, desiredFileName: string, clientTempId: string}|null>}
   */
  function promptForFileMetadata(file, initialMetadata) {
    if (!file) return Promise.resolve(null);
    
    if (activeRejecter || activeResolver) {
      const previousReject = activeRejecter;
      closeCurrentWindow();
      if (typeof previousReject === 'function') {
        previousReject(new Error('Ya hay un diálogo de metadatos abierto.'));
      }
      activeRejecter = null;
      activeResolver = null;
      dimensions = null;
    }
    
    return new Promise((resolve, reject) => {
      activeResolver = resolve;
      activeRejecter = reject;
      dimensions = initialMetadata.dimensions;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target.result;
        openNewFileWindow(file, previewUrl, initialMetadata || {}, resolve);
      };
      reader.onerror = () => {
        reject(new Error('No se pudo leer el archivo para vista previa.'));
      };
      return reader.readAsDataURL(file);
    });
  }
  
  function openNewFileWindow(file, previewUrl, initialMetadata, resolver) {
    closeCurrentWindow();
    
    currentWindow = new dhtmlXWindows();
    const modalWidth = 560;
    const modalHeight = 640;
    const metadataWindow = currentWindow.createWindow('image_metadata_new_file', 0, 0, modalWidth, modalHeight);
    metadataWindow.setText('Agregar detalles de la imagen');
    metadataWindow.centerOnScreen();
    metadataWindow.button('minmax').hide();
    
    const escapedFileName = Utils.escapeHtml(initialMetadata.desiredFileName || file.name);
    const escapedDescription = Utils.escapeHtml(initialMetadata.description || '');
    
    metadataWindow.attachHTMLString(`
      <div class="p-6 bg-white h-full flex flex-col space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Vista previa</label>
          <div class="relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
            <img src="${previewUrl}" alt="${escapedFileName}" class="max-h-full max-w-full object-contain" />
          </div>
        </div>
        
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">Nombre de archivo</label>
          <input 
            id="image-metadata-new-name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value="${escapedFileName}"
            placeholder="${Utils.escapeHtml(file.name)}"
          />
          <p class="text-xs text-gray-500">Se usará como nombre visible al subir el archivo.</p>
        </div>
        
        <div class="space-y-2 flex-1">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-gray-700">Descripción</label>
            <button 
              type="button"
              id="image-metadata-copy-name-btn"
              class="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 hover:bg-gray-200 transition-colors"
            >
              Copiar nombre
            </button>
          </div>
          <textarea 
            id="image-metadata-new-description"
            rows="4"
            class="w-full h-28 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Agrega una descripción para la imagen..."
          >${escapedDescription}</textarea>
          <p class="text-xs text-gray-500">Usa la descripción para que otros entiendan el contexto de la imagen.</p>
        </div>
        
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button 
            type="button"
            id="image-metadata-cancel-new-btn"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button 
            type="button"
            id="image-metadata-save-new-btn"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Guardar
          </button>
        </div>
      </div>
    `);
    
    setTimeout(() => {
      attachNewFileHandlers(metadataWindow, file, initialMetadata || {}, resolver);
    }, 50);
  }
  
  function attachNewFileHandlers(metadataWindow, file, initialMetadata, resolver) {
    const nameInput = document.getElementById('image-metadata-new-name');
    const descriptionTextarea = document.getElementById('image-metadata-new-description');
    const cancelBtn = document.getElementById('image-metadata-cancel-new-btn');
    const saveBtn = document.getElementById('image-metadata-save-new-btn');
    const copyBtn = document.getElementById('image-metadata-copy-name-btn');
    
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const desiredName = (nameInput && nameInput.value) || file.name;
        if (descriptionTextarea) {
          descriptionTextarea.value = desiredName;
          descriptionTextarea.focus();
        }
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        resolver(null);
        closeCurrentWindow();
        activeResolver = null;
        activeRejecter = null;
      });
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const desiredFileName = (nameInput && nameInput.value ? nameInput.value.trim() : '') || file.name;
        const descriptionValue = descriptionTextarea ? descriptionTextarea.value.trim() : '';
        const clientTempId = initialMetadata && initialMetadata.clientTempId
          ? String(initialMetadata.clientTempId)
          : '';
        
        resolver({
          description: descriptionValue,
          desiredFileName: desiredFileName,
          clientTempId: clientTempId,
          dimensions: dimensions,
        });
        
        closeCurrentWindow();
        activeResolver = null;
        activeRejecter = null;
      });
    }
  }
  
  /**
   * Open the metadata editor modal
   * @param {string} imageId - Image ID to edit
   * @param {Function} onSaveComplete - Callback function when save completes
   */
  function openEditModal(imageId, onSaveComplete) {
    // Load image data first
    ImageService.getImageById(imageId)
      .then(image => {
        if (!image) {
          dhtmlx.message({
            type: 'error',
            text: 'Imagen no encontrada'
          });
          return;
        }
        
        // Create DHTMLX Window
        closeCurrentWindow();
        
        currentWindow = new dhtmlXWindows();
        const editWindow = currentWindow.createWindow('image_metadata_window', 0, 0, 700, 700);
        editWindow.setText('Editar descripción');
        editWindow.centerOnScreen();
        editWindow.button('minmax').hide();
        
        // Attach HTML content
        editWindow.attachHTMLString(renderEditForm(image));
        
        // Setup event handlers after content is attached
        setTimeout(() => {
          setupEventHandlers(image, editWindow, onSaveComplete);
        }, 100);
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
   * Render the edit form HTML
   * @param {Object} image - Image object
   * @returns {string} HTML string for the edit form
   */
  function renderEditForm(image) {
    // Escape user-controlled data to prevent XSS
    const escapedName = Utils.escapeHtml(image.name || '');
    const escapedDescription = Utils.escapeHtml(image.description || '');
    const escapedDimensions = image.width && image.height ? Utils.escapeHtml(`${image.width}px x ${image.height}px` || '') : '—';
    const escapedSize = Utils.escapeHtml(Utils.formatBytes(image.sizeBytes ?? 0));
    const escapedThumbnailUrl = Utils.escapeHtml(image.thumbnailUrl);
    
    return `
      <div class="p-6 bg-white h-full flex flex-col">
        <!-- Image Preview -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Vista previa
          </label>
          <div class="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
            <img 
              src="${escapedThumbnailUrl}"
              alt="${escapedName}"
              class="w-full h-full object-contain"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="absolute inset-0 items-center justify-center bg-gray-100 hidden">
              <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <!-- Image Name (Read-only) -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Nombre
          </label>
          <div class="flex items-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
            <i class="fa fa-file-image-o text-gray-400"></i>
            <span class="text-sm text-gray-700 font-medium">${escapedName}</span>
          </div>
        </div>
        
        <!-- Image Info (Read-only) -->
        <div class="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Dimensiones
            </label>
            <div class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
              ${escapedDimensions || '—'}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Tamaño
            </label>
            <div class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
              ${escapedSize || '—'}
            </div>
          </div>
        </div>
        
        <!-- Description Field -->
        <div class="flex-1 mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea 
            id="image-metadata-description"
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Agrega una descripción para la imagen..."
          >${escapedDescription || ''}</textarea>
          <p class="mt-1 text-xs text-gray-500">
            Esta descripción ayudará a otros usuarios a entender el contenido de la imagen.
          </p>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button 
            id="image-metadata-cancel-btn"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button 
            id="image-metadata-save-btn"
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
   * @param {Object} image - Image object
   * @param {Object} editWindow - DHTMLX Window instance
   * @param {Function} onSaveComplete - Callback function
   */
  function setupEventHandlers(image, editWindow, onSaveComplete) {
    const descriptionTextarea = document.getElementById('image-metadata-description');
    const cancelBtn = document.getElementById('image-metadata-cancel-btn');
    const saveBtn = document.getElementById('image-metadata-save-btn');
    
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
      
      // Call image service to update metadata
      ImageService.updateImageMetadata(image.id, newDescription, CompanyRouting.getCompanyCodeFromUrl())
        .then(updatedImage => {
          // Show success message
          dhtmlx.message({
            type: 'success',
            text: 'Descripción actualizada correctamente',
          });
          
          // Call completion callback
          if (onSaveComplete) {
            onSaveComplete(updatedImage);
          }
          
          // Close window
          editWindow.close();
        })
        .catch(error => {
          console.error('Error updating image metadata:', error);
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
    openEditModal,
    promptForFileMetadata
  };
})();
