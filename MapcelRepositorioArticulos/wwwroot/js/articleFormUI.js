/**
 * Article Form UI Module
 * Provides a unified form component for creating and editing articles
 * Uses HTML + Tailwind CSS within a dhtmlXWindow
 * 
 * Features:
 * - Title, description, status, external link, client comments fields
 * - Tag selection via TagPickerUI
 * - Attach existing images/files with search functionality
 * - Upload new images/files directly from the form
 * 
 * Dependencies:
 * - dataModels.js (for status configuration)
 * - articleService.js (for CRUD operations)
 * - ImageService.js (for image operations)
 * - FileService.js (for file operations)
 * - TagPickerUI.js (for tag selection)
 */

var ArticleFormUI = (function() {
  'use strict';
  
  // Form state management
  var formState = {
    currentMode: null,          // 'create' or 'edit'
    articleId: null,            // Article ID when editing
    articleWindow: null,        // DHTMLX Window instance
    companyId: null,            // Company ID for new articles
    onSaveCallback: null,       // Callback function after save
    selectedTags: [],           // Selected tags for the article
    attachedImages: [],         // Attached image IDs
    attachedFiles: [],          // Attached file IDs
    allImages: [],              // All available images for the company
    allFiles: [],               // All available files for the company
    imageSearchQuery: '',       // Current image search query
    fileSearchQuery: '',        // Current file search query
    activeMediaTab: 'images',   // Active tab in media section: 'images' or 'files'
    descriptionTab: 'write'     // Active tab in description editor: 'write' or 'preview'
  };
  
  /**
   * Get status options from the articleStatusConfiguration defined in dataModels.js
   * This maintains a single source of truth for status values
   * @returns {Array} Array of status options for combo
   */
  function getStatusOptions() {
    // Use articleStatusConfiguration from dataModels.js (loaded globally)
    if (typeof articleStatusConfiguration !== 'undefined') {
      return Object.keys(articleStatusConfiguration).map(function(key) {
        return {
          value: key,
          text: articleStatusConfiguration[key].label,
          color: articleStatusConfiguration[key].color
        };
      });
    }
    // Fallback if dataModels not loaded
    return [
      { value: 'Producción', text: 'Producción', color: '#52c41a' },
      { value: 'Borrador', text: 'Borrador', color: '#1890ff' },
      { value: 'Cerrado', text: 'Cerrado', color: '#8c8c8c' }
    ];
  }
  
  // Form window dimensions
  var FORM_WINDOW_WIDTH = 900;
  var FORM_WINDOW_HEIGHT = 850;
  
  /**
   * Create and configure the form window
   * @param {string} mode - 'create' or 'edit'
   * @param {string} articleId - Article ID (for edit mode title)
   * @returns {Object} DHTMLX Window instance
   */
  function createFormWindow(mode, articleId) {
    // Create window manager
    var dhxWins = new dhtmlXWindows();
    
    // Window title based on mode - escape articleId to prevent XSS
    var windowTitle = mode === 'create' ? 'Nuevo Artículo' : 'Editando: ' + escapeHtml(articleId || '');
    
    // Create and configure window
    var formWindow = dhxWins.createWindow('article_form_window', 0, 0, FORM_WINDOW_WIDTH, FORM_WINDOW_HEIGHT);
    formWindow.setText(windowTitle);
    formWindow.centerOnScreen();
    formWindow.setModal(true);
    formWindow.button('park').hide();
    formWindow.button('minmax').hide();
    
    return formWindow;
  }
  
  /**
   * Render the complete HTML form
   * @param {string} mode - 'create' or 'edit'
   * @returns {string} HTML string for the form
   */
  function renderFormHtml(mode) {
    var buttonLabel = mode === 'create' ? 'Crear Artículo' : 'Guardar Cambios';
    var statusOptions = getStatusOptions();
    
    return `
      <div class="h-full flex flex-col bg-white">
        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Title Field -->
          <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Título <span class="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              id="article-form-title"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ingresa el título del artículo"
            />
          </div>
          
          <!-- Status Field -->
          <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Estado
            </label>
            <select 
              id="article-form-status"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              ${statusOptions.map(function(opt, index) {
                return '<option value="' + escapeHtml(opt.value) + '"' + (index === 0 ? ' selected' : '') + '>' + escapeHtml(opt.text) + '</option>';
              }).join('')}
            </select>
          </div>
          
          <!-- Description Field -->
          <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Descripción del artículo <span class="text-red-500">*</span>
            </label>
            <div class="border border-gray-300 rounded-md overflow-hidden bg-white">
              <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50">
                <div class="flex">
                  <button
                    id="article-form-description-tab-write"
                    type="button"
                    class="px-3 py-2 text-sm font-semibold text-gray-900 border-b-2 border-blue-500 bg-white"
                  >
                    Escribir
                  </button>
                  <button
                    id="article-form-description-tab-preview"
                    type="button"
                    class="px-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Vista previa
                  </button>
                </div>
                <div class="flex items-center gap-1 px-2">
                  <button
                    type="button"
                    class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    data-md-action="heading"
                    title="Título"
                  >H</button>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    data-md-action="bold"
                    title="Negrita"
                  >B</button>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    data-md-action="italic"
                    title="Cursiva"
                  >I</button>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    data-md-action="list"
                    title="Lista"
                  >List</button>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    data-md-action="link"
                    title="Enlace"
                  >Link</button>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    data-md-action="code"
                    title="Código"
                  >Code</button>
                  <button
                    type="button"
                    class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    data-md-action="image"
                    title="Imagen"
                  >Image</button>
                </div>
              </div>
              <div class="p-3 bg-white">
                <textarea 
                  id="article-form-description"
                  rows="6"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                  placeholder="Describe el artículo en detalle"
                ></textarea>
                <div
                  id="article-form-description-preview"
                  class="hidden w-full min-h-[160px] rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed"
                ></div>
              </div>
            </div>
            <div class="mt-2 text-xs text-gray-500">
              Soporta Markdown básico: **negrita**, _cursiva_, listas, enlaces y código.
            </div>
          </div>
          
          <!-- External Link Field -->
          <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Enlace Externo
            </label>
            <input 
              type="url" 
              id="article-form-external-link"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/issue"
            />
          </div>
          
          <!-- Client Comments Field -->
          <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Comentarios del cliente
            </label>
            <textarea 
              id="article-form-client-comments"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Comentarios adicionales del cliente"
            ></textarea>
          </div>
          
          <!-- Tags Section -->
          <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Etiquetas
            </label>
            <div 
              id="article-form-tags-container"
              class="border border-gray-300 rounded-md p-3 min-h-[60px] cursor-pointer hover:border-blue-400 transition-colors"
            >
              <div id="article-form-selected-tags" class="flex flex-wrap gap-2 min-h-[30px]">
                <span class="text-gray-400 text-sm">Ninguna etiqueta seleccionada</span>
              </div>
              <div class="mt-2 text-xs text-gray-500">
                Haz clic para seleccionar etiquetas
              </div>
            </div>
          </div>
          
          <!-- Media Attachments Section -->
          <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Archivos Adjuntos
            </label>
            
            <!-- Media Tabs -->
            <div class="border border-gray-300 rounded-md overflow-hidden">
              <!-- Tab Headers -->
              <div class="flex border-b border-gray-300">
                <button 
                  id="article-form-images-tab"
                  class="flex-1 px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                  type="button"
                >
                  <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  Imágenes (<span id="article-form-images-count">0</span>)
                </button>
                <button 
                  id="article-form-files-tab"
                  class="flex-1 px-4 py-2 text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100"
                  type="button"
                >
                  <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  Archivos (<span id="article-form-files-count">0</span>)
                </button>
              </div>
              
              <!-- Images Tab Content -->
              <div id="article-form-images-panel" class="p-3">
                <!-- Search and Upload Row -->
                <div class="flex gap-2 mb-3">
                  <div class="flex-1 relative">
                    <input 
                      type="text" 
                      id="article-form-image-search"
                      class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Buscar imágenes..."
                    />
                    <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                  <button 
                    id="article-form-upload-image-btn"
                    type="button"
                    class="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
                  >
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Subir
                  </button>
                </div>
                
                <!-- Attached Images -->
                <div id="article-form-attached-images" class="mb-3">
                  <!-- Will be populated dynamically -->
                </div>
                
                <!-- Available Images -->
                <div class="text-xs font-medium text-gray-500 mb-2">Imágenes disponibles:</div>
                <div id="article-form-available-images" class="overflow-y-auto border border-gray-200 rounded-md">
                  <!-- Will be populated dynamically -->
                </div>
              </div>
              
              <!-- Files Tab Content -->
              <div id="article-form-files-panel" class="p-3" style="display: none;">
                <!-- Search and Upload Row -->
                <div class="flex gap-2 mb-3">
                  <div class="flex-1 relative">
                    <input 
                      type="text" 
                      id="article-form-file-search"
                      class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Buscar archivos..."
                    />
                    <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                  <button 
                    id="article-form-upload-file-btn"
                    type="button"
                    class="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
                  >
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Subir
                  </button>
                </div>
                
                <!-- Attached Files -->
                <div id="article-form-attached-files" class="mb-3">
                  <!-- Will be populated dynamically -->
                </div>
                
                <!-- Available Files -->
                <div class="text-xs font-medium text-gray-500 mb-2">Archivos disponibles:</div>
                <div id="article-form-available-files" class="overflow-y-auto border border-gray-200 rounded-md">
                  <!-- Will be populated dynamically -->
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Fixed Footer with Buttons -->
        <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button 
            id="article-form-cancel-btn"
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button 
            id="article-form-submit-btn"
            type="button"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ${buttonLabel}
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Initialize the form inside the window
   * @param {Object} formWindow - DHTMLX Window instance
   * @param {string} mode - 'create' or 'edit'
   */
  function initializeForm(formWindow, mode) {
    // Attach HTML content to window
    formWindow.attachHTMLString(renderFormHtml(mode));
    
    // Setup event handlers after a short delay to ensure DOM is ready
    setTimeout(function() {
      attachFormEventHandlers();
      loadMediaData();
      updateTagsDisplay();
      updateAttachedImagesDisplay();
      updateAttachedFilesDisplay();
    }, 100);
  }
  
  /**
   * Attach event handlers to form elements
   */
  function attachFormEventHandlers() {
    // Tags container click
    var tagsContainer = document.getElementById('article-form-tags-container');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', openTagPickerForForm);
    }
    
    // Media tab switching
    var imagesTab = document.getElementById('article-form-images-tab');
    var filesTab = document.getElementById('article-form-files-tab');
    
    if (imagesTab) {
      imagesTab.addEventListener('click', function() {
        switchMediaTab('images');
      });
    }
    
    if (filesTab) {
      filesTab.addEventListener('click', function() {
        switchMediaTab('files');
      });
    }
    
    // Image search
    var imageSearch = document.getElementById('article-form-image-search');
    if (imageSearch) {
      imageSearch.addEventListener('input', Utils.debounce(function(e) {
        formState.imageSearchQuery = e.target.value;
        updateAvailableImagesDisplay();
      }, 300));
    }
    
    // File search
    var fileSearch = document.getElementById('article-form-file-search');
    if (fileSearch) {
      fileSearch.addEventListener('input', Utils.debounce(function(e) {
        formState.fileSearchQuery = e.target.value;
        updateAvailableFilesDisplay();
      }, 300));
    }
    
    // Upload buttons
    var uploadImageBtn = document.getElementById('article-form-upload-image-btn');
    if (uploadImageBtn) {
      uploadImageBtn.addEventListener('click', openImageUpload);
    }
    
    var uploadFileBtn = document.getElementById('article-form-upload-file-btn');
    if (uploadFileBtn) {
      uploadFileBtn.addEventListener('click', openFileUpload);
    }
    
    // Form buttons
    var cancelBtn = document.getElementById('article-form-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeForm);
    }
    
    var submitBtn = document.getElementById('article-form-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleFormSubmit);
    }

    // Description markdown editor tabs
    var descriptionWriteTab = document.getElementById('article-form-description-tab-write');
    var descriptionPreviewTab = document.getElementById('article-form-description-tab-preview');
    if (descriptionWriteTab) {
      descriptionWriteTab.addEventListener('click', function() {
        setDescriptionTab('write');
      });
    }
    if (descriptionPreviewTab) {
      descriptionPreviewTab.addEventListener('click', function() {
        setDescriptionTab('preview');
      });
    }

    // Description textarea live preview
    var descriptionInput = document.getElementById('article-form-description');
    if (descriptionInput) {
      descriptionInput.addEventListener('input', Utils.debounce(function() {
        if (formState.descriptionTab === 'preview') {
          updateDescriptionPreview();
        }
      }, 200));
    }

    // Markdown toolbar actions
    var markdownButtons = document.querySelectorAll('[data-md-action]');
    if (markdownButtons && markdownButtons.length) {
      markdownButtons.forEach(function(button) {
        button.addEventListener('click', function() {
          var action = button.getAttribute('data-md-action');
          Utils.applyMarkdownActionToTextArea('article-form-description', action);
        });
      });
    }

    // Initialize default description tab
    setDescriptionTab(formState.descriptionTab || 'write');
  }

  /**
   * Set active tab for markdown editor
   * @param {string} tab - 'write' or 'preview'
   */
  function setDescriptionTab(tab) {
    formState.descriptionTab = tab;
    var writeTab = document.getElementById('article-form-description-tab-write');
    var previewTab = document.getElementById('article-form-description-tab-preview');
    var textarea = document.getElementById('article-form-description');
    var preview = document.getElementById('article-form-description-preview');

    if (!writeTab || !previewTab || !textarea || !preview) return;

    if (tab === 'preview') {
      writeTab.className = 'px-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700';
      previewTab.className = 'px-3 py-2 text-sm font-semibold text-gray-900 border-b-2 border-blue-500 bg-white';
      textarea.classList.add('hidden');
      preview.classList.remove('hidden');
      updateDescriptionPreview();
    } else {
      writeTab.className = 'px-3 py-2 text-sm font-semibold text-gray-900 border-b-2 border-blue-500 bg-white';
      previewTab.className = 'px-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700';
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      textarea.focus();
    }
  }

  /**
   * Update markdown preview for description
   */
  function updateDescriptionPreview() {
    var textarea = document.getElementById('article-form-description');
    var preview = document.getElementById('article-form-description-preview');
    if (!textarea || !preview) return;

    var value = textarea.value || '';
    if (!value.trim()) {
      preview.innerHTML = '<em class="text-gray-400">Sin descripción</em>';
      return;
    }

    preview.innerHTML = '<div class="markdown-body">' + Utils.renderMarkdown(value) + '</div>';
  }
  
  /**
   * Switch between images and files tabs
   * @param {string} tab - 'images' or 'files'
   */
  function switchMediaTab(tab) {
    formState.activeMediaTab = tab;
    
    var imagesTab = document.getElementById('article-form-images-tab');
    var filesTab = document.getElementById('article-form-files-tab');
    var imagesPanel = document.getElementById('article-form-images-panel');
    var filesPanel = document.getElementById('article-form-files-panel');
    
    if (tab === 'images') {
      imagesTab.className = 'flex-1 px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border-b-2 border-blue-500';
      filesTab.className = 'flex-1 px-4 py-2 text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100';
      imagesPanel.style.display = 'block';
      filesPanel.style.display = 'none';
    } else {
      filesTab.className = 'flex-1 px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border-b-2 border-blue-500';
      imagesTab.className = 'flex-1 px-4 py-2 text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100';
      filesPanel.style.display = 'block';
      imagesPanel.style.display = 'none';
    }
  }
  
  /**
   * Load media data (images and files) for the company
   */
  function loadMediaData() {
    if (!formState.companyId) return;
    
    // Load images
    ImageService.getImages(formState.companyId)
      .then(function(images) {
        formState.allImages = images;
        updateAvailableImagesDisplay();
        // Update attached images display in case data loaded after populating form
        updateAttachedImagesDisplay();
        updateMediaCounts();
      })
      .catch(function(error) {
        console.error('Error loading images:', error);
        dhtmlx.message({
          type: 'error',
          text: 'No se pudieron cargar las imágenes disponibles'
        });
      });
    
    // Load files
    FileService.getFiles(formState.companyId)
      .then(function(files) {
        formState.allFiles = files;
        updateAvailableFilesDisplay();
        // Update attached files display in case data loaded after populating form
        updateAttachedFilesDisplay();
        updateMediaCounts();
      })
      .catch(function(error) {
        console.error('Error loading files:', error);
        dhtmlx.message({
          type: 'error',
          text: 'No se pudieron cargar los archivos disponibles'
        });
      });
  }
  
  /**
   * Update the available images display based on search
   */
  function updateAvailableImagesDisplay() {
    var container = document.getElementById('article-form-available-images');
    if (!container) return;
    
    var filteredImages = formState.allImages;
    
    // Apply search filter
    if (formState.imageSearchQuery) {
      var query = formState.imageSearchQuery.toLowerCase();
      filteredImages = filteredImages.filter(function(img) {
        return img.name.toLowerCase().includes(query) ||
               (img.description && img.description.toLowerCase().includes(query));
      });
    }
    
    // Filter out already attached images
    filteredImages = filteredImages.filter(function(img) {
      return formState.attachedImages.indexOf(img.id) === -1;
    });
    
    if (filteredImages.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No hay imágenes disponibles</div>';
      return;
    }
    
    container.innerHTML = filteredImages.map(function(img) {
      return renderAvailableImageItem(img);
    }).join('');
    
    // Attach click handlers
    container.querySelectorAll('[data-attach-image-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imageId = btn.getAttribute('data-attach-image-id');
        attachImage(imageId);
      });
    });
  }
  
  /**
   * Render an available image item
   * @param {Object} img - Image object
   * @returns {string} HTML string
   */
  function renderAvailableImageItem(img) {
    var safeUrl = sanitizeUrl(img.thumbnail_url);
    return `
      <div class="flex items-center p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
        <img 
          src="${safeUrl}" 
          alt="${escapeHtml(img.name)}"
          class="w-10 h-10 object-cover rounded flex-shrink-0"
        />
        <div class="ml-3 flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(img.name)}</div>
          <div class="text-xs text-gray-500">${escapeHtml(img.dimensions)} • ${escapeHtml(img.size)}</div>
        </div>
        <button 
          type="button"
          data-attach-image-id="${escapeHtml(img.id)}"
          class="ml-2 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
        >
          Adjuntar
        </button>
      </div>
    `;
  }
  
  /**
   * Update the available files display based on search
   */
  function updateAvailableFilesDisplay() {
    var container = document.getElementById('article-form-available-files');
    if (!container) return;
    
    var filteredFiles = formState.allFiles;
    
    // Apply search filter
    if (formState.fileSearchQuery) {
      var query = formState.fileSearchQuery.toLowerCase();
      filteredFiles = filteredFiles.filter(function(file) {
        return file.name.toLowerCase().includes(query) ||
               (file.description && file.description.toLowerCase().includes(query));
      });
    }
    
    // Filter out already attached files
    filteredFiles = filteredFiles.filter(function(file) {
      return formState.attachedFiles.indexOf(file.id) === -1;
    });
    
    if (filteredFiles.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No hay archivos disponibles</div>';
      return;
    }
    
    container.innerHTML = filteredFiles.map(function(file) {
      return renderAvailableFileItem(file);
    }).join('');
    
    // Attach click handlers
    container.querySelectorAll('[data-attach-file-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var fileId = btn.getAttribute('data-attach-file-id');
        attachFile(fileId);
      });
    });
  }
  
  /**
   * Render an available file item
   * @param {Object} file - File object
   * @returns {string} HTML string
   */
  function renderAvailableFileItem(file) {
    var extension = escapeHtml(Utils.getFileExtension(file.name).toUpperCase());
    
    return `
      <div class="flex items-center p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
        <div class="w-10 h-10 flex items-center justify-center bg-gray-100 rounded flex-shrink-0">
          <span class="text-xs font-medium text-gray-500">${extension}</span>
        </div>
        <div class="ml-3 flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(file.name)}</div>
          <div class="text-xs text-gray-500">${escapeHtml(file.size)}</div>
        </div>
        <button 
          type="button"
          data-attach-file-id="${escapeHtml(file.id)}"
          class="ml-2 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
        >
          Adjuntar
        </button>
      </div>
    `;
  }
  
  /**
   * Attach an image to the article
   * @param {string} imageId - Image ID to attach
   */
  function attachImage(imageId) {
    if (formState.attachedImages.indexOf(imageId) === -1) {
      formState.attachedImages.push(imageId);
      updateAttachedImagesDisplay();
      updateAvailableImagesDisplay();
      updateMediaCounts();
    }
  }
  
  /**
   * Detach an image from the article
   * @param {string} imageId - Image ID to detach
   */
  function detachImage(imageId) {
    var index = formState.attachedImages.indexOf(imageId);
    if (index !== -1) {
      formState.attachedImages.splice(index, 1);
      updateAttachedImagesDisplay();
      updateAvailableImagesDisplay();
      updateMediaCounts();
    }
  }
  
  /**
   * Attach a file to the article
   * @param {string} fileId - File ID to attach
   */
  function attachFile(fileId) {
    if (formState.attachedFiles.indexOf(fileId) === -1) {
      formState.attachedFiles.push(fileId);
      updateAttachedFilesDisplay();
      updateAvailableFilesDisplay();
      updateMediaCounts();
    }
  }
  
  /**
   * Detach a file from the article
   * @param {string} fileId - File ID to detach
   */
  function detachFile(fileId) {
    var index = formState.attachedFiles.indexOf(fileId);
    if (index !== -1) {
      formState.attachedFiles.splice(index, 1);
      updateAttachedFilesDisplay();
      updateAvailableFilesDisplay();
      updateMediaCounts();
    }
  }
  
  /**
   * Update the attached images display
   */
  function updateAttachedImagesDisplay() {
    var container = document.getElementById('article-form-attached-images');
    if (!container) return;
    
    if (formState.attachedImages.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    // Get attached image objects
    var attachedImageObjects = formState.attachedImages.map(function(id) {
      return formState.allImages.find(function(img) { return img.id === id; });
    }).filter(function(img) { return img; });
    
    container.innerHTML = `
      <div class="text-xs font-medium text-gray-500 mb-2">Imágenes adjuntas:</div>
      <div class="flex flex-wrap gap-2">
        ${attachedImageObjects.map(function(img) {
          var safeUrl = sanitizeUrl(img.thumbnail_url);
          return `
            <div class="relative group">
              <img 
                src="${safeUrl}" 
                alt="${escapeHtml(img.name)}"
                class="w-16 h-16 object-cover rounded border border-gray-200"
                title="${escapeHtml(img.name)}"
              />
              <button 
                type="button"
                data-detach-image-id="${escapeHtml(img.id)}"
                class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Quitar imagen"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    // Attach detach handlers
    container.querySelectorAll('[data-detach-image-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imageId = btn.getAttribute('data-detach-image-id');
        detachImage(imageId);
      });
    });
  }
  
  /**
   * Update the attached files display
   */
  function updateAttachedFilesDisplay() {
    var container = document.getElementById('article-form-attached-files');
    if (!container) return;
    
    if (formState.attachedFiles.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    // Get attached file objects
    var attachedFileObjects = formState.attachedFiles.map(function(id) {
      return formState.allFiles.find(function(file) { return file.id === id; });
    }).filter(function(file) { return file; });
    
    container.innerHTML = `
      <div class="text-xs font-medium text-gray-500 mb-2">Archivos adjuntos:</div>
      <div class="space-y-1">
        ${attachedFileObjects.map(function(file) {
          var extension = escapeHtml(Utils.getFileExtension(file.name).toUpperCase());
          return `
            <div class="flex items-center p-2 bg-blue-50 rounded border border-blue-100">
              <div class="w-8 h-8 flex items-center justify-center bg-white rounded flex-shrink-0">
                <span class="text-xs font-medium text-gray-500">${extension}</span>
              </div>
              <div class="ml-2 flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(file.name)}</div>
              </div>
              <button 
                type="button"
                data-detach-file-id="${escapeHtml(file.id)}"
                class="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                title="Quitar archivo"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    // Attach detach handlers
    container.querySelectorAll('[data-detach-file-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var fileId = btn.getAttribute('data-detach-file-id');
        detachFile(fileId);
      });
    });
  }
  
  /**
   * Update media counts in tab headers
   */
  function updateMediaCounts() {
    var imagesCount = document.getElementById('article-form-images-count');
    var filesCount = document.getElementById('article-form-files-count');
    
    if (imagesCount) {
      imagesCount.textContent = formState.attachedImages.length;
    }
    if (filesCount) {
      filesCount.textContent = formState.attachedFiles.length;
    }
  }
  
  /**
   * Open image upload modal
   */
  function openImageUpload() {
    ImageUploadUI.openUploadModal(formState.companyId, function(uploadedImages) {
      // Add uploaded images to available images and attach them
      uploadedImages.forEach(function(img) {
        formState.allImages.push(img);
        attachImage(img.id);
      });
      updateAvailableImagesDisplay();
    });
  }
  
  /**
   * Open file upload modal
   */
  function openFileUpload() {
    FileUploadUI.openUploadModal(formState.companyId, function(uploadedFiles) {
      // Add uploaded files to available files and attach them
      uploadedFiles.forEach(function(file) {
        formState.allFiles.push(file);
        attachFile(file.id);
      });
      updateAvailableFilesDisplay();
    });
  }
  
  /**
   * Update the tags display
   */
  function updateTagsDisplay() {
    var container = document.getElementById('article-form-selected-tags');
    if (!container) return;
    
    if (formState.selectedTags.length === 0) {
      container.innerHTML = '<span class="text-gray-400 text-sm">Ninguna etiqueta seleccionada</span>';
      return;
    }
    
    container.innerHTML = formState.selectedTags.map(function(tag) {
      var safeColor = sanitizeColor(tag.color);
      return `
        <span 
          class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
          style="background-color: ${safeColor};"
        >
          ${escapeHtml(tag.name)}
          <button 
            type="button"
            data-remove-tag-id="${escapeHtml(tag.id)}"
            class="ml-1 -mr-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-black hover:bg-opacity-20"
            title="Quitar etiqueta"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </span>
      `;
    }).join('');
    
    // Attach remove handlers
    container.querySelectorAll('[data-remove-tag-id]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var tagId = btn.getAttribute('data-remove-tag-id');
        removeTag(tagId);
      });
    });
  }
  
  /**
   * Open the tag picker for the form
   */
  function openTagPickerForForm() {
    if (!formState.companyId) {
      dhtmlx.alert({
        title: 'Error',
        text: 'No se pudo cargar las etiquetas'
      });
      return;
    }
    
    // Get currently selected tag IDs
    var selectedTagIds = formState.selectedTags.map(function(tag) { return tag.id; });
    
    // Open the tag picker
    TagPickerUI.openTagPicker(formState.companyId, selectedTagIds, function(selectedTags) {
      formState.selectedTags = selectedTags;
      updateTagsDisplay();
    });
  }
  
  /**
   * Remove a tag from the selection
   * @param {string} tagId - Tag ID to remove
   */
  function removeTag(tagId) {
    formState.selectedTags = formState.selectedTags.filter(function(tag) {
      return tag.id !== tagId;
    });
    updateTagsDisplay();
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
  
  /**
   * Validate that a URL is safe (no javascript: protocol)
   * @param {string} url - URL to validate
   * @returns {string} Safe URL or empty string
   */
  function sanitizeUrl(url) {
    if (!url) return '';
    var trimmedUrl = url.trim().toLowerCase();
    // Only allow http, https, and data protocols
    if (trimmedUrl.startsWith('http://') || 
        trimmedUrl.startsWith('https://') || 
        trimmedUrl.startsWith('data:image/')) {
      return escapeHtml(url);
    }
    // Return empty or placeholder for invalid URLs
    return '';
  }
  
  /**
   * Validate that a color is a valid hex color
   * @param {string} color - Color to validate
   * @returns {string} Valid hex color or default gray
   */
  function sanitizeColor(color) {
    if (!color) return '#6b7280'; // Default gray
    // Check for valid hex color format
    var hexPattern = /^#[0-9a-fA-F]{3,6}$/;
    if (hexPattern.test(color.trim())) {
      return escapeHtml(color.trim());
    }
    return '#6b7280'; // Default gray for invalid colors
  }
  
  /**
   * Validate the form data
   * @returns {boolean} True if form is valid
   */
  function validateForm() {
    var titleInput = document.getElementById('article-form-title');
    var descriptionInput = document.getElementById('article-form-description');
    
    var title = titleInput ? titleInput.value.trim() : '';
    var description = descriptionInput ? descriptionInput.value.trim() : '';
    
    if (!title) {
      dhtmlx.alert({
        title: 'Error de validación',
        text: 'El campo "Título" es obligatorio.'
      });
      if (titleInput) titleInput.focus();
      return false;
    }
    
    if (!description) {
      dhtmlx.alert({
        title: 'Error de validación',
        text: 'El campo "Descripción" es obligatorio.'
      });
      if (descriptionInput) descriptionInput.focus();
      return false;
    }
    
    return true;
  }
  
  /**
   * Get form data as an object
   * @returns {Object} Form data object
   */
  function getFormData() {
    var titleInput = document.getElementById('article-form-title');
    var statusSelect = document.getElementById('article-form-status');
    var descriptionInput = document.getElementById('article-form-description');
    var externalLinkInput = document.getElementById('article-form-external-link');
    var clientCommentsInput = document.getElementById('article-form-client-comments');
    
    // Convert selected tags to tag IDs for storage
    var tagIds = formState.selectedTags
      .filter(function(tag) { return tag && tag.id; })
      .map(function(tag) { return tag.id; });
    
    return {
      title: titleInput ? titleInput.value.trim() : '',
      description: descriptionInput ? descriptionInput.value.trim() : '',
      status: statusSelect ? statusSelect.value : 'Abierto',
      externalLink: externalLinkInput ? externalLinkInput.value.trim() : '',
      clientComments: clientCommentsInput ? clientCommentsInput.value.trim() : '',
      companyId: formState.companyId,
      tags: tagIds,
      attachedImages: formState.attachedImages.slice(),
      attachedFiles: formState.attachedFiles.slice()
    };
  }
  
  /**
   * Handle form submission for both create and edit modes
   */
  function handleFormSubmit() {
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    var formData = getFormData();
    var submitBtn = document.getElementById('article-form-submit-btn');
    
    // Disable submit button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';
    }
    
    if (formState.currentMode === 'create') {
      // Create new article
      ArticleService.createArticle(formData)
        .then(function(response) {
          if (response.status === 'success') {
            dhtmlx.message({
              text: 'Artículo creado exitosamente',
              type: 'success',
              expire: 3000
            });
            
            // Call callback with new article data
            if (formState.onSaveCallback) {
              formState.onSaveCallback(response.data, 'create');
            }
            
            closeForm();
          }
        })
        .catch(function(error) {
          console.error('Error creating article:', error);
          dhtmlx.alert({
            title: 'Error',
            text: 'Error al crear el artículo: ' + error.message
          });
          
          // Re-enable submit button
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear Artículo';
          }
        });
    } else if (formState.currentMode === 'edit') {
      // Update article with new data
      ArticleService.getArticleById(formState.articleId)
        .then(function(existingArticle) {
          formData.createdAt = existingArticle ? existingArticle.createdAt : null;
          
          return ArticleService.updateArticle(formState.articleId, formData);
        })
        .then(function(response) {
          if (response.status === 'success') {
            dhtmlx.message({
              text: 'Artículo actualizado exitosamente',
              type: 'success',
              expire: 3000
            });
            
            // Call callback with updated article data
            if (formState.onSaveCallback) {
              formState.onSaveCallback(response.data, 'edit');
            }
            
            closeForm();
          }
        })
        .catch(function(error) {
          console.error('Error updating article:', error);
          dhtmlx.alert({
            title: 'Error',
            text: 'Error al actualizar el artículo: ' + error.message
          });
          
          // Re-enable submit button
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Guardar Cambios';
          }
        });
    }
  }
  
  /**
   * Close the form window and clean up
   */
  function closeForm() {
    if (formState.articleWindow) {
      formState.articleWindow.close();
    }
    
    // Reset state
    formState.currentMode = null;
    formState.articleId = null;
    formState.articleWindow = null;
    formState.companyId = null;
    formState.onSaveCallback = null;
    formState.selectedTags = [];
    formState.attachedImages = [];
    formState.attachedFiles = [];
    formState.allImages = [];
    formState.allFiles = [];
    formState.imageSearchQuery = '';
    formState.fileSearchQuery = '';
    formState.activeMediaTab = 'images';
    formState.descriptionTab = 'write';
  }
  
  /**
   * Populate form with article data (for edit mode)
   * @param {Object} articleData - Article data to populate
   */
  function populateFormWithArticleData(articleData) {
    var titleInput = document.getElementById('article-form-title');
    var statusSelect = document.getElementById('article-form-status');
    var descriptionInput = document.getElementById('article-form-description');
    var externalLinkInput = document.getElementById('article-form-external-link');
    var clientCommentsInput = document.getElementById('article-form-client-comments');
    
    if (titleInput) titleInput.value = articleData.title || '';
    if (descriptionInput) descriptionInput.value = articleData.description || '';
    if (externalLinkInput) externalLinkInput.value = articleData.externalLink || '';
    if (clientCommentsInput) clientCommentsInput.value = articleData.clientComments || '';

    if (formState.descriptionTab === 'preview') {
      updateDescriptionPreview();
    }
    
    if (statusSelect && articleData.status) {
      statusSelect.value = articleData.status;
    }
    
    // Set attached images and files
    if (articleData.attachedImages && Array.isArray(articleData.attachedImages)) {
      formState.attachedImages = articleData.attachedImages.slice();
    }
    if (articleData.attachedFiles && Array.isArray(articleData.attachedFiles)) {
      formState.attachedFiles = articleData.attachedFiles.slice();
    }
  }
  
  /**
   * Open the form in Create mode
   * @param {string} companyId - Company ID for the new article
   * @param {Function} onSaveCallback - Callback function after successful save
   */
  function openCreateForm(companyId, onSaveCallback) {
    // Set state for create mode
    formState.currentMode = 'create';
    formState.articleId = null;
    formState.companyId = companyId;
    formState.onSaveCallback = onSaveCallback;
    formState.selectedTags = [];
    formState.attachedImages = [];
    formState.attachedFiles = [];
    formState.allImages = [];
    formState.allFiles = [];
    formState.imageSearchQuery = '';
    formState.fileSearchQuery = '';
    formState.activeMediaTab = 'images';
    formState.descriptionTab = 'write';
    
    // Create window and form
    formState.articleWindow = createFormWindow('create', null);
    initializeForm(formState.articleWindow, 'create');
  }
  
  /**
   * Open the form in Edit mode
   * @param {Object} articleData - Article object to edit
   * @param {Function} onSaveCallback - Callback function after successful save
   */
  function openEditForm(articleData, onSaveCallback) {
    if (!articleData || !articleData.id) {
      console.error('Invalid article data for edit mode');
      return;
    }
    
    // Set state for edit mode
    formState.currentMode = 'edit';
    formState.articleId = articleData.id;
    formState.companyId = articleData.companyId;
    formState.onSaveCallback = onSaveCallback;
    formState.attachedImages = [];
    formState.attachedFiles = [];
    formState.allImages = [];
    formState.allFiles = [];
    formState.imageSearchQuery = '';
    formState.fileSearchQuery = '';
    formState.activeMediaTab = 'images';
    formState.descriptionTab = 'write';
    
    // Load tags for the company and convert article tags to tag objects
    ArticleService.getTags(articleData.companyId)
      .then(function(companyTags) {
        // Convert article's tag IDs (if they exist) to full tag objects
        formState.selectedTags = [];
        
        if (articleData.tags && Array.isArray(articleData.tags)) {
          // Check if tags are already objects or IDs
          if (articleData.tags.length > 0 && typeof articleData.tags[0] === 'string') {
            // Tags are IDs
            formState.selectedTags = companyTags.filter(function(tag) {
              return articleData.tags.indexOf(tag.id) !== -1;
            });
          } else if (articleData.tags.length > 0 && articleData.tags[0].id) {
            // Tags are objects with id property
            formState.selectedTags = articleData.tags;
          } else {
            // Legacy format: tags are objects with label and color
            articleData.tags.forEach(function(articleTag) {
              var matchedTag = companyTags.find(function(companyTag) {
                return companyTag.name === articleTag.label;
              });
              if (matchedTag) {
                formState.selectedTags.push(matchedTag);
              }
            });
          }
        }
        
        // Create window and form
        formState.articleWindow = createFormWindow('edit', articleData.id);
        initializeForm(formState.articleWindow, 'edit');
        
        // Populate form with article data after a short delay
        setTimeout(function() {
          populateFormWithArticleData(articleData);
          updateTagsDisplay();
          updateAttachedImagesDisplay();
          updateAttachedFilesDisplay();
          updateMediaCounts();
        }, 150);
      })
      .catch(function(error) {
        console.error('Error loading tags for edit form:', error);
        dhtmlx.alert({
          title: 'Error',
          text: 'No se pudieron cargar las etiquetas. Por favor, inténtelo de nuevo.'
        });
      });
  }
  
  /**
   * Check if the form is currently open
   * @returns {boolean} True if form window is open
   */
  function isFormOpen() {
    return formState.articleWindow !== null;
  }
  
  /**
   * Get current form mode
   * @returns {string|null} 'create', 'edit', or null if form is closed
   */
  function getCurrentMode() {
    return formState.currentMode;
  }
  
  // Public API
  return {
    openCreateForm: openCreateForm,
    openEditForm: openEditForm,
    closeForm: closeForm,
    isFormOpen: isFormOpen,
    getCurrentMode: getCurrentMode
  };
})();
