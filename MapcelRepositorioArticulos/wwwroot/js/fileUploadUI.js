/**
 * File Upload UI Component
 * A reusable component for uploading files with drag-and-drop support
 * Can be used as a standalone modal or embedded within other forms
 */

const FileUploadUI = (function() {
  'use strict';
  
  // Configuration
  const MAX_FILE_SIZE_MB = 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  
  let currentWindow = null;
  let selectedFiles = []; // Array of { file: File, description: string }
  
  function parseFileIndex(element) {
    return parseInt(element.getAttribute('data-file-index'), 10);
  }
  
  /**
   * Open the file upload modal
   * @param {string} companyCode - Company code to associate uploaded files with
   * @param {Function} onUploadComplete - Callback function when upload completes
   */
  function openUploadModal(companyCode, onUploadComplete) {
    // Create DHTMLX Window - cleanup previous window if exists
    if (currentWindow) {
      try {
        let old = currentWindow.getTopmostWindow();
        if (old.getId() === 'file_upload_window') return;
      } catch (e) {
        // Window already closed, ignore
      }
      currentWindow = null;
    }
    
    selectedFiles = [];
    
    currentWindow = new dhtmlXWindows();
    const uploadWindow = currentWindow.createWindow('file_upload_window', 0, 0, 650, 650);
    uploadWindow.setText('Subir archivo');
    uploadWindow.centerOnScreen();
    uploadWindow.button('minmax').hide();
    
    // Attach HTML content
    uploadWindow.attachHTMLString(renderUploadForm());
    
    // Setup event handlers after content is attached
    setTimeout(() => {
      setupEventHandlers(companyCode, uploadWindow, onUploadComplete);
    }, 100);
  }
  
  /**
   * Render the upload form HTML
   * @returns {string} HTML string for the upload form
   */
  function renderUploadForm() {
    return `
      <div class="p-6 bg-white h-full flex flex-col">
        <!-- Instructions -->
        <div class="mb-4">
          <p class="text-sm text-gray-600">
            Selecciona uno o más archivos para subir. Estos archivos estarán disponibles para adjuntar a artículos.
          </p>
        </div>
        
        <!-- Drop Zone -->
        <div 
          id="file-upload-dropzone" 
          class="flex-shrink-0 border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          style="min-height: 200px;"
        >
          <div class="text-center">
            <!-- Upload Icon -->
            <div class="mb-4">
              <svg class="mx-auto h-16 w-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
            </div>
            
            <p class="text-base font-medium text-gray-700 mb-1">
              Arrastra archivos o haz clic para seleccionar
            </p>
            <p class="text-sm text-gray-500">
              Tamaño máximo: ${MAX_FILE_SIZE_MB}MB
            </p>
          </div>
        </div>
        
        <!-- Hidden File Input -->
        <input 
          type="file" 
          id="file-upload-input" 
          multiple 
          style="display: none;"
        />
        
        <!-- Selected Files List -->
        <div id="selected-files-list" class="mb-4 flex-1 overflow-y-auto pr-1" style="display: none;">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Archivos seleccionados:</h4>
          <div id="selected-files-container" class="space-y-3"></div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 flex-shrink-0">
          <button 
            id="file-upload-cancel-btn"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button 
            id="file-upload-submit-btn"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
          >
            Subir
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Setup event handlers for the upload form
   * @param {string} companyCode - Company code
   * @param {Object} uploadWindow - DHTMLX Window instance
   * @param {Function} onUploadComplete - Callback function
   */
  function setupEventHandlers(companyCode, uploadWindow, onUploadComplete) {
    const dropzone = document.getElementById('file-upload-dropzone');
    const fileInput = document.getElementById('file-upload-input');
    const cancelBtn = document.getElementById('file-upload-cancel-btn');
    const submitBtn = document.getElementById('file-upload-submit-btn');
    
    // Click to select files
    dropzone.addEventListener('click', () => {
      fileInput.click();
    });
    
    // Drag and drop events
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-blue-500', 'bg-blue-100');
    });
    
    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-blue-500', 'bg-blue-100');
    });
    
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-blue-500', 'bg-blue-100');
      
      const files = e.dataTransfer.files;
      handleFileSelection(files);
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      handleFileSelection(files);
      // Reset asynchronously so the browser completes the current change event first,
      // allowing users to pick the same file again in a subsequent selection.
      setTimeout(() => {
        fileInput.value = '';
      }, 0);
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
      selectedFiles = [];
      uploadWindow.close();
    });
    
    // Submit button
    submitBtn.addEventListener('click', () => {
      if (selectedFiles.length === 0) {
        return;
      }
      
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subiendo...';
      
      const filesToUpload = selectedFiles.map(item => item.file);
      const perFileMetadata = selectedFiles.map(item => ({
        description: item.description || ''
      }));
      
      // Call file service to upload
      FileService.uploadFiles(filesToUpload, '', companyCode, perFileMetadata)
        .then(uploadedFiles => {
          // Show success message
          dhtmlx.message({
            type: 'success',
            text: `${uploadedFiles.length} archivo(s) subido(s) correctamente`
          });
          
          // Call completion callback
          if (onUploadComplete) {
            onUploadComplete(uploadedFiles);
          }
          
          // Close window
          selectedFiles = [];
          uploadWindow.close();
        })
        .catch(error => {
          console.error('Error uploading files:', error);
          dhtmlx.message({
            type: 'error',
            text: 'Error al subir archivos: ' + error.message
          });
          
          // Reset button state
          submitBtn.disabled = false;
          submitBtn.textContent = 'Subir';
        });
    });
  }
  
  /**
   * Handle file selection (from input or drag-and-drop)
   * @param {FileList} files - Selected files
   */
  function handleFileSelection(files) {
    const filesArray = Array.from(files);
    
    // Validate file sizes
    const validFiles = [];
    const invalidFiles = [];
    
    filesArray.forEach(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        invalidFiles.push(file);
      } else {
        validFiles.push({
          file: file,
          description: ''
        });
      }
    });
    
    // Show error for invalid files
    if (invalidFiles.length > 0) {
      const fileNames = invalidFiles.map(f => f.name).join(', ');
      dhtmlx.message({
        type: 'error',
        text: `Los siguientes archivos exceden el tamaño máximo de ${MAX_FILE_SIZE_MB}MB: ${fileNames}`
      });
    }
    
    // Store valid files
    selectedFiles.push(...validFiles);
    
    // Update UI
    updateSelectedFilesList();
    
    // Enable/disable submit button
    const submitBtn = document.getElementById('file-upload-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = selectedFiles.length === 0;
    }
  }
  
  /**
   * Update the selected files list UI
   */
  function updateSelectedFilesList() {
    const listContainer = document.getElementById('selected-files-list');
    const filesContainer = document.getElementById('selected-files-container');
    
    if (!listContainer || !filesContainer) {
      return;
    }
    
    if (selectedFiles.length === 0) {
      listContainer.style.display = 'none';
      return;
    }
    
    listContainer.style.display = 'block';
    
    // Render file items
    filesContainer.innerHTML = selectedFiles.map((fileData, index) => {
      const fileSizeInKB = (fileData.file.size / 1024).toFixed(1);
      const fileSizeDisplay = fileSizeInKB > 1024 
        ? (fileSizeInKB / 1024).toFixed(1) + ' MB'
        : fileSizeInKB + ' KB';
      const escapedFileName = Utils.escapeHtml(fileData.file.name);
      const escapedDescription = Utils.escapeHtml(fileData.description || '');
      
      return `
        <div class="p-3 bg-gray-50 rounded border border-gray-200 space-y-3">
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2 flex-1 min-w-0 pr-3">
              <svg class="h-5 w-5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd"></path>
              </svg>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate" title="${escapedFileName}">${escapedFileName}</p>
                <p class="text-xs text-gray-500">${fileSizeDisplay}</p>
              </div>
            </div>
            <button 
              class="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
              onclick="FileUploadUI.removeFile(${index})"
              title="Eliminar"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-[11px] font-medium text-gray-700">Descripción</label>
              <button 
                type="button"
                class="file-meta-copy-btn text-[11px] px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 hover:bg-gray-200 transition-colors"
                data-file-index="${index}"
              >
                Copiar nombre
              </button>
            </div>
            <textarea 
              class="file-meta-description-input w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows="2"
              data-file-index="${index}"
            >${escapedDescription}</textarea>
          </div>
        </div>
      `;
    }).join('');
    
    filesContainer.querySelectorAll('.file-meta-description-input').forEach(textarea => {
      const index = parseFileIndex(textarea);
      textarea.addEventListener('input', () => {
        if (selectedFiles[index]) {
          selectedFiles[index].description = textarea.value;
        }
      });
    });
    
    filesContainer.querySelectorAll('.file-meta-copy-btn').forEach(button => {
      const index = parseFileIndex(button);
      button.addEventListener('click', () => {
        if (selectedFiles[index]) {
          const descriptionText = selectedFiles[index].file.name;
          selectedFiles[index].description = descriptionText;
          const descriptionField = Array.from(filesContainer.querySelectorAll('.file-meta-description-input'))
            .find(field => parseFileIndex(field) === index);
          if (descriptionField) {
            descriptionField.value = descriptionText;
            descriptionField.focus();
          }
        }
      });
    });
  }
  
  /**
   * Remove a file from the selected files list
   * @param {number} index - Index of file to remove
   */
  function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateSelectedFilesList();
    
    // Update submit button state
    const submitBtn = document.getElementById('file-upload-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = selectedFiles.length === 0;
    }
  }
  
  // Public API
  return {
    openUploadModal,
    removeFile
  };
})();
