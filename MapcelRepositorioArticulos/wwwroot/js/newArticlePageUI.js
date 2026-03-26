/**
 * New Article Page UI Module
 * Provides a dedicated page for creating and editing articles with a two-column layout
 * Uses HTML + Tailwind CSS within the main DHTMLX Layout Cell
 * 
 * Features:
 * - Breadcrumb navigation with dirty form confirmation
 * - Two-column layout (Core Data | Categorization & Assets)
 * - Editor.js rich text editor for article descriptions (outputs HTML)
 * - Tag selection via TagPickerUI
 * - File and image upload with staged file management
 * - Role-based permission checks
 * - Edit mode support: hydrates Editor.js from existing HTML content
 * 
 * Dependencies:
 * - dataModels.js (for status configuration)
 * - articleService.js (for CRUD operations)
 * - ImageService.js (for image operations)
 * - FileService.js (for file operations)
 * - TagPickerUI.js (for tag selection)
 * - CompanyService.js (for role checks)
 * - UserService.js (for user permissions)
 * - Editor.js (CDN: @editorjs/editorjs, @editorjs/header, @editorjs/list, @editorjs/table)
 * - editorjs-html (CDN: editorjs-html@4.0.0 for JSON-to-HTML conversion)
 * - DOMPurify (for HTML sanitization)
 */

