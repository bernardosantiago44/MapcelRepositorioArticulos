/**
 * Image Upload UI Component
 * A reusable component for uploading images with drag-and-drop support,
 * visual previews, and automatic dimension detection.
 * Designed to be pluggable with a targetGallery callback for refreshing UI.
 */

const ImageUploadUI = (function() {
  'use strict';
  
  // Configuration
  const MAX_IMAGE_SIZE_MB = 10;
  const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
  const ACCEPTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
  const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
  const THUMBNAIL_SIZE = 64;
  
  let currentWindow = null;
  let selectedImages = []; // Array of { file: File, dimensions: { width, height }, previewUrl: string }
  
  /**
   * Open the image upload modal
   * @param {string} companyId - Company ID to associate uploaded images with
   * @param {Function} onUploadComplete - Callback function when upload completes (targetGallery)
   */
  function openUploadModal(companyId, onUploadComplete) {
    // Create DHTMLX Window - cleanup previous window if exists
    if (currentWindow) {
      try {
        currentWindow.close();
      } catch (e) {
        // Window already closed, ignore
      }
      currentWindow = null;
    }
    
    // Reset state
    selectedImages = [];
    
    currentWindow = new dhtmlXWindows();
    const uploadWindow = currentWindow.createWindow('image_upload_window', 0, 0, 650, 650);
    uploadWindow.setText('Subir imágenes');
    uploadWindow.centerOnScreen();
    uploadWindow.button('minmax').hide();
    
    // Attach HTML content
    uploadWindow.attachHTMLString(renderUploadForm());
    
    // Setup event handlers after content is attached
    setTimeout(() => {
      setupEventHandlers(companyId, uploadWindow, onUploadComplete);
    }, 100);
  }
  
  /**
   * Render the upload form HTML
   * @returns {string} HTML string for the upload form
   */
  function renderUploadForm() {
    const acceptedFormatsDisplay = ACCEPTED_IMAGE_FORMATS.map(f => f.toUpperCase().slice(1)).join(', ');
    
    return `
      <div class="p-6 bg-white h-full flex flex-col">
        <!-- Instructions -->
        <div class="mb-4">
          <p class="text-sm text-gray-600">
            Selecciona una o más imágenes para subir. Formatos aceptados: ${acceptedFormatsDisplay}.
          </p>
        </div>
        
        <!-- Drop Zone -->
        <div 
          id="image-upload-dropzone" 
          class="flex-shrink-0 border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          style="min-height: 180px;"
        >
          <div class="text-center">
            <!-- Image Upload Icon -->
            <div class="mb-4">
              <svg class="mx-auto h-16 w-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
            
            <p class="text-base font-medium text-gray-700 mb-1">
              Arrastra imágenes o haz clic para seleccionar
            </p>
            <p class="text-sm text-gray-500">
              Tamaño máximo: ${MAX_IMAGE_SIZE_MB}MB por imagen
            </p>
          </div>
        </div>
        
        <!-- Hidden File Input -->
        <input 
          type="file" 
          id="image-upload-input" 
          multiple 
          accept="${ACCEPTED_MIME_TYPES.join(',')}"
          style="display: none;"
        />
        
        <!-- Selected Images Preview Gallery -->
        <div id="selected-images-gallery" class="mb-4 flex-1 overflow-auto" style="display: none; max-height: 200px;">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Imágenes seleccionadas:</h4>
          <div id="selected-images-container" class="flex flex-wrap gap-3"></div>
        </div>
        
        <!-- Description Field -->
        <div class="mb-4 flex-shrink-0">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Descripción (opcional)
          </label>
          <textarea 
            id="image-upload-description"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Agrega una descripción para las imágenes..."
          ></textarea>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 flex-shrink-0">
          <button 
            id="image-upload-cancel-btn"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button 
            id="image-upload-submit-btn"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
          >
            Subir imágenes
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Setup event handlers for the upload form
   * @param {string} companyId - Company ID
   * @param {Object} uploadWindow - DHTMLX Window instance
   * @param {Function} onUploadComplete - Callback function (targetGallery)
   */
  function setupEventHandlers(companyId, uploadWindow, onUploadComplete) {
    const dropzone = document.getElementById('image-upload-dropzone');
    const fileInput = document.getElementById('image-upload-input');
    const cancelBtn = document.getElementById('image-upload-cancel-btn');
    const submitBtn = document.getElementById('image-upload-submit-btn');
    const descriptionTextarea = document.getElementById('image-upload-description');
    
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
      handleImageSelection(files);
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      handleImageSelection(files);
      // Reset file input to allow re-selecting the same files
      fileInput.value = '';
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
      selectedImages = [];
      uploadWindow.close();
    });
    
    // Submit button
    submitBtn.addEventListener('click', () => {
      if (selectedImages.length === 0) {
        return;
      }
      
      const description = descriptionTextarea.value.trim();
      
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subiendo...';
      
      // Extract files and dimensions for upload
      const imageFiles = selectedImages.map(img => img.file);
      const imageDimensions = selectedImages.map(img => img.dimensions);
      
      // Call image service to upload
      ImageService.uploadImages(imageFiles, imageDimensions, description, companyId)
        .then(uploadedImages => {
          // Show success message
          dhtmlx.message({
            type: 'success',
            text: uploadedImages.length + (uploadedImages.length > 1 ? ' imágenes subidas' : ' imagen subida') + ' correctamente'
          });
          
          // Call completion callback (refresh gallery)
          if (onUploadComplete) {
            onUploadComplete(uploadedImages);
          }
          
          // Clean up and close window
          selectedImages = [];
          uploadWindow.close();
        })
        .catch(error => {
          console.error('Error uploading images:', error);
          dhtmlx.message({
            type: 'error',
            text: 'Error al subir imágenes: ' + error.message
          });
          
          // Reset button state
          submitBtn.disabled = false;
          submitBtn.textContent = 'Subir imágenes';
        });
    });
  }
  
  /**
   * Handle image selection (from input or drag-and-drop)
   * @param {FileList} files - Selected files
   */
  function handleImageSelection(files) {
    // Clean up previous previews
    selectedImages = [];
    
    const filesArray = Array.from(files);
    
    // Validate file types and sizes
    const validFiles = [];
    const invalidTypeFiles = [];
    const oversizedFiles = [];
    
    filesArray.forEach(file => {
      // Check file type
      const isValidType = ACCEPTED_MIME_TYPES.includes(file.type) || 
                          ACCEPTED_IMAGE_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!isValidType) {
        invalidTypeFiles.push(file);
      } else if (file.size > MAX_IMAGE_SIZE_BYTES) {
        oversizedFiles.push(file);
      } else {
        validFiles.push(file);
      }
    });
    
    // Show error for invalid type files
    if (invalidTypeFiles.length > 0) {
      const fileNames = invalidTypeFiles.map(f => f.name).join(', ');
      dhtmlx.message({
        type: 'error',
        text: `Formato no soportado: ${fileNames}. Usa JPG, PNG, SVG o WEBP.`
      });
    }
    
    // Show warning for oversized files
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => f.name).join(', ');
      dhtmlx.message({
        type: 'error',
        text: `Las siguientes imágenes exceden el tamaño máximo de ${MAX_IMAGE_SIZE_MB}MB: ${fileNames}`
      });
    }
    
    // Process valid files - detect dimensions and create previews
    if (validFiles.length > 0) {
      processImages(validFiles);
    } else {
      updateSubmitButtonState();
    }
  }
  
  /**
   * Process valid image files - detect dimensions and create thumbnails
   * @param {Array<File>} files - Array of valid image files
   */
  function processImages(files) {
    const promises = files.map(file => processImageFile(file));
    
    Promise.allSettled(promises)
      .then(results => {
        // Filter successful results and track failures
        const successfulImages = [];
        const failedFiles = [];
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successfulImages.push(result.value);
          } else {
            failedFiles.push(files[index].name);
            console.error('Failed to process image:', files[index].name, result.reason);
          }
        });
        
        selectedImages = successfulImages;
        updateSelectedImagesGallery();
        updateSubmitButtonState();
        
        // Show warning for failed files
        if (failedFiles.length > 0) {
          dhtmlx.message({
            type: 'error',
            text: 'No se pudieron procesar: ' + failedFiles.join(', ')
          });
        }
      });
  }
  
  /**
   * Process a single image file - detect dimensions and create preview URL
   * @param {File} file - Image file
   * @returns {Promise<Object>} Promise resolving to image data object
   */
  function processImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          resolve({
            file: file,
            dimensions: {
              width: img.naturalWidth,
              height: img.naturalHeight
            },
            previewUrl: e.target.result
          });
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image: ' + file.name));
        };
        
        img.src = e.target.result;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file: ' + file.name));
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Update the selected images gallery UI with thumbnails
   */
  function updateSelectedImagesGallery() {
    const galleryContainer = document.getElementById('selected-images-gallery');
    const imagesContainer = document.getElementById('selected-images-container');
    
    if (!galleryContainer || !imagesContainer) {
      return;
    }
    
    if (selectedImages.length === 0) {
      galleryContainer.style.display = 'none';
      return;
    }
    
    galleryContainer.style.display = 'block';
    
    // Render image thumbnails
    imagesContainer.innerHTML = selectedImages.map((imageData, index) => {
      const fileSizeInKB = (imageData.file.size / 1024).toFixed(1);
      const fileSizeDisplay = fileSizeInKB > 1024 
        ? (fileSizeInKB / 1024).toFixed(1) + ' MB'
        : fileSizeInKB + ' KB';
      
      const dimensionsDisplay = `${imageData.dimensions.width}x${imageData.dimensions.height}`;
      
      // Escape file name for display
      const escapedName = Utils.escapeHtml(imageData.file.name);
      
      return `
        <div class="relative group bg-gray-50 rounded-lg border border-gray-200 p-2" style="width: 140px;">
          <!-- Thumbnail -->
          <div class="relative mx-auto mb-2" style="width: ${THUMBNAIL_SIZE}px; height: ${THUMBNAIL_SIZE}px;">
            <img 
              src="${imageData.previewUrl}" 
              alt="${escapedName}"
              class="w-full h-full object-cover rounded"
            />
            <!-- Remove button -->
            <button 
              class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              onclick="ImageUploadUI.removeImage(${index})"
              title="Eliminar"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <!-- Image info -->
          <div class="text-center">
            <p class="text-xs font-medium text-gray-900 truncate" title="${escapedName}">
              ${escapedName}
            </p>
            <p class="text-xs text-blue-600 font-medium">${dimensionsDisplay}</p>
            <p class="text-xs text-gray-500">${fileSizeDisplay}</p>
          </div>
        </div>
      `;
    }).join('');
  }
  
  /**
   * Remove an image from the selected images list
   * @param {number} index - Index of image to remove
   */
  function removeImage(index) {
    if (index >= 0 && index < selectedImages.length) {
      // Note: data: URLs from FileReader don't need to be revoked
      // They are garbage collected when no longer referenced
      selectedImages.splice(index, 1);
      updateSelectedImagesGallery();
      updateSubmitButtonState();
    }
  }
  
  /**
   * Update submit button state based on selected images
   */
  function updateSubmitButtonState() {
    const submitBtn = document.getElementById('image-upload-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = selectedImages.length === 0;
    }
  }
  
  // Public API
  return {
    openUploadModal,
    removeImage
  };
})();
