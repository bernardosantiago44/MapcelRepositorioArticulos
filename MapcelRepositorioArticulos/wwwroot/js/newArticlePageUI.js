/**
 * New Article Page UI Module
 * Provides a dedicated page for creating new articles with a two-column layout
 * Uses HTML + Tailwind CSS within the main DHTMLX Layout Cell
 * 
 * Features:
 * - Breadcrumb navigation with dirty form confirmation
 * - Two-column layout (Core Data | Categorization & Assets)
 * - Tag selection via TagPickerUI
 * - File and image upload with staged file management
 * - Role-based permission checks
 * 
 * Dependencies:
 * - dataModels.js (for status configuration)
 * - articleService.js (for CRUD operations)
 * - ImageService.js (for image operations)
 * - FileService.js (for file operations)
 * - TagPickerUI.js (for tag selection)
 * - CompanyService.js (for role checks)
 * - UserService.js (for user permissions)
 */

var NewArticlePageUI = (function() {
  'use strict';

  // Page state management
  var pageState = {
    companyId: null,
    companyName: '',
    layoutCell: null,
    onNavigateBack: null,
    selectedTags: [],
    stagedFiles: [],         // Files selected for upload (not yet saved)
    stagedImages: [],        // Images selected for upload (not yet saved)
    isFormDirty: false,
    allTags: [],
    canUserUpload: true      // Determined by CompanySettings
  };

  // Constants
  var FORM_FIELDS_INITIAL = {
    title: '',
    description: '',
    status: 'Borrador',
    externalLink: '',
    clientComments: ''
  };

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
    var descriptionInput = document.getElementById('new-article-description');
    var externalLinkInput = document.getElementById('new-article-external-link');
    var clientCommentsInput = document.getElementById('new-article-client-comments');

    var hasTextChanges = (titleInput && titleInput.value.trim() !== '') ||
                         (descriptionInput && descriptionInput.value.trim() !== '') ||
                         (externalLinkInput && externalLinkInput.value.trim() !== '') ||
                         (clientCommentsInput && clientCommentsInput.value.trim() !== '');

    var hasTagChanges = pageState.selectedTags.length > 0;
    var hasFileChanges = pageState.stagedFiles.length > 0 || pageState.stagedImages.length > 0;

    return hasTextChanges || hasTagChanges || hasFileChanges;
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
    pageState.stagedFiles = [];
    pageState.stagedImages = [];
    pageState.isFormDirty = false;
  }

  /**
   * Render the breadcrumb navigation
   * @returns {string} HTML string for breadcrumb
   */
  function renderBreadcrumb() {
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
        <span class="text-gray-600 font-medium">Nuevo Artículo</span>
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
            Enlace Externo
          </label>
          <input 
            type="url" 
            id="new-article-external-link"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder="https://example.com/issue"
          />
        </div>

        <!-- Description Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Descripción <span class="text-red-500">*</span>
          </label>
          <div class="border border-gray-300 rounded-lg overflow-hidden bg-white">
            <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
              <div class="flex gap-1">
                <button type="button" id="new-article-desc-tab-write" class="px-3 py-1 text-sm font-semibold text-gray-900 border-b-2 border-blue-500 bg-white rounded-t">Escribir</button>
                <button type="button" id="new-article-desc-tab-preview" class="px-3 py-1 text-sm font-semibold text-gray-500 hover:text-gray-700">Vista previa</button>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900" data-md-action="heading" title="Encabezado">H</button>
                <button type="button" class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900" data-md-action="bold" title="Negrita">B</button>
                <button type="button" class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900" data-md-action="italic" title="Cursiva">I</button>
                <button type="button" class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900" data-md-action="list" title="Lista">List</button>
                <button type="button" class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900" data-md-action="link" title="Enlace">Link</button>
                <button type="button" class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900" data-md-action="code" title="Código">Code</button>
                <button type="button" class="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900" data-md-action="image" title="Imagen">Image</button>
              </div>
            </div>
            <div class="p-3">
              <textarea 
                id="new-article-description"
                rows="6"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y text-base"
                placeholder="Describe el artículo en detalle (soporta Markdown)"
              ></textarea>
              <div id="new-article-description-preview" class="hidden w-full min-h-[160px] rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed"></div>
            </div>
          </div>
          <div class="mt-2 text-xs text-gray-500">
            Soporta Markdown: **negrita**, _cursiva_, listas, enlaces.
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
        </div>

        <!-- Image Upload Section -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <label class="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Imágenes
            </label>
            <span id="new-article-images-count" class="text-xs text-gray-500">0 imágenes</span>
          </div>
          
          <!-- Image Drop Zone -->
          <div 
            id="new-article-image-dropzone"
            class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${uploadDisabledClass}"
            ${uploadDisabledAttr}
          >
            <svg class="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <p class="text-sm text-gray-600">Arrastra imágenes o haz clic</p>
            <p class="text-xs text-gray-400 mt-1">JPG, PNG, WebP (Max 10MB)</p>
          </div>
          <input type="file" id="new-article-image-input" multiple accept="image/jpeg,image/png,image/webp,image/svg+xml" class="hidden" />
          <!-- Staged Images Grid -->
          <div id="new-article-staged-images" class="mt-3 grid grid-cols-3 gap-2">
            <!-- Images will be listed here -->
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
    return `
      <div class="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3 shadow-lg">
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
          Crear Artículo
        </button>
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

    // Tags container click
    var tagsContainer = document.getElementById('new-article-tags-container');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', openTagPicker);
    }

    // Form input change detection
    var inputs = document.querySelectorAll('#new-article-title, #new-article-description, #new-article-external-link, #new-article-client-comments');
    inputs.forEach(function(input) {
      input.addEventListener('input', markFormDirty);
    });

    // Description markdown tabs
    var writeTab = document.getElementById('new-article-desc-tab-write');
    var previewTab = document.getElementById('new-article-desc-tab-preview');
    if (writeTab) {
      writeTab.addEventListener('click', function() {
        setDescriptionTab('write');
      });
    }
    if (previewTab) {
      previewTab.addEventListener('click', function() {
        setDescriptionTab('preview');
      });
    }

    // Markdown toolbar buttons
    var mdButtons = document.querySelectorAll('[data-md-action]');
    mdButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = btn.getAttribute('data-md-action');
        Utils.applyMarkdownActionToTextArea('new-article-description', action);
        markFormDirty();
      });
    });

    // File upload handlers
    setupFileUploadHandlers();
    setupImageUploadHandlers();
  }

  /**
   * Set description tab (write/preview)
   * @param {string} tab - 'write' or 'preview'
   */
  function setDescriptionTab(tab) {
    var writeTab = document.getElementById('new-article-desc-tab-write');
    var previewTab = document.getElementById('new-article-desc-tab-preview');
    var textarea = document.getElementById('new-article-description');
    var preview = document.getElementById('new-article-description-preview');

    if (!writeTab || !previewTab || !textarea || !preview) return;

    if (tab === 'preview') {
      writeTab.className = 'px-3 py-1 text-sm font-semibold text-gray-500 hover:text-gray-700';
      previewTab.className = 'px-3 py-1 text-sm font-semibold text-gray-900 border-b-2 border-blue-500 bg-white rounded-t';
      textarea.classList.add('hidden');
      preview.classList.remove('hidden');
      updateDescriptionPreview();
    } else {
      writeTab.className = 'px-3 py-1 text-sm font-semibold text-gray-900 border-b-2 border-blue-500 bg-white rounded-t';
      previewTab.className = 'px-3 py-1 text-sm font-semibold text-gray-500 hover:text-gray-700';
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      textarea.focus();
    }
  }

  /**
   * Update description preview with rendered markdown
   */
  function updateDescriptionPreview() {
    var textarea = document.getElementById('new-article-description');
    var preview = document.getElementById('new-article-description-preview');
    if (!textarea || !preview) return;

    var value = textarea.value || '';
    if (!value.trim()) {
      preview.innerHTML = '<em class="text-gray-400">Sin descripción</em>';
      return;
    }

    preview.innerHTML = '<div class="markdown-body">' + Utils.renderMarkdown(value) + '</div>';
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
    var countSpan = document.getElementById('new-article-files-count');
    
    if (!container) return;

    if (countSpan) {
      countSpan.textContent = pageState.stagedFiles.length + ' archivo' + (pageState.stagedFiles.length !== 1 ? 's' : '');
    }

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
    var dropzone = document.getElementById('new-article-image-dropzone');
    var imageInput = document.getElementById('new-article-image-input');

    if (!dropzone || !imageInput || !pageState.canUserUpload) return;

    dropzone.addEventListener('click', function() {
      imageInput.click();
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
      handleImageSelect(e.dataTransfer.files);
    });

    imageInput.addEventListener('change', function(e) {
      handleImageSelect(e.target.files);
      imageInput.value = '';
    });
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
        previewUrl: previewUrl
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
    var countSpan = document.getElementById('new-article-images-count');
    
    if (!container) return;

    if (countSpan) {
      countSpan.textContent = pageState.stagedImages.length + ' imagen' + (pageState.stagedImages.length !== 1 ? 'es' : '');
    }

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

  /**
   * Open tag picker
   */
  function openTagPicker() {
    var selectedIds = pageState.selectedTags.map(function(tag) {
      return tag.id;
    });

    TagPickerUI.openTagPicker(pageState.companyId, selectedIds, function(selectedTags) {
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
   * @returns {boolean} True if valid
   */
  function validateForm() {
    var titleInput = document.getElementById('new-article-title');
    var descriptionInput = document.getElementById('new-article-description');

    var errors = [];

    if (!titleInput || !titleInput.value.trim()) {
      errors.push('El título es obligatorio');
    }

    if (!descriptionInput || !descriptionInput.value.trim()) {
      errors.push('La descripción es obligatoria');
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

  /**
   * Get form data
   * @returns {Object} Form data object
   */
  function getFormData() {
    var titleInput = document.getElementById('new-article-title');
    var statusSelect = document.getElementById('new-article-status');
    var descriptionInput = document.getElementById('new-article-description');
    var externalLinkInput = document.getElementById('new-article-external-link');
    var clientCommentsInput = document.getElementById('new-article-client-comments');

    var tagIds = pageState.selectedTags.map(function(tag) {
      return tag.id;
    });

    return {
      title: titleInput ? titleInput.value.trim() : '',
      description: descriptionInput ? descriptionInput.value.trim() : '',
      status: statusSelect ? statusSelect.value : 'Borrador',
      externalLink: externalLinkInput ? externalLinkInput.value.trim() : '',
      clientComments: clientCommentsInput ? clientCommentsInput.value.trim() : '',
      companyId: pageState.companyId,
      tags: tagIds,
      attachedImages: [],
      attachedFiles: []
    };
  }

  /**
   * Handle form submission
   */
  function handleSubmit() {
    if (!validateForm()) {
      return;
    }

    var submitBtn = document.getElementById('new-article-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando...';
    }

    var formData = getFormData();

    // First, upload any staged files and images
    var uploadPromises = [];

    // Upload staged files
    pageState.stagedFiles.forEach(function(fileData) {
      uploadPromises.push(
        FileService.createFile({
          name: fileData.name,
          size: fileData.size,
          companyId: pageState.companyId,
          file: fileData.file
        }).then(function(response) {
          return { type: 'file', id: response.data.id };
        })
      );
    });

    // Upload staged images
    pageState.stagedImages.forEach(function(imageData) {
      uploadPromises.push(
        ImageService.createImage({
          name: imageData.name,
          size: imageData.size,
          companyId: pageState.companyId,
          file: imageData.file
        }).then(function(response) {
          return { type: 'image', id: response.data.id };
        })
      );
    });

    // Wait for all uploads to complete
    Promise.all(uploadPromises)
      .then(function(uploadResults) {
        // Add uploaded IDs to form data
        uploadResults.forEach(function(result) {
          if (result.type === 'file') {
            formData.attachedFiles.push(result.id);
          } else if (result.type === 'image') {
            formData.attachedImages.push(result.id);
          }
        });

        // Create the article
        return ArticleService.createArticle(formData);
      })
      .then(function(response) {
        if (response.status === 'success') {
          dhtmlx.message({
            text: 'Artículo creado exitosamente',
            type: 'success',
            expire: 3000
          });

          // Reset state and navigate back
          resetPageState();
          if (pageState.onNavigateBack) {
            pageState.onNavigateBack(response.data);
          }
        }
      })
      .catch(function(error) {
        console.error('Error creating article:', error);
        dhtmlx.alert({
          title: 'Error',
          text: 'Error al crear el artículo: ' + error.message
        });

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear Artículo';
        }
      });
  }

  /**
   * Open the New Article page
   * @param {Object} layoutCell - DHTMLX Layout Cell to mount the page
   * @param {string} companyId - Company ID for the new article
   * @param {string} companyName - Company name for display
   * @param {Function} onNavigateBack - Callback when navigating back to grid
   */
  function openPage(layoutCell, companyId, companyName, onNavigateBack) {
    // Check permissions
    if (!UserService.isAdministrator()) {
      dhtmlx.alert({
        title: 'Acceso denegado',
        text: 'No tienes permiso para crear artículos.'
      });
      return;
    }

    // Initialize page state
    pageState.companyId = companyId;
    pageState.companyName = companyName || '';
    pageState.layoutCell = layoutCell;
    pageState.onNavigateBack = onNavigateBack;
    pageState.selectedTags = [];
    pageState.stagedFiles = [];
    pageState.stagedImages = [];
    pageState.isFormDirty = false;
    pageState.canUserUpload = true;

    // Check company settings for upload permissions
    // Note: Administrators can always upload regardless of company settings
    // to ensure they maintain full control over content management
    CompanyService.canUsersUpload(companyId)
      .then(function(canUpload) {
        pageState.canUserUpload = UserService.isAdministrator() || canUpload;
        
        // Render the page
        layoutCell.attachHTMLString(renderPageHtml());

        // Attach event handlers after DOM is ready
        setTimeout(function() {
          attachEventHandlers();
        }, 100);
      })
      .catch(function(error) {
        console.error('Error checking upload permissions:', error);
        // Default to allowing uploads
        layoutCell.attachHTMLString(renderPageHtml());
        setTimeout(function() {
          attachEventHandlers();
        }, 100);
      });
  }

  /**
   * Close the page and clean up resources
   */
  function closePage() {
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
    closePage: closePage,
    isPageOpen: isPageOpen,
    navigateToGrid: navigateToGrid
  };
})();