var NewArticlePageUI = (function() {
  'use strict';

  // Page state management
  var pageState = {
    companyCode: null,
    companyName: '',
    layoutCell: null,
    onNavigateBack: null,
    selectedTags: [],
    allImages: [],             // All available images for the company
    allFiles: [],              // All available files for the company
    attachedImages: [],        // Already attached image IDs
    attachedFiles: [],         // Already attached file IDs
    imageSearchQuery: '',      // Search query for image library
    fileSearchQuery: '',       // Search query for file library
    stagedFiles: [],         // Files selected for upload (not yet saved)
    stagedImages: [],        // Images selected for upload (not yet saved)
    isFormDirty: false,
    allTags: [],
    canUserUpload: true,     // Determined by CompanySettings
    editorInstance: null,    // Editor.js instance
    editorUsesSimpleImage: false, // true when falling back to SimpleImage tool
    imagePasteHandler: null, // Paste handler reference for cleanup
    editMode: false,         // true when editing an existing article
    articleId: null,         // Article ID when in edit mode
    originalArticleData: null, // Original article data for edit mode
    isCurrentlyUploading: false
  };

  // Constants
  var FORM_FIELDS_INITIAL = {
    title: '',
    description: '',
    status: 'Borrador',
    externalLink: '',
    clientComments: ''
  };
  var MAX_EDITOR_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Get status options from articleStatusConfiguration
   * @returns {Array} Array of status options
   */
  function getStatusOptions() {
    if (typeof articleStatusConfiguration !== 'undefined') {
      return Object.keys(articleStatusConfiguration).map(function(key) {
        return {
          value: key,
          text: articleStatusConfiguration[key].label,
          color: articleStatusConfiguration[key].color
        };
      });
    }
    return [
      { value: 'Producción', text: 'Producción', color: '#52c41a' },
      { value: 'Borrador', text: 'Borrador', color: '#1890ff' },
      { value: 'Cerrado', text: 'Cerrado', color: '#8c8c8c' }
    ];
  }

  /**
   * Get today's date formatted for display
   * @returns {string} Formatted date string
   */
  function getTodayFormatted() {
    var today = new Date();
    var months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return today.getDate() + ' ' + months[today.getMonth()] + ' ' + today.getFullYear();
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /**
   * Mark form as dirty when user makes changes
   */
  function markFormDirty() {
    pageState.isFormDirty = true;
  }

  /**
   * Check if form has unsaved changes
   * @returns {boolean} True if form is dirty
   */
  function isFormDirty() {
    var titleInput = document.getElementById('new-article-title');
    var externalLinkInput = document.getElementById('new-article-external-link');
    var clientCommentsInput = document.getElementById('new-article-client-comments');

    var hasTextChanges = (titleInput && titleInput.value.trim() !== '') ||
                         (externalLinkInput && externalLinkInput.value.trim() !== '') ||
                         (clientCommentsInput && clientCommentsInput.value.trim() !== '');

    var hasTagChanges = pageState.selectedTags.length > 0;
    var hasFileChanges = pageState.stagedFiles.length > 0 || pageState.stagedImages.length > 0;

    return pageState.isFormDirty || hasTextChanges || hasTagChanges || hasFileChanges;
  }

  /**
   * Confirm navigation if form is dirty
   * @param {Function} onConfirm - Callback if user confirms navigation
   */
  function confirmNavigation(onConfirm) {
    if (isFormDirty()) {
      dhtmlx.confirm({
        title: 'Cambios sin guardar',
        text: '¿Estás seguro de que deseas salir? Los cambios no guardados se perderán.',
        ok: 'Sí, salir',
        cancel: 'Permanecer',
        callback: function(result) {
          if (result) {
            onConfirm();
          }
        }
      });
    } else {
      onConfirm();
    }
  }

  /**
   * Navigate back to the articles grid
   */
  function navigateToGrid() {
    if (pageState.onNavigateBack) {
      confirmNavigation(function() {
        resetPageState();
        pageState.onNavigateBack();
      });
    }
  }

  /**
   * Reset page state to initial values
   */
  function resetPageState() {
    pageState.selectedTags = [];
    pageState.allImages = [];
    pageState.allFiles = [];
    pageState.attachedImages = [];
    pageState.attachedFiles = [];
    pageState.imageSearchQuery = '';
    pageState.fileSearchQuery = '';
    pageState.stagedFiles = [];
    pageState.stagedImages = [];
    pageState.isFormDirty = false;
    pageState.editMode = false;
    pageState.articleId = null;
    pageState.originalArticleData = null;
    pageState.isCurrentlyUploading = false;
  }

  /**
   * Render the breadcrumb navigation
   * @returns {string} HTML string for breadcrumb
   */
  function renderBreadcrumb() {
    var breadcrumbLabel = pageState.editMode ? 'Editando Artículo' : 'Nuevo Artículo';
    return `
      <nav class="flex items-center space-x-2 text-sm mb-6">
        <button 
          id="breadcrumb-articles-link"
          type="button"
          class="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
        >
          Artículos
        </button>
        <span class="text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </span>
        <span class="text-gray-600 font-medium">${breadcrumbLabel}</span>
      </nav>
    `;
  }

  /**
   * Render the metadata header
   * @returns {string} HTML string for metadata header
   */
  function renderMetadataHeader() {
    return `
      <div class="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span class="text-sm text-gray-600">Fecha:</span>
          <span class="text-sm font-medium text-gray-800">${escapeHtml(getTodayFormatted())}</span>
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
          <span class="text-sm text-gray-600">Empresa:</span>
          <span class="text-sm font-medium text-gray-800">${escapeHtml(pageState.companyName)}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render the left column (Core Data)
   * @returns {string} HTML string for left column
   */
  function renderLeftColumn() {
    var statusOptions = getStatusOptions();

    return `
      <div class="space-y-6">
        <!-- Title Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Título <span class="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            id="new-article-title"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder="Ingresa el título del artículo"
          />
        </div>

        <!-- Status Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Estado
          </label>
          <select 
            id="new-article-status"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-base"
          >
            ${statusOptions.map(function(opt) {
              var selected = opt.value === 'Borrador' ? ' selected' : '';
              return '<option value="' + escapeHtml(opt.value) + '"' + selected + '>' + escapeHtml(opt.text) + '</option>';
            }).join('')}
          </select>
        </div>

        <!-- External Link Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Enlace Externo al Ticket Completo →
          </label>
          <input 
            type="url" 
            id="new-article-external-link"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder="https://example.com/issue"
          />
        </div>

        <!-- Description Field (Editor.js) -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Descripción <span class="text-red-500">*</span>
          </label>
          <div id="new-article-editor-container" class="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col h-[520px] min-h-[420px]">
            <div 
              id="new-article-editor-toolbar" 
              class="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-3 py-2 flex flex-wrap gap-2"
            >
              <button 
                type="button" 
                data-editor-action="paragraph"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition"
              >
                <span>+ Párrafo</span>
              </button>
              <button 
                type="button" 
                data-editor-action="heading"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition"
              >
                <span>⋆ Encabezado</span>
              </button>
              <button 
                type="button" 
                data-editor-action="list"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition"
              >
                <span>• Lista</span>
              </button>
              
              <button
                type="button"
                data-editor-action="ordered-list"
                class="d-inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition"  
              >
                <span># Enumeración</span>
              </button>
              <button 
                type="button" 
                data-editor-action="table"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition"
              >
                <span>Tabla</span>
              </button>
              <button 
                type="button" 
                data-editor-action="image"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition"
              >
                <span>Imagen</span>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto bg-white" id="new-article-editor-scroll">
              <div id="new-article-editorjs" class="min-h-[360px] px-4 py-4"></div>
            </div>
          </div>
          <div class="mt-2 text-xs text-gray-500">
            Editor de texto enriquecido: encabezados, listas, tablas.
          </div>
        </div>

        <!-- Client Comments Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Comentarios del Cliente
          </label>
          <textarea 
            id="new-article-client-comments"
            rows="4"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y text-base"
            placeholder="Comentarios adicionales del cliente"
          ></textarea>
        </div>
      </div>
    `;
  }

  /**
   * Render the right column (Categorization & Assets)
   * @returns {string} HTML string for right column
   */
  function renderRightColumn() {
    var uploadDisabledClass = pageState.canUserUpload ? '' : 'opacity-50 cursor-not-allowed';
    var uploadDisabledAttr = pageState.canUserUpload ? '' : 'disabled';

    return `
      <div class="space-y-6">
        <!-- Tag Picker Section -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Etiquetas
          </label>
          <div 
            id="new-article-tags-container"
            class="border border-gray-300 rounded-lg p-3 min-h-[60px] cursor-pointer hover:border-blue-400 transition-colors"
          >
            <div id="new-article-selected-tags" class="flex flex-wrap gap-2 min-h-[30px]">
              <span class="text-gray-400 text-sm">Ninguna etiqueta seleccionada</span>
            </div>
            <div class="mt-2 text-xs text-gray-500">
              Haz clic para seleccionar etiquetas
            </div>
          </div>
        </div>

        <!-- File Upload Section -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <label class="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Archivos
            </label>
            <span id="new-article-files-count" class="text-xs text-gray-500">0 archivos</span>
          </div>
          
          <!-- File Drop Zone -->
          <div 
            id="new-article-file-dropzone"
            class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${uploadDisabledClass}"
            ${uploadDisabledAttr}
          >
            <svg class="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p class="text-sm text-gray-600">Arrastra archivos o haz clic</p>
            <p class="text-xs text-gray-400 mt-1">Max 50MB por archivo</p>
          </div>
          <input type="file" id="new-article-file-input" multiple class="hidden" />

          <!-- Staged Files List -->
          <div id="new-article-staged-files" class="mt-3 space-y-2">
            <!-- Files will be listed here -->
          </div>

          <!-- Attached Files -->
          <div class="mt-4">
            <div id="new-article-attached-files" class="space-y-2">
              <!-- Attached files will be listed here -->
            </div>
          </div>

          <!-- Company File Library -->
          <div class="mt-4">
            <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Biblioteca de la empresa
            </div>
            <input
              type="text"
              id="new-article-file-search"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Buscar archivos"
            />
            <div id="new-article-available-files" class="mt-2 max-h-56 overflow-y-auto border border-gray-200 rounded-lg">
              <!-- Available files will be listed here -->
            </div>
          </div>
        </div>

        <!-- Image Upload Section -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <label class="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Imágenes
            </label>
            <span id="new-article-images-count" class="text-xs text-gray-500">0 imágenes</span>
          </div>
          <!-- Staged Images Grid -->
          <div id="new-article-staged-images" class="mt-3 grid grid-cols-3 gap-2">
            <!-- Images will be listed here -->
          </div>

          <!-- Attached Images -->
          <div class="mt-4">
            
            <div id="new-article-attached-images" class="space-y-2">
              <!-- Attached images will be listed here -->
            </div>
          </div>

          <!-- Company Image Library -->
          <div class="mt-4">
            <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Biblioteca de la empresa
            </div>
            <input
              type="text"
              id="new-article-image-search"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Buscar imágenes"
            />
            <div id="new-article-available-images" class="mt-2 max-h-56 overflow-y-auto border border-gray-200 rounded-lg">
              <!-- Available images will be listed here -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the action bar (footer)
   * @returns {string} HTML string for action bar
   */
  function renderActionBar() {
    var submitLabel = pageState.editMode ? 'Guardar Cambios' : 'Crear Artículo';
    var deleteButtonHtml = pageState.editMode ? `
        <button 
          id="new-article-delete-btn"
          type="button"
          class="px-6 py-2.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          Eliminar
        </button>
    ` : '';

    return `
      <div class="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg">
        <div class="flex items-center">
          ${deleteButtonHtml}
        </div>
        <div class="flex items-center gap-3">
          <button 
            id="new-article-cancel-btn"
            type="button"
            class="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button 
            id="new-article-submit-btn"
            type="button"
            class="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            ${submitLabel}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render the complete page HTML
   * @returns {string} Complete HTML for the page
   */
  function renderPageHtml() {
    return `
      <div class="h-full flex flex-col bg-gray-100">
        <!-- Main Content Area -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="mx-auto">
            ${renderBreadcrumb()}
            ${renderMetadataHeader()}
            
            <!-- Two Column Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
              <!-- Left Column: Core Data -->
              <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 class="text-lg font-semibold text-gray-800 mb-6">Datos del Artículo</h2>
                ${renderLeftColumn()}
              </div>
              
              <!-- Right Column: Categorization & Assets -->
              <div class="space-y-0">
                ${renderRightColumn()}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action Bar -->
        ${renderActionBar()}
      </div>
    `;
  }

  /**
   * Attach event handlers to page elements
   */
  function attachEventHandlers() {
    // Breadcrumb navigation
    var breadcrumbLink = document.getElementById('breadcrumb-articles-link');
    if (breadcrumbLink) {
      breadcrumbLink.addEventListener('click', navigateToGrid);
    }

    // Cancel button
    var cancelBtn = document.getElementById('new-article-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', navigateToGrid);
    }

    // Submit button
    var submitBtn = document.getElementById('new-article-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit);
    }

    // Delete button (edit mode only)
    var deleteBtn = document.getElementById('new-article-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', handleDeleteArticle);
    }

    // Tags container click
    var tagsContainer = document.getElementById('new-article-tags-container');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', openTagPicker);
    }

    // Form input change detection (non-editor fields)
    var inputs = document.querySelectorAll('#new-article-title, #new-article-external-link, #new-article-client-comments');
    inputs.forEach(function(input) {
      input.addEventListener('input', markFormDirty);
    });

    // File upload handlers
    setupFileUploadHandlers();
    setupImageUploadHandlers();
    setupMediaLibraryHandlers();
  }

  // =========================================================================
  // Editor.js Integration
  // =========================================================================

  /**
   * Initialize the Editor.js instance
   * Must be called after the DOM container #new-article-editorjs is rendered
   */
  function initializeEditor() {
    if (pageState.editorInstance) {
      pageState.editorInstance.destroy();
      pageState.editorInstance = null;
    }

    var editorHolder = document.getElementById('new-article-editorjs');
    if (!editorHolder) {
      console.error('Editor.js holder element not found');
      return;
    }

    var hasImageTool = typeof ImageTool !== 'undefined';
    var hasSimpleImage = typeof SimpleImage !== 'undefined';
    var imageToolConfig = null;

    if (hasImageTool) {
      imageToolConfig = {
        class: ImageTool,
        config: {
          uploader: {
            uploadByFile: imageUploadProcess,
            uploadByUrl: uploadEditorImageByUrl
          }
        }
      };
      pageState.editorUsesSimpleImage = false;
    } else if (hasSimpleImage) {
      imageToolConfig = {
        class: SimpleImage
      };
      pageState.editorUsesSimpleImage = true;
    } else {
      console.warn('No image tool found. Ensure @editorjs/simple-image is loaded.');
      pageState.editorUsesSimpleImage = false;
    }

    pageState.editorInstance = new EditorJS({
      holder: 'new-article-editorjs',
      placeholder: 'Describe el artículo en detalle...',
      minHeight: 360,
      tools: {
        header: {
          class: Header,
          config: {
            levels: [1, 2, 3, 4, 5, 6],
            defaultLevel: 2
          }
        },
        list: {
          class: typeof EditorjsList !== 'undefined' ? EditorjsList
               : typeof NestedList !== 'undefined' ? NestedList
               : List,
          inlineToolbar: true
        },
        table: {
          class: Table,
          inlineToolbar: true
        },
        code: {
          class: CodeTool
        },

        delimiter: {
          class: Delimiter
        },

        image: imageToolConfig
      },
      onReady: function() {
        attachImageUrlPasteHandler();
      },
      onChange: function() {
        markFormDirty();
      }
    });
  }

  /**
   * Detect image URLs and insert a SimpleImage block on paste.
   */
  function attachImageUrlPasteHandler() {
    var editorHolder = document.getElementById('new-article-editorjs');
    if (!editorHolder || !pageState.editorInstance) return;

    if (!pageState.editorUsesSimpleImage || typeof SimpleImage === 'undefined') return;

    if (pageState.imagePasteHandler) {
      document.removeEventListener('paste', pageState.imagePasteHandler);
    }

    pageState.imagePasteHandler = function(event) {
      var target = event.target;
      if (!editorHolder.contains(target)) return;

      var clipboard = event.clipboardData || window.clipboardData;
      if (!clipboard) return;

      var text = (clipboard.getData && clipboard.getData('text/plain')) || '';
      var url = (text || '').trim();
      if (!isLikelyImageUrl(url)) return;

      event.preventDefault();

      try {
        var index = pageState.editorInstance.blocks.getCurrentBlockIndex();
        pageState.editorInstance.blocks.insert('image', { url: url }, {}, index + 1, true);
        markFormDirty();
      } catch (error) {
        console.warn('Failed to insert image block from pasted URL:', error);
      }
    };

    document.addEventListener('paste', pageState.imagePasteHandler);
  }

  function getImageDimensions(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const dimensions = { width: img.width, height: img.height };
        URL.revokeObjectURL(img.src);
        resolve(dimensions);
      };
      // Handle potential load errors
      img.onerror = () => resolve({ width: 0, height: 0 });
    });
  }
  
  function imageUploadProcess(file) {
    return getImageDimensions(file).then(function(dimensions) {
      return promptAndInsertEditorImage(file, dimensions);
    }).catch(function(error) {
      return { success: 0, file: '' }
    });
  }
  
  /**
   * Prompt for metadata and upload before inserting into Editor.js
   * @param {File} file
   * @param {{width: number, height: number}} dimensions
   */
  function promptAndInsertEditorImage(file, dimensions) {
    if (pageState.isCurrentlyUploading) {
      return Promise.reject("Otra imagen está en proceso de subida.");
    }
    
    pageState.isCurrentlyUploading = true;
    
    const defaultMetadata = {
      description: file && file.name ? file.name : '',
      desiredFileName: file && file.name ? file.name : '',
      dimensions: dimensions ? dimensions : {},
    };
    
    return ImageMetadataEditorUI.promptForFileMetadata(file, defaultMetadata)
      // Load image preview
      .then(function(metadata) {
        if (!metadata) {
          dhtmlx.message({ type: 'info', text: 'Carga de imagen cancelada' });
          return null;
        }
        
        return uploadEditorImageByFile(file, metadata)
          .then(function(result) {
            if (!result || !result.file || !result.file.url || !pageState.editorInstance) return null;
            
            var currentIndex = pageState.editorInstance.blocks.getCurrentBlockIndex();
            var blockData = pageState.editorUsesSimpleImage
              ? { url: result.file.url, caption: metadata.description || '' }
              : { file: { url: result.file.url }, caption: metadata.description || '' };
            
            markFormDirty();
            return result;
          });
      })
      .catch(function(error) {
        console.error('Error al subir imagen arrastrada:', error);
        dhtmlx.message({
          type: 'error',
          text: error && error.message ? error.message : 'No se pudo subir la imagen arrastrada.'
        });
        return null;
      }).finally(function() { pageState.isCurrentlyUploading = false; });
  }

  /**
   * Insert a block into the editor after the current selection.
   * If the current block is empty, it replaces it.
   * If the current block has content, it inserts after it.
   * @param {string} blockType
   * @param {Object} blockData
   */
  async function insertEditorBlock(blockType, blockData) {
    if (!pageState.editorInstance) return;

    try {
      await pageState.editorInstance.isReady;

      const currentIndex = pageState.editorInstance.blocks.getCurrentBlockIndex();
      let shouldReplace = false;
      let targetIndex = (typeof currentIndex === 'number' && currentIndex >= 0) ? currentIndex + 1 : undefined;

      // Check if the current block is empty
      if (typeof currentIndex === 'number' && currentIndex >= 0) {
        const currentBlock = pageState.editorInstance.blocks.getBlockByIndex(currentIndex);
        const isCurrentBlockEmpty = currentBlock && currentBlock.isEmpty;

        // If it's an empty paragraph, we mark it for replacement
        if (isCurrentBlockEmpty) {
          shouldReplace = true;
          targetIndex = currentIndex; // Insert at the same position
        }
      }

      // 2. If replacing, delete the empty block first
      if (shouldReplace) {
        pageState.editorInstance.blocks.delete(currentIndex);
      }

      // 3. Insert the new block
      pageState.editorInstance.blocks.insert(blockType, blockData || {}, {}, targetIndex, true);

      // 4. Move Caret to the new block
      // We use a small timeout to ensure the DOM has rendered the new block before focusing
      setTimeout(() => {
        const finalIndex = (typeof targetIndex === 'number') ? targetIndex : (pageState.editorInstance.blocks.getBlocksCount() - 1);
        if (pageState.editorInstance.caret && typeof pageState.editorInstance.caret.setToBlock === 'function' && finalIndex >= 0) {
          pageState.editorInstance.caret.setToBlock(finalIndex);
        }
      }, 10);

      markFormDirty();
    } catch (error) {
      console.warn('Unable to insert block:', error);
    }
  }

  /**
   * Handle quick action toolbar clicks.
   * @param {string} action
   */
  function handleEditorToolbarAction(action) {
    switch (action) {
      case 'paragraph':
        insertEditorBlock('paragraph', { text: '' });
        break;
      case 'heading':
        insertEditorBlock('header', { text: '', level: 2 });
        break;
      case 'list':
        insertEditorBlock('list', { style: 'unordered', items: [{ content: '', items: [] }] });
        break;
      case 'ordered-list':
        insertEditorBlock('list', { style: 'ordered', items: [{ content: '', items: [] }] });
        break;
      case 'table':
        insertEditorBlock('table', { withHeadings: false, content: [['', ''], ['', '']] });
        break;
      case 'image':
        insertEditorBlock('image', pageState.editorUsesSimpleImage ? { url: '', caption: 'Haz clic para editar la imagen' } : { file: { url: '' }, caption: 'Selecciona o pega una imagen' });
        break;
      default:
        break;
    }
  }

  /**
   * Attach click handlers to the persistent editor toolbar.
   */
  function attachEditorToolbarHandlers() {
    var toolbar = document.getElementById('new-article-editor-toolbar');
    if (!toolbar) return;

    toolbar.addEventListener('click', function(event) {
      var button = event.target.closest('[data-editor-action]');
      if (!button) return;
      var action = button.getAttribute('data-editor-action');
      handleEditorToolbarAction(action);
    });
  }

  /**
   * Build the public file URL used by Editor.js image blocks
   * @param {string} companyCode - Company identifier
   * @param {string|number} fileId - Uploaded file identifier with extension
   * @returns {string} Image retrieval URL
   */
  function buildEditorImageUrl(companyCode, fileId) {
    return WEBSITE_BASE_URL + API_FILES_URL + encodeURIComponent(companyCode) + '/' + encodeURIComponent(fileId);
  }

  /**
   * Convert API errors to a readable string
   * @param {Response} response - Fetch response object
   * @returns {Promise<string>} Error message
   */
  function parseUploadErrorMessage(response) {
    return response.text()
      .then(function(responseText) {
        if (!responseText) {
          return 'Error al subir la imagen (' + response.status + ')';
        }
        return responseText;
      })
      .catch(function() {
        return 'Error al subir la imagen (' + response.status + ')';
      });
  }

  /**
   * Upload an image file to FilesController for Editor.js Image Tool
   * @param {File} file - Local file selected in Editor.js
   * @param {{description: string, desiredFileName: string, dimensions: [number, number]}} metadata
   * @returns {Promise<{success: number, file: {url: string, id: string|number}}>}
   */
  function uploadEditorImageByFile(file, metadata) {
    if (!file) {
      var emptyFileError = new Error('No se seleccionó ningún archivo de imagen.');
      dhtmlx.message({ type: 'error', text: emptyFileError.message });
      return Promise.reject(emptyFileError);
    }

    if (!pageState.canUserUpload) {
      var permissionError = new Error('No tienes permisos para subir imágenes.');
      dhtmlx.message({ type: 'error', text: permissionError.message });
      return Promise.reject(permissionError);
    }

    if (!file.type || file.type.indexOf('image/') !== 0) {
      var typeError = new Error('El archivo "' + file.name + '" no es una imagen válida.');
      dhtmlx.message({ type: 'error', text: typeError.message });
      return Promise.reject(typeError);
    }

    if (file.size > MAX_EDITOR_IMAGE_UPLOAD_SIZE) {
      var sizeError = new Error('La imagen "' + file.name + '" excede el límite de 10MB.');
      dhtmlx.message({ type: 'error', text: sizeError.message });
      return Promise.reject(sizeError);
    }

    var formData = new FormData();
    formData.append('file', file);
    var descriptionValue = metadata && metadata.description ? metadata.description.trim() : '';
    var desiredFileName = metadata && metadata.desiredFileName ? metadata.desiredFileName.trim() : '';
    if (descriptionValue) {
      formData.append('Description', descriptionValue);
    }
    if (desiredFileName) {
      formData.append('Name', desiredFileName);
    }

    // return fetch(API_BASE_URL + '/files/' + encodeURIComponent(pageState.companyCode), {
    //   method: 'POST',
    //   body: formData
    // })
      return ImageService.uploadImages([file], [metadata.dimensions], descriptionValue, appState.selectedCompanyCode, [metadata])
      .then(function(uploadResult) {
        var uploadedFile = uploadResult[0] && uploadResult[0].file ? uploadResult[0].file : uploadResult[0];
        if (!uploadedFile || uploadedFile.id === undefined || uploadedFile.id === null || uploadedFile.extension === null) {
          throw new Error('La respuesta del servidor no contiene el identificador del archivo.');
        }
        var imageIdAndExtension = escapeHtmlAttribute(uploadedFile.id + uploadedFile.extension);

        markFormDirty();
        ImagesTabManager.refreshImagesList();
        loadMediaData();

        return {
          success: 1,
          file: {
            id: uploadedFile.id,
            url: buildEditorImageUrl(pageState.companyCode, imageIdAndExtension)
          }
        };
      })
      .catch(function(error) {
        dhtmlx.message({
          type: 'error',
          text: error && error.message ? error.message : 'No se pudo subir la imagen.'
        });
        throw error;
      });
  }

  /**
  * Edits the name and description fields for an existing image.
  * Use this for editing, since uploadEditorImageByFile creates 
  * a new image.
  * 
  * @param {integer} fileId - File id
  * @param {{Name: string, Description: string}} metadata
  */
  function editImageFields(fileId, metadata) {
    if (!fileId || !metadata) {
      var emptyParameterError = new Error('Los campos id, nombre y descripción son obligatorios');
      dhtmlx.message({ type: 'error', text: emptyParameterError.message });
      return Promise.reject(emptyParameterError);
    }

    if (!pageState.canUserUpload) {
      var permissionError = new Error('No tienes permisos para subir imágenes.');
      dhtmlx.message({ type: 'error', text: permissionError.message });
      return Promise.reject(permissionError);
    }
    
    // Check that the image was successfully uploaded 
  }
  
  /**
   * Keep URL-based image insertion available in Image Tool.
   * @param {string} imageUrl - URL entered in Editor.js
   * @returns {Promise<{success: number, file: {url: string}}>}
   */
  function uploadEditorImageByUrl(imageUrl) {
    if (!imageUrl || !imageUrl.trim()) {
      var urlError = new Error('Debes indicar una URL de imagen válida.');
      dhtmlx.message({ type: 'error', text: urlError.message });
      return Promise.reject(urlError);
    }

    return Promise.resolve({
      success: 1,
      file: {
        url: imageUrl.trim()
      }
    });
  }

  /**
   * Check if the pasted URL is likely an image URL.
   * @param {string} url
   * @returns {boolean}
   */
  function isLikelyImageUrl(url) {
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) return false;
    return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url) || /\/image\/|images\./i.test(url);
  }

  /**
   * Destroy the Editor.js instance and clean up
   */
  function destroyEditor() {
    if (pageState.editorInstance) {
      pageState.editorInstance.destroy();
      pageState.editorInstance = null;
    }
    if (pageState.imagePasteHandler) {
      document.removeEventListener('paste', pageState.imagePasteHandler);
      pageState.imagePasteHandler = null;
    }
  }

  var EDITOR_HTML_SANITIZE_CONFIG = {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ADD_ATTR: ['colspan', 'rowspan', 'src', 'alt', 'title', 'style', 'class']
  };

  /**
   * Sanitize HTML fragments while allowing rich content inside table cells.
   * @param {string} htmlString
   * @returns {string}
   */
  function sanitizeEditorHtml(htmlString) {
    if (typeof DOMPurify === 'undefined') {
      return htmlString;
    }
    return DOMPurify.sanitize(htmlString, EDITOR_HTML_SANITIZE_CONFIG);
  }

  /**
   * Sanitize table cell HTML content, preserving headings, images, and inline styles.
   * @param {string} cellHtml
   * @returns {string}
   */
  function sanitizeEditorTableCellHtml(cellHtml) {
    return sanitizeEditorHtml(cellHtml || '');
  }

  /**
   * Render list items recursively for editorjs-html custom parser
   * Handles both simple string items and nested object-based items (list v2.0+)
   * @param {Array} items - List items from Editor.js block data
   * @param {string} listTag - 'ol' or 'ul'
   * @returns {string} HTML string of list items
   */
  function renderListItemsToHtml(items, listTag) {
    return items.map(function(item) {
      var content = typeof item === 'string' ? item : (item.content || '');
      var nestedHtml = '';
      if (item.items && item.items.length > 0) {
        nestedHtml = '<' + listTag + '>' + renderListItemsToHtml(item.items, listTag) + '</' + listTag + '>';
      }
      return '<li>' + content + nestedHtml + '</li>';
    }).join('');
  }

  /**
   * Convert Editor.js saved data (JSON) to a standard HTML string
   * Uses editorjs-html with custom parsers for list and table blocks
   * @param {Object} editorData - The saved data from editor.save()
   * @returns {string} HTML string
   */
  function convertEditorDataToHtml(editorData) {
    if (!editorData || !editorData.blocks || editorData.blocks.length === 0) {
      return '';
    }

    var customParsers = {
      list: function(block) {
        var listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
        var itemsHtml = renderListItemsToHtml(block.data.items, listTag);
        return '<' + listTag + '>' + itemsHtml + '</' + listTag + '>';
      },
      table: function(block) {
        var rows = block.data.content || [];
        var withHeadings = block.data.withHeadings;
        var tableHtml = '<table>';
        rows.forEach(function(row, rowIndex) {
          tableHtml += '<tr>';
          row.forEach(function(cell) {
            var cellTag = (withHeadings && rowIndex === 0) ? 'th' : 'td';
            var safeCellHtml = sanitizeEditorTableCellHtml(cell);
            tableHtml += '<' + cellTag + '>' + safeCellHtml + '</' + cellTag + '>';
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</table>';
        return tableHtml;
      },
      image: function(block) {
        var imageUrl = '';
        var caption = '';
        var isStretched = false;

        if (block && block.data) {
          imageUrl = (block.data.file && block.data.file.url) || block.data.url || '';
          caption = block.data.caption || '';
          isStretched = !!block.data.stretched;
        }

        if (!imageUrl) return '';

        var figureClass = 'cdx-image' + (isStretched ? ' cdx-image--stretched' : '');
        var captionHtml = caption ? '<figcaption>' + escapeHtml(caption) + '</figcaption>' : '';
        return '<figure class="' + figureClass + '"><img src="' + escapeHtml(imageUrl) + '" alt=""/>' + captionHtml + '</figure>';
      }
    };

    var parser = edjsHTML(customParsers);
    var htmlArray = parser.parse(editorData);
    return Array.isArray(htmlArray) ? htmlArray.join('') : htmlArray;
  }

  /**
   * Convert an HTML string into Editor.js block data for hydration in edit mode
   * Parses HTML elements into block objects compatible with Editor.js blocks.render()
   * @param {string} htmlString - The HTML string to convert
   * @returns {Object} Editor.js data object with blocks array
   */
  function htmlToEditorJsBlocks(htmlString) {
    var tempParser = new DOMParser();
    var doc = tempParser.parseFromString(htmlString, 'text/html');
    var blocks = [];

    /**
     * Parse <li> children of a list element into Editor.js list items
     * @param {HTMLElement} listElement - The <ul> or <ol> element
     * @returns {Array} Array of list item objects
     */
    function parseListChildren(listElement) {
      var listItems = [];
      var children = listElement.querySelectorAll(':scope > li');
      children.forEach(function(li) {
        var itemContent = '';
        var nestedItems = [];
        li.childNodes.forEach(function(child) {
          if (child.nodeType === Node.ELEMENT_NODE &&
              (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol')) {
            nestedItems = parseListChildren(child);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            itemContent += child.outerHTML;
          } else if (child.nodeType === Node.TEXT_NODE) {
            itemContent += child.textContent;
          }
        });
        listItems.push({ content: itemContent.trim(), items: nestedItems });
      });
      return listItems;
    }

    doc.body.childNodes.forEach(function(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        var tag = node.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
          blocks.push({
            type: 'header',
            data: { text: node.innerHTML, level: parseInt(tag[1], 10) }
          });
        } else if (tag === 'p') {
          if (node.innerHTML.trim()) {
            blocks.push({ type: 'paragraph', data: { text: node.innerHTML } });
          }
        } else if (tag === 'ul' || tag === 'ol') {
          blocks.push({
            type: 'list',
            data: {
              style: tag === 'ol' ? 'ordered' : 'unordered',
              items: parseListChildren(node)
            }
          });
        } else if (tag === 'table') {
          var tableContent = [];
          var hasHeadings = node.querySelector('th') !== null;
          node.querySelectorAll('tr').forEach(function(tr) {
            var row = [];
            tr.querySelectorAll('td, th').forEach(function(cell) {
              row.push(cell.innerHTML);
            });
            if (row.length > 0) tableContent.push(row);
          });
          blocks.push({
            type: 'table',
            data: { withHeadings: hasHeadings, content: tableContent }
          });
        } else if (tag === 'figure' && node.querySelector('img')) {
          var figureImage = node.querySelector('img');
          var figureCaption = node.querySelector('figcaption');
          blocks.push({
            type: 'image',
            data: {
              file: { url: figureImage.getAttribute('src') || '' },
              caption: figureCaption ? figureCaption.textContent : '',
              stretched: node.classList.contains('cdx-image--stretched')
            }
          });
        } else if (tag === 'img') {
          blocks.push({
            type: 'image',
            data: {
              file: { url: node.getAttribute('src') || '' },
              caption: ''
            }
          });
        } else {
          // Treat unknown block-level elements as paragraphs
          if (node.textContent.trim()) {
            blocks.push({ type: 'paragraph', data: { text: node.innerHTML } });
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        blocks.push({ type: 'paragraph', data: { text: node.textContent } });
      }
    });

    return { blocks: blocks };
  }

  /**
   * Hydrate the Editor.js instance with existing HTML content (for edit mode)
   * Tries editor.blocks.renderFromHTML first, falls back to manual block parsing
   * @param {Object} editor - The Editor.js instance
   * @param {string} htmlString - The HTML content to load
   */
  function hydrateEditorFromHtml(editor, htmlString) {
    var sanitizedHtml = sanitizeEditorHtml(htmlString);
    if (typeof DOMPurify === 'undefined') {
      console.warn('DOMPurify not loaded: HTML will not be sanitized for editor hydration');
    }

    editor.isReady.then(function() {
      if (typeof editor.blocks.renderFromHTML === 'function') {
        editor.blocks.renderFromHTML(sanitizedHtml);
      } else {
        // Fallback: parse HTML to Editor.js blocks manually
        var blocksData = htmlToEditorJsBlocks(sanitizedHtml);
        if (blocksData.blocks.length > 0) {
          editor.blocks.render(blocksData);
        }
      }
    }).catch(function(error) {
      console.error('Error hydrating editor from HTML:', error);
    });
  }

  /**
   * Populate form fields with existing article data (edit mode)
   */
  function populateFormForEditMode() {
    var article = pageState.originalArticleData;
    if (!article) return;

    var titleInput = document.getElementById('new-article-title');
    if (titleInput) titleInput.value = article.title || '';

    var statusSelect = document.getElementById('new-article-status');
    if (statusSelect && article.status) statusSelect.value = article.status;

    var externalLinkInput = document.getElementById('new-article-external-link');
    if (externalLinkInput) externalLinkInput.value = article.externalLink || '';

    var clientCommentsInput = document.getElementById('new-article-client-comments');
    if (clientCommentsInput) clientCommentsInput.value = article.clientComments || '';

    // Update tags display
    updateSelectedTagsDisplay();

    // Hydrate editor with article description HTML
    if (article.description && pageState.editorInstance) {
      hydrateEditorFromHtml(pageState.editorInstance, article.description);
    }
  }

  /**
   * Setup file upload handlers
   */
  function setupFileUploadHandlers() {
    var dropzone = document.getElementById('new-article-file-dropzone');
    var fileInput = document.getElementById('new-article-file-input');

    if (!dropzone || !fileInput || !pageState.canUserUpload) return;

    dropzone.addEventListener('click', function() {
      fileInput.click();
    });

    dropzone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropzone.classList.add('border-blue-500', 'bg-blue-50');
    });

    dropzone.addEventListener('dragleave', function() {
      dropzone.classList.remove('border-blue-500', 'bg-blue-50');
    });

    dropzone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropzone.classList.remove('border-blue-500', 'bg-blue-50');
      handleFileSelect(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', function(e) {
      handleFileSelect(e.target.files);
      fileInput.value = ''; // Reset to allow re-selecting same file
    });
  }

  /**
   * Handle file selection
   * @param {FileList} files - Selected files
   */
  function handleFileSelect(files) {
    var maxSize = 50 * 1024 * 1024; // 50MB

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (file.size > maxSize) {
        dhtmlx.message({
          type: 'error',
          text: 'El archivo "' + file.name + '" excede el límite de 50MB'
        });
        continue;
      }

      // Add to staged files with unique ID (Date.now + random to avoid collisions)
      pageState.stagedFiles.push({
        id: 'staged-file-' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '-' + i,
        file: file,
        name: file.name,
        size: file.size
      });
    }

    updateStagedFilesDisplay();
    markFormDirty();
  }

  /**
   * Update staged files display
   */
  function updateStagedFilesDisplay() {
    var container = document.getElementById('new-article-staged-files');
    
    if (!container) return;

    updateMediaCounts();

    if (pageState.stagedFiles.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = pageState.stagedFiles.map(function(fileData) {
      var sizeKB = Math.round(fileData.size / 1024);
      var sizeDisplay = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
      
      return `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200" data-file-id="${escapeHtml(fileData.id)}">
          <div class="flex items-center gap-2 min-w-0">
            <svg class="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <span class="text-sm text-gray-700 truncate">${escapeHtml(fileData.name)}</span>
            <span class="text-xs text-gray-400">(${sizeDisplay})</span>
          </div>
          <button 
            type="button" 
            class="p-1 text-gray-400 hover:text-red-500 transition-colors remove-staged-file"
            data-file-id="${escapeHtml(fileData.id)}"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    // Attach remove handlers
    container.querySelectorAll('.remove-staged-file').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var fileId = btn.getAttribute('data-file-id');
        removeStagedFile(fileId);
      });
    });
  }

  /**
   * Remove a staged file
   * @param {string} fileId - File ID to remove
   */
  function removeStagedFile(fileId) {
    pageState.stagedFiles = pageState.stagedFiles.filter(function(f) {
      return f.id !== fileId;
    });
    updateStagedFilesDisplay();
  }

  /**
   * Setup image upload handlers
   */
  function setupImageUploadHandlers() {
    var imageInput = document.getElementById('new-article-image-input');

    if (!imageInput || !pageState.canUserUpload) return;

    imageInput.addEventListener('change', function(e) {
      handleImageSelect(e.target.files);
      imageInput.value = '';
    });
  }

  /**
   * Setup handlers for the media library search inputs
   */
  function setupMediaLibraryHandlers() {
    var fileSearchInput = document.getElementById('new-article-file-search');
    if (fileSearchInput) {
      fileSearchInput.value = pageState.fileSearchQuery || '';
      fileSearchInput.addEventListener('input', function(e) {
        pageState.fileSearchQuery = e.target.value || '';
        updateAvailableFilesDisplay();
      });
    }

    var imageSearchInput = document.getElementById('new-article-image-search');
    if (imageSearchInput) {
      imageSearchInput.value = pageState.imageSearchQuery || '';
      imageSearchInput.addEventListener('input', function(e) {
        pageState.imageSearchQuery = e.target.value || '';
        updateAvailableImagesDisplay();
      });
    }
  }

  /**
   * Handle image selection
   * @param {FileList} files - Selected files
   */
  function handleImageSelect(files) {
    var maxSize = 10 * 1024 * 1024; // 10MB
    var acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      
      if (acceptedTypes.indexOf(file.type) === -1) {
        dhtmlx.message({
          type: 'error',
          text: 'El archivo "' + file.name + '" no es un formato de imagen válido'
        });
        continue;
      }

      if (file.size > maxSize) {
        dhtmlx.message({
          type: 'error',
          text: 'La imagen "' + file.name + '" excede el límite de 10MB'
        });
        continue;
      }

      // Create preview URL and add to staged images with unique ID
      var previewUrl = URL.createObjectURL(file);
      pageState.stagedImages.push({
        id: 'staged-image-' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '-' + i,
        file: file,
        name: file.name,
        size: file.size,
        previewUrl: previewUrl,
        desiredFileName: file.name,
        description: ''
      });
    }

    updateStagedImagesDisplay();
    markFormDirty();
  }

  /**
   * Update staged images display
   */
  function updateStagedImagesDisplay() {
    var container = document.getElementById('new-article-staged-images');
    
    if (!container) return;

    updateMediaCounts();

    if (pageState.stagedImages.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = pageState.stagedImages.map(function(imageData) {
      return `
        <div class="relative group" data-image-id="${escapeHtml(imageData.id)}">
          <img 
            src="${imageData.previewUrl}" 
            alt="${escapeHtml(imageData.name)}"
            class="w-full h-20 object-cover rounded-lg border border-gray-200"
          />
          <button 
            type="button" 
            class="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity remove-staged-image"
            data-image-id="${escapeHtml(imageData.id)}"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    // Attach remove handlers
    container.querySelectorAll('.remove-staged-image').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imageId = btn.getAttribute('data-image-id');
        removeStagedImage(imageId);
      });
    });
  }

  /**
   * Remove a staged image
   * @param {string} imageId - Image ID to remove
   */
  function removeStagedImage(imageId) {
    var image = pageState.stagedImages.find(function(img) {
      return img.id === imageId;
    });
    
    if (image && image.previewUrl) {
      URL.revokeObjectURL(image.previewUrl);
    }

    pageState.stagedImages = pageState.stagedImages.filter(function(img) {
      return img.id !== imageId;
    });
    updateStagedImagesDisplay();
  }

  // =========================================================================
  // Media Library + Attachments
  // =========================================================================

  /**
   * Format counts for display in header badges
   * @param {number} count - Item count
   * @param {string} singularLabel - Singular label
   * @param {string} pluralLabel - Plural label
   * @returns {string} Formatted label
   */
  function formatCountLabel(count, singularLabel, pluralLabel) {
    return count + ' ' + (count === 1 ? singularLabel : pluralLabel);
  }

  /**
   * Find index of an ID in a list using string matching
   * @param {Array} list - Array of IDs
   * @param {string|number} id - ID to find
   * @returns {number} Index or -1
   */
  function findIdIndex(list, id) {
    var targetId = String(id);
    return list.findIndex(function(item) {
      return String(item) === targetId;
    });
  }

  /**
   * Update media counts in section headers
   */
  function updateMediaCounts() {
    var imagesCount = document.getElementById('new-article-images-count');
    var filesCount = document.getElementById('new-article-files-count');

    var totalImages = pageState.attachedImages.length + pageState.stagedImages.length;
    var totalFiles = pageState.attachedFiles.length + pageState.stagedFiles.length;

    if (imagesCount) {
      imagesCount.textContent = formatCountLabel(totalImages, 'imagen', 'imágenes');
    }
    if (filesCount) {
      filesCount.textContent = formatCountLabel(totalFiles, 'archivo', 'archivos');
    }
  }

  /**
   * Format file sizes for display
   * @param {number|string} sizeValue - File size in bytes or formatted string
   * @returns {string} Human-readable size
   */
  function formatFileSize(sizeValue) {
    if (sizeValue === null || sizeValue === undefined) return '—';
    if (typeof sizeValue === 'string') return sizeValue;
    if (typeof sizeValue !== 'number' || isNaN(sizeValue)) return '—';
    var KB_IN_BYTES = 1024;
    var MB_IN_BYTES = KB_IN_BYTES * 1024;
    var GB_IN_BYTES = MB_IN_BYTES * 1024;

    if (sizeValue < KB_IN_BYTES) return sizeValue + ' B';
    if (sizeValue < MB_IN_BYTES) return Math.round(sizeValue / KB_IN_BYTES) + ' KB';
    if (sizeValue < GB_IN_BYTES) return (sizeValue / MB_IN_BYTES).toFixed(1) + ' MB';
    return (sizeValue / GB_IN_BYTES).toFixed(1) + ' GB';
  }

  /**
   * Escape string for safe HTML attribute usage
   * @param {string} value - Raw attribute value
   * @returns {string} Escaped attribute string
   */
  function escapeHtmlAttribute(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Validate that a URL is safe (no javascript: protocol)
   * @param {string} url - URL to validate
   * @returns {string} Safe URL or empty string
   */
  function sanitizeUrl(url) {
    if (!url) return '';
    var trimmedUrl = url.trim();
    var normalizedUrl = trimmedUrl.toLowerCase();
    var urlWithoutWhitespace = trimmedUrl.replace(/\s+/g, '').toLowerCase();
    if (urlWithoutWhitespace.indexOf('javascript:') === 0 ||
        urlWithoutWhitespace.indexOf('data:') === 0 ||
        urlWithoutWhitespace.indexOf('vbscript:') === 0 ||
        urlWithoutWhitespace.indexOf('file:') === 0) {
      return '';
    }

    var hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedUrl);
    if (hasProtocol && normalizedUrl.indexOf('http://') !== 0 && normalizedUrl.indexOf('https://') !== 0) {
      return '';
    }
    if (!hasProtocol && normalizedUrl.indexOf('/') !== 0) {
      return '';
    }

    return escapeHtmlAttribute(trimmedUrl);
  }

  /**
   * Resolve fileIds from original article data into attached media lists
   */
  function resolveFileIdsFromArticleData() {
    if (!pageState.originalArticleData || !pageState.originalArticleData.fileIds) return;

    var fileIds = pageState.originalArticleData.fileIds;
    if (!Array.isArray(fileIds) || fileIds.length === 0) return;

    var imageIdSet = new Set(pageState.allImages.map(function(img) { return String(img.id); }));
    var fileIdSet = new Set(pageState.allFiles.map(function(file) { return String(file.id); }));

    fileIds.forEach(function(id) {
      var normalizedId = String(id);
      if (imageIdSet.has(normalizedId) && findIdIndex(pageState.attachedImages, normalizedId) === -1) {
        pageState.attachedImages.push(id);
      } else if (fileIdSet.has(normalizedId) && findIdIndex(pageState.attachedFiles, normalizedId) === -1) {
        pageState.attachedFiles.push(id);
      }
    });
  }

  /**
   * Load media library data for the company
   */
  function loadMediaData() {
    if (!pageState.companyCode) return;

    ImageService.getImages(pageState.companyCode)
      .then(function(images) {
        pageState.allImages = images || [];
        resolveFileIdsFromArticleData();
        updateAvailableImagesDisplay();
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

    FileService.getFiles(pageState.companyCode)
      .then(function(files) {
        pageState.allFiles = files || [];
        resolveFileIdsFromArticleData();
        updateAvailableFilesDisplay();
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
   * Update the available images list (company library)
   */
  function updateAvailableImagesDisplay() {
    var container = document.getElementById('new-article-available-images');
    if (!container) return;

    var filteredImages = pageState.allImages.slice();

    if (pageState.imageSearchQuery) {
      var query = pageState.imageSearchQuery.toLowerCase();
      filteredImages = filteredImages.filter(function(img) {
        return (img.name && img.name.toLowerCase().includes(query)) ||
          (img.description && img.description.toLowerCase().includes(query));
      });
    }

    filteredImages = filteredImages.filter(function(img) {
      return findIdIndex(pageState.attachedImages, img.id) === -1;
    });

    if (filteredImages.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No hay imágenes disponibles</div>';
      return;
    }

    container.innerHTML = filteredImages.map(function(img) {
      return renderAvailableImageItem(img);
    }).join('');

    container.querySelectorAll('[data-attach-image-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imageId = btn.getAttribute('data-attach-image-id');
        attachImage(imageId);
      });
    });

    container.querySelectorAll('[data-copy-image-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imageIdWithExtension = btn.getAttribute('data-copy-image-id');
        const imageUrl = sanitizeUrl(buildEditorImageUrl(pageState.companyCode, imageIdWithExtension));
        insertEditorBlock('image', {
          file: {
            url: imageUrl
          }
        });
      });
    });
  }

  /**
   * Render an available image row
   * @param {Object} img - Image object
   * @returns {string} HTML string
   */
  function renderAvailableImageItem(img) {
    var imageIdAndExtension = escapeHtmlAttribute(img.id + img.extension);
    var thumbnailUrl = sanitizeUrl(img.thumbnailUrl || img.url || buildEditorImageUrl(pageState.companyCode, imageIdAndExtension));
    var dimensionsLabel = img.dimensions ? escapeHtml(img.dimensions) : '—';
    var sizeLabel = img.size ? escapeHtml(img.size) : '—';

    return `
      <div class="flex items-center p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
        <img 
          src="${thumbnailUrl}" 
          alt="${escapeHtmlAttribute(img.name)}"
          class="w-10 h-10 object-cover rounded flex-shrink-0"
        />
        <div class="ml-3 flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(img.name)}</div>
          <div class="text-xs text-gray-500">${dimensionsLabel} • ${sizeLabel}</div>
        </div>
        <button 
          type="button"
          data-copy-image-id="${imageIdAndExtension}"
          class="ml-2 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          title="Insertar a la descripción"
        >
          Insertar
        </button>
        <button 
          type="button"
          data-attach-image-id="${escapeHtmlAttribute(img.id)}"
          class="ml-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
        >
          Adjuntar
        </button>
      </div>
    `;
  }

  /**
   * Update the available files list (company library)
   */
  function updateAvailableFilesDisplay() {
    var container = document.getElementById('new-article-available-files');
    if (!container) return;

    var filteredFiles = pageState.allFiles.slice();

    if (pageState.fileSearchQuery) {
      var query = pageState.fileSearchQuery.toLowerCase();
      filteredFiles = filteredFiles.filter(function(file) {
        return (file.name && file.name.toLowerCase().includes(query)) ||
          (file.description && file.description.toLowerCase().includes(query));
      });
    }

    filteredFiles = filteredFiles.filter(function(file) {
      return findIdIndex(pageState.attachedFiles, file.id) === -1;
    });

    if (filteredFiles.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No hay archivos disponibles</div>';
      return;
    }

    container.innerHTML = filteredFiles.map(function(file) {
      return renderAvailableFileItem(file);
    }).join('');

    container.querySelectorAll('[data-attach-file-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var fileId = btn.getAttribute('data-attach-file-id');
        attachFile(fileId);
      });
    });
  }

  /**
   * Render an available file row
   * @param {Object} file - File object
   * @returns {string} HTML string
   */
  function renderAvailableFileItem(file) {
    var extension = escapeHtml(Utils.getFileExtension(file.name).toUpperCase());
    var fileSizeLabel = escapeHtml(formatFileSize(file.size));

    return `
      <div class="flex items-center p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
        <div class="w-10 h-10 flex items-center justify-center bg-gray-100 rounded flex-shrink-0">
          <span class="text-xs font-medium text-gray-500">${extension}</span>
        </div>
        <div class="ml-3 flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(file.name)}</div>
          <div class="text-xs text-gray-500">${fileSizeLabel}</div>
        </div>
        <button 
          type="button"
          data-attach-file-id="${escapeHtmlAttribute(file.id)}"
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
    if (findIdIndex(pageState.attachedImages, imageId) !== -1) return;
    pageState.attachedImages.push(imageId);
    updateAttachedImagesDisplay();
    updateAvailableImagesDisplay();
    updateMediaCounts();
    markFormDirty();
  }

  /**
   * Detach an image from the article
   * @param {string} imageId - Image ID to detach
   */
  function detachImage(imageId) {
    var index = findIdIndex(pageState.attachedImages, imageId);
    if (index === -1) return;
    pageState.attachedImages.splice(index, 1);
    updateAttachedImagesDisplay();
    updateAvailableImagesDisplay();
    updateMediaCounts();
    markFormDirty();
  }

  /**
   * Attach a file to the article
   * @param {string} fileId - File ID to attach
   */
  function attachFile(fileId) {
    if (findIdIndex(pageState.attachedFiles, fileId) !== -1) return;
    pageState.attachedFiles.push(fileId);
    updateAttachedFilesDisplay();
    updateAvailableFilesDisplay();
    updateMediaCounts();
    markFormDirty();
  }

  /**
   * Detach a file from the article
   * @param {string} fileId - File ID to detach
   */
  function detachFile(fileId) {
    var index = findIdIndex(pageState.attachedFiles, fileId);
    if (index === -1) return;
    pageState.attachedFiles.splice(index, 1);
    updateAttachedFilesDisplay();
    updateAvailableFilesDisplay();
    updateMediaCounts();
    markFormDirty();
  }

  /**
   * Update attached images display
   */
  function updateAttachedImagesDisplay() {
    var container = document.getElementById('new-article-attached-images');
    if (!container) return;

    if (pageState.attachedImages.length === 0) {
      container.innerHTML = '<div class="text-sm text-gray-400"></div>';
      return;
    }

    var attachedImageObjects = pageState.attachedImages.map(function(id) {
      return pageState.allImages.find(function(img) {
        return String(img.id) === String(id);
      });
    }).filter(function(img) { return img; });

    if (attachedImageObjects.length === 0) {
      container.innerHTML = '<div class="text-sm text-gray-400">Imágenes adjuntas no disponibles</div>';
      return;
    }

    container.innerHTML = attachedImageObjects.map(function(img) {
      var imageIdAndExtension = escapeHtmlAttribute(img.id + img.extension);
      var thumbnailUrl = sanitizeUrl(img.thumbnailUrl || img.url || buildEditorImageUrl(pageState.companyCode, imageIdAndExtension));
      var dimensionsLabel = img.dimensions ? escapeHtml(img.dimensions) : '—';
      var sizeLabel = img.size ? escapeHtml(img.size) : '—';

      return `
        <div class="flex items-center p-2 bg-blue-50 rounded-lg border border-blue-100">
          <img 
            src="${thumbnailUrl}" 
            alt="${escapeHtmlAttribute(img.name)}"
            class="w-10 h-10 object-cover rounded flex-shrink-0"
          />
          <div class="ml-3 flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(img.name)}</div>
            <div class="text-xs text-gray-500">${dimensionsLabel} • ${sizeLabel}</div>
          </div>
          <button 
            type="button"
            data-copy-image-id="${escapeHtmlAttribute(img.id)}"
            class="ml-2 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-white rounded"
            title="Insertar a la descripción"
          >
            Insertar
          </button>
          <button 
            type="button"
            data-detach-image-id="${escapeHtmlAttribute(img.id)}"
            class="ml-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
          >
            Quitar
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-detach-image-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imageId = btn.getAttribute('data-detach-image-id');
        detachImage(imageId);
      });
    });

    container.querySelectorAll('[data-copy-image-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imageIdWithExtension = btn.getAttribute('data-copy-image-id');
        const imageUrl = sanitizeUrl(buildEditorImageUrl(pageState.companyCode, imageIdWithExtension));
        insertEditorBlock('image', {
          file: {
            url: imageUrl
          }
        });
      });
    });
  }

  /**
   * Update attached files display
   */
  function updateAttachedFilesDisplay() {
    var container = document.getElementById('new-article-attached-files');
    if (!container) return;

    if (pageState.attachedFiles.length === 0) {
      container.innerHTML = '<div class="text-sm text-gray-400">Sin archivos adjuntos</div>';
      return;
    }

    var attachedFileObjects = pageState.attachedFiles.map(function(id) {
      return pageState.allFiles.find(function(file) {
        return String(file.id) === String(id);
      });
    }).filter(function(file) { return file; });

    if (attachedFileObjects.length === 0) {
      container.innerHTML = '<div class="text-sm text-gray-400">Archivos adjuntos no disponibles</div>';
      return;
    }

    container.innerHTML = attachedFileObjects.map(function(file) {
      var extension = escapeHtml(Utils.getFileExtension(file.name).toUpperCase());
      var fileSizeLabel = escapeHtml(formatFileSize(file.size));

      return `
        <div class="flex items-center p-2 bg-blue-50 rounded-lg border border-blue-100">
          <div class="w-8 h-8 flex items-center justify-center bg-white rounded flex-shrink-0">
            <span class="text-xs font-medium text-gray-500">${extension}</span>
          </div>
          <div class="ml-2 flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(file.name)}</div>
            <div class="text-xs text-gray-500">${fileSizeLabel}</div>
          </div>
          <button 
            type="button"
            data-detach-file-id="${escapeHtmlAttribute(file.id)}"
            class="ml-2 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
          >
            Quitar
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-detach-file-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var fileId = btn.getAttribute('data-detach-file-id');
        detachFile(fileId);
      });
    });
  }

  /**
   * Copy image URL to clipboard with feedback
   * @param {string|number} imageIdAndExtension - Image ID
   */
  function copyImageUrlToClipboard(imageIdAndExtension) {
    var imageUrl = buildEditorImageUrl(pageState.companyCode, imageIdAndExtension);

    function showCopySuccess() {
      dhtmlx.message({
        type: 'success',
        text: 'URL de la imagen copiada'
      });
    }

    function showCopyError() {
      dhtmlx.message({
        type: 'error',
        text: 'No se pudo copiar la URL de la imagen'
      });
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(imageUrl)
        .then(showCopySuccess)
        .catch(function(error) {
          console.warn('Clipboard write failed:', error);
          showCopyError();
        });
      return;
    }

    try {
      // Legacy fallback for browsers without the navigator.clipboard API.
      var temporaryInput = document.createElement('textarea');
      temporaryInput.value = imageUrl;
      temporaryInput.style.position = 'fixed';
      temporaryInput.style.opacity = '0';
      document.body.appendChild(temporaryInput);
      temporaryInput.select();
      var wasCopied = document.execCommand('copy');
      document.body.removeChild(temporaryInput);
      if (wasCopied) {
        showCopySuccess();
      } else {
        showCopyError();
      }
    } catch (error) {
      console.warn('Clipboard fallback failed:', error);
      showCopyError();
    }
  }

  /**
   * Open tag picker
   */
  function openTagPicker() {
    var selectedIds = pageState.selectedTags.map(function(tag) {
      return tag.id;
    });

    TagPickerUI.openTagPicker(pageState.companyCode, selectedIds, function(selectedTags) {
      pageState.selectedTags = selectedTags;
      updateSelectedTagsDisplay();
      markFormDirty();
    });
  }

  /**
   * Update selected tags display
   */
  function updateSelectedTagsDisplay() {
    var container = document.getElementById('new-article-selected-tags');
    if (!container) return;

    if (pageState.selectedTags.length === 0) {
      container.innerHTML = '<span class="text-gray-400 text-sm">Ninguna etiqueta seleccionada</span>';
      return;
    }

    container.innerHTML = pageState.selectedTags.map(function(tag) {
      return `
        <span 
          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
          style="background-color: ${escapeHtml(tag.color)}20; color: ${escapeHtml(tag.color)}; border: 1px solid ${escapeHtml(tag.color)}40;"
        >
          ${escapeHtml(tag.name)}
        </span>
      `;
    }).join('');
  }

  /**
   * Validate form data
   * @param {string} descriptionHtml - HTML content from the editor
   * @returns {boolean} True if valid
   */
  function validateForm(descriptionHtml) {
    const titleInput = document.getElementById('new-article-title');
    const linkInput = document.getElementById('new-article-external-link');

    var errors = [];

    if (!titleInput || !titleInput.value.trim()) {
      errors.push('El título es obligatorio');
    }

    if (!descriptionHtml || !descriptionHtml.trim()) {
      errors.push('La descripción es obligatoria');
    }
    
    if (!validateLink(linkInput.value.trim())) {
      errors.push('El enlace externo no es válido');
    }

    if (errors.length > 0) {
      dhtmlx.alert({
        title: 'Campos requeridos',
        text: errors.join('<br>')
      });
      return false;
    }

    return true;
  }
  
  function validateLink(linkContent) {
    // Empty link is valid
    if (linkContent.trim().length === 0) { return true }

    try {
      const url = new URL(linkContent);
      // Optional: Ensure the protocol is http or https
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  /**
   * Get form data including the editor HTML content
   * @param {string} descriptionHtml - HTML string from the editor
   * @returns {Object} Form data object ready for API submission
   */
  function getFormData(descriptionHtml) {
    var titleInput = document.getElementById('new-article-title');
    var statusSelect = document.getElementById('new-article-status');
    var externalLinkInput = document.getElementById('new-article-external-link');
    var clientCommentsInput = document.getElementById('new-article-client-comments');

    var tagIds = pageState.selectedTags.map(function(tag) {
      return tag.id;
    });

    return {
      title: titleInput ? titleInput.value.trim() : '',
      description: descriptionHtml,
      status: statusSelect ? statusSelect.value : 'Borrador',
      externalLink: externalLinkInput ? externalLinkInput.value.trim() : '',
      clientComments: clientCommentsInput ? clientCommentsInput.value.trim() : '',
      companyCode: pageState.companyCode,
      tags: tagIds,
      attachedImages: pageState.attachedImages.slice(),
      attachedFiles: pageState.attachedFiles.slice(),
      fileIds: pageState.attachedImages.slice().concat(pageState.attachedFiles.slice())
    };
  }

  /**
   * Handle form submission (create or edit)
   * Saves editor content as HTML and sends to the backend API
   */
  function handleSubmit() {
    var submitBtn = document.getElementById('new-article-submit-btn');

    if (!pageState.editorInstance) {
      console.error('Editor not initialized');
      return;
    }

    // Save editor content (returns a Promise with JSON block data)
    pageState.editorInstance.save()
      .then(function(editorData) {
        // Convert Editor.js JSON blocks to standard HTML
        var descriptionHtml = sanitizeEditorHtml(convertEditorDataToHtml(editorData));
        if (typeof DOMPurify === 'undefined') {
          console.warn('DOMPurify not loaded: HTML output will not be sanitized');
        }

        if (!validateForm(descriptionHtml)) {
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = pageState.editMode ? 'Guardando...' : 'Creando...';
        }

        var formData = getFormData(descriptionHtml);

        // Upload any staged files and images
        var uploadPromises = [];

        pageState.stagedFiles.forEach(function(fileData) {
          uploadPromises.push(
            FileService.uploadFiles([fileData.file], '', pageState.companyCode)
              .then(function(files) {
                var uploadedFile = files && files[0];
                if (!uploadedFile || uploadedFile.id === undefined || uploadedFile.id === null) {
                  throw new Error('La respuesta del servidor no contiene el identificador del archivo.');
                }
                return { type: 'file', id: uploadedFile.id };
              })
          );
        });

        pageState.stagedImages.forEach(function(imageData) {
          uploadPromises.push(
            ImageService.uploadImages([imageData.file], [], imageData.description || '', pageState.companyCode, [{
              description: imageData.description || '',
              desiredFileName: imageData.desiredFileName || imageData.file.name
            }])
              .then(function(images) {
                var uploadedImage = images && images[0];
                if (!uploadedImage || uploadedImage.id === undefined || uploadedImage.id === null) {
                  throw new Error('La respuesta del servidor no contiene el identificador de la imagen.');
                }
                return { type: 'image', id: uploadedImage.id };
              })
          );
        });

        // Wait for all uploads to complete, then save the article
        Promise.all(uploadPromises)
          .then(function(uploadResults) {
            uploadResults.forEach(function(result) {
              if (result.type === 'file') {
                formData.attachedFiles.push(result.id);
              } else if (result.type === 'image') {
                formData.attachedImages.push(result.id);
              }
            });

            formData.fileIds = formData.attachedImages.slice().concat(formData.attachedFiles.slice());

            if (pageState.editMode) {
              return ArticleService.updateArticle(pageState.articleId, formData, pageState.companyCode);
            } else {
              return ArticleService.createArticle(formData, pageState.companyCode);
            }
          })
          .then(function(response) {
            if (response.status === 'success') {
              var actionLabel = pageState.editMode ? 'actualizado' : 'creado';
              dhtmlx.message({
                text: 'Artículo ' + actionLabel + ' exitosamente',
                type: 'success',
                expire: 3000
              });

              var savedData = response.data;
              var navigateBackCallback = pageState.onNavigateBack;
              resetPageState();
              if (navigateBackCallback) {
                navigateBackCallback(savedData);
              }
            }
          })
          .catch(function(error) {
            console.error('Error saving article:', error);
            dhtmlx.alert({
              title: 'Error',
              text: 'Error al guardar el artículo: ' + error.message
            });

            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = pageState.editMode ? 'Guardar Cambios' : 'Crear Artículo';
            }
          });
      })
      .catch(function(error) {
        console.error('Error saving editor content:', error);
        dhtmlx.alert({
          title: 'Error',
          text: 'Error al obtener el contenido del editor.'
        });
      });
  }

  /**
   * Handle delete article action with confirmation
   */
  function handleDeleteArticle() {
    if (!pageState.editMode || !pageState.articleId || !pageState.companyCode) return;

    var deleteBtn = document.getElementById('new-article-delete-btn');
    var articleId = pageState.articleId;
    var companyCode = pageState.companyCode;

    dhtmlx.confirm({
      title: 'Confirmar eliminación',
      text: '¿Estás seguro de que deseas eliminar este artículo? Esta acción no se puede deshacer.',
      callback: function(result) {
        if (!result) return;

        if (deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Eliminando...';
        }

        fetch(`${API_BASE_URL}/articles/${encodeURIComponent(companyCode)}/${encodeURIComponent(articleId)}`, {
          method: 'DELETE'
        })
          .then(function(response) {
            if (!response.ok) {
              throw new Error('Failed to delete article: ' + response.status);
            }

            if (typeof ArticleService !== 'undefined' && ArticleService.clearCache) {
              ArticleService.clearCache();
            }

            dhtmlx.message({
              type: 'success',
              text: 'Artículo eliminado exitosamente',
              expire: 3000
            });

            var navigateBackCallback = pageState.onNavigateBack;
            resetPageState();
            if (navigateBackCallback) {
              navigateBackCallback();
            }
          })
          .catch(function(error) {
            console.error('Error deleting article:', error);
            dhtmlx.alert({
              title: 'Error',
              text: 'No se pudo eliminar el artículo. Por favor, inténtelo de nuevo.'
            });

            if (deleteBtn) {
              deleteBtn.disabled = false;
              deleteBtn.textContent = 'Eliminar';
            }
          });
      }
    });
  }

  /**
   * Shared initialization logic for both create and edit modes
   * Sets up the page layout, renders HTML, attaches events, and initializes the editor
   * @param {Object} layoutCell - DHTMLX Layout Cell to mount the page
   * @param {string} companyCode - Company code
   * @param {string} companyName - Company name for display
   * @param {Function} onNavigateBack - Callback when navigating back
   */
  function initializePage(layoutCell, companyCode, companyName, onNavigateBack) {
    pageState.companyCode = companyCode;
    pageState.companyName = companyName || '';
    pageState.layoutCell = layoutCell;
    pageState.onNavigateBack = onNavigateBack;
    pageState.canUserUpload = true;

    CompanyService.canUsersUpload(companyCode)
      .then(function(canUpload) {
        pageState.canUserUpload = typeof AdminUploadOverride !== 'undefined' || canUpload;
        renderAndAttach();
      })
      .catch(function(error) {
        console.error('Error checking upload permissions:', error);
        renderAndAttach();
      });

    function renderAndAttach() {
      layoutCell.attachHTMLString(renderPageHtml());
      setTimeout(function() {
        attachEventHandlers();
        attachEditorToolbarHandlers();
        initializeEditor();
        updateStagedFilesDisplay();
        updateStagedImagesDisplay();
        updateAttachedFilesDisplay();
        updateAttachedImagesDisplay();
        updateAvailableFilesDisplay();
        updateAvailableImagesDisplay();
        updateMediaCounts();
        loadMediaData();
        if (pageState.editMode) {
          populateFormForEditMode();
        }
      }, 100);
    }
  }

  /**
   * Open the New Article page (Create Mode)
   * @param {Object} layoutCell - DHTMLX Layout Cell to mount the page
   * @param {string} companyCode - Company code for the new article
   * @param {string} companyName - Company name for display
   * @param {Function} onNavigateBack - Callback when navigating back to grid
   */
  function openPage(layoutCell, companyCode, companyName, onNavigateBack) {
    // Check permissions
    if (typeof AdminNewArticlePage === 'undefined') {
      dhtmlx.alert({
        title: 'Acceso denegado',
        text: 'No tienes permiso para crear artículos.'
      });
      return;
    }

    // Reset state for create mode
    pageState.editMode = false;
    pageState.articleId = null;
    pageState.originalArticleData = null;
    pageState.selectedTags = [];
    pageState.allImages = [];
    pageState.allFiles = [];
    pageState.attachedImages = [];
    pageState.attachedFiles = [];
    pageState.imageSearchQuery = '';
    pageState.fileSearchQuery = '';
    pageState.stagedFiles = [];
    pageState.stagedImages = [];
    pageState.isFormDirty = false;

    initializePage(layoutCell, companyCode, companyName, onNavigateBack);
  }

  /**
   * Open the Article page in Edit Mode
   * Loads existing article data into the form and editor
   * @param {Object} layoutCell - DHTMLX Layout Cell to mount the page
   * @param {Object} articleData - The full article object to edit
   * @param {string} companyName - Company name for display
   * @param {Function} onNavigateBack - Callback when navigating back to grid
   */
  function openEditPage(layoutCell, articleData, companyName, onNavigateBack) {
    // Check permissions
    if (typeof AdminEditArticleButton === 'undefined') {
      dhtmlx.alert({
        title: 'Acceso denegado',
        text: 'No tienes permiso para editar artículos.'
      });
      return;
    }

    if (!articleData || !articleData.id) {
      console.error('Invalid article data for edit mode');
      return;
    }

    // Set state for edit mode
    pageState.editMode = true;
    pageState.articleId = articleData.id;
    pageState.originalArticleData = articleData;
    pageState.allImages = [];
    pageState.allFiles = [];
    pageState.attachedImages = [];
    pageState.attachedFiles = [];
    pageState.imageSearchQuery = '';
    pageState.fileSearchQuery = '';
    pageState.stagedFiles = [];
    pageState.stagedImages = [];
    pageState.isFormDirty = false;

    // Pre-populate tags from article data
    pageState.selectedTags = [];
    if (articleData.tags && Array.isArray(articleData.tags)) {
      pageState.selectedTags = articleData.tags.map(function(tag) {
        if (typeof tag === 'string') {
          return { id: tag, name: tag, color: '#666' };
        }
        return tag;
      });
    }

    if (articleData.attachedImages && Array.isArray(articleData.attachedImages)) {
      pageState.attachedImages = articleData.attachedImages.slice();
    }

    if (articleData.attachedFiles && Array.isArray(articleData.attachedFiles)) {
      pageState.attachedFiles = articleData.attachedFiles.slice();
    }

    initializePage(layoutCell, articleData.companyCode, companyName, onNavigateBack);
  }

  /**
   * Close the page and clean up resources
   */
  function closePage() {
    // Destroy Editor.js instance
    destroyEditor();

    // Revoke any object URLs
    pageState.stagedImages.forEach(function(img) {
      if (img.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
      }
    });

    resetPageState();
  }

  /**
   * Check if the page is currently open
   * @returns {boolean} True if page is open
   */
  function isPageOpen() {
    return pageState.layoutCell !== null;
  }

  // Public API
  return {
    openPage: openPage,
    openEditPage: openEditPage,
    closePage: closePage,
    pageState: pageState,
  };
})();
