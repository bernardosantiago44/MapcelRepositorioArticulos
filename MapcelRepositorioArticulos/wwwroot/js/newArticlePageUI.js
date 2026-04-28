/**
 * New Article Page UI Module
 * Provides a dedicated page for creating and editing articles with a two-column layout
 * Uses HTML + Tailwind CSS within the main DHTMLX Layout Cell
 *
 * Features:
 * - Breadcrumb navigation with dirty form confirmation
 * - Two-column layout (Core Data | Categorization & Assets)
 * - CKEditor 5 rich text editor for article descriptions (outputs HTML)
 * - Tag selection via TagPickerUI
 * - File and image upload with staged file management
 * - Role-based permission checks
 * - Edit mode support with initialData from existing HTML content
 *
 * Dependencies:
 * - dataModels.js (for status configuration)
 * - articleService.js (for CRUD operations)
 * - ImageService.js (for image operations)
 * - FileService.js (for file operations)
 * - TagPickerUI.js (for tag selection)
 * - CompanyService.js (for role checks)
 * - UserService.js (for user permissions)
 * - CKEditor 5 (CDN)
 * - DOMPurify (for HTML sanitization)
 */
const NewArticlePageUI = (function () {
    'use strict';

    // Page state management
    const pageState = {
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
        editorInstance: null,    // CKEditor instance
        editMode: false,         // true when editing an existing article
        articleId: null,         // Article ID when in edit mode
        originalArticleData: null, // Original article data for edit mode
        isCurrentlyUploading: false
    };

    // Constants
    const MAX_EDITOR_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
    const CKEDITOR_SCRIPT_URL = 'https://cdn.ckeditor.com/ckeditor5/47.1.0/ckeditor5.umd.js';
    const CKEDITOR_STYLE_URL = 'https://cdn.ckeditor.com/ckeditor5/47.1.0/ckeditor5.css';

    /**
     * Get status options from articleStatusConfiguration
     * @returns {Array} Array of status options
     */
    function getStatusOptions() {
        if (typeof articleStatusConfiguration !== 'undefined') {
            return Object.keys(articleStatusConfiguration).map(function (key) {
                return {
                    value: key,
                    text: articleStatusConfiguration[key].label,
                    color: articleStatusConfiguration[key].color
                };
            });
        }
        return [
            {value: 'Producción', text: 'Producción', color: '#52c41a'},
            {value: 'Borrador', text: 'Borrador', color: '#1890ff'},
            {value: 'Cerrado', text: 'Cerrado', color: '#8c8c8c'}
        ];
    }

    /**
     * Get today's date formatted for display
     * @returns {string} Formatted date string
     */
    function getTodayFormatted() {
        const today = new Date();
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return today.getDate() + ' ' + months[today.getMonth()] + ' ' + today.getFullYear();
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
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
        const titleInput = document.getElementById('new-article-title');
        const externalLinkInput = document.getElementById('new-article-external-link');
        const clientCommentsInput = document.getElementById('new-article-client-comments');

        const hasTextChanges = (titleInput && titleInput.value.trim() !== '') ||
            (externalLinkInput && externalLinkInput.value.trim() !== '') ||
            (clientCommentsInput && clientCommentsInput.value.trim() !== '');

        const hasTagChanges = pageState.selectedTags.length > 0;
        const hasFileChanges = pageState.stagedFiles.length > 0 || pageState.stagedImages.length > 0;

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
                callback: function (result) {
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
            confirmNavigation(function () {
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
        const breadcrumbLabel = pageState.editMode ? 'Editando Artículo' : 'Nuevo Artículo';
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
        const statusOptions = getStatusOptions();

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
            ${statusOptions.map(function (opt) {
            const selected = opt.value === 'Borrador' ? ' selected' : '';
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

        <!-- Description Field (CKEditor) -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Descripción <span class="text-red-500">*</span>
          </label>
          <div id="new-article-editor-container" class="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col h-[520px] min-h-[420px]">
            <div class="flex-1 overflow-y-auto bg-white" id="new-article-editor-scroll">
              <div id="new-article-ckeditor" class="min-h-[360px] px-4 py-4"></div>
            </div>
          </div>
          <div class="mt-2 text-xs text-gray-500">
            Editor de texto enriquecido: encabezados, listas, tablas e imágenes.
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
        const uploadDisabledClass = pageState.canUserUpload ? '' : 'opacity-50 cursor-not-allowed';
        const uploadDisabledAttr = pageState.canUserUpload ? '' : 'disabled';

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
        const submitLabel = pageState.editMode ? 'Guardar Cambios' : 'Crear Artículo';
        const deleteButtonHtml = pageState.editMode ? `
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
        const breadcrumbLink = document.getElementById('breadcrumb-articles-link');
        if (breadcrumbLink) {
            breadcrumbLink.addEventListener('click', navigateToGrid);
        }

        // Cancel button
        const cancelBtn = document.getElementById('new-article-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', navigateToGrid);
        }

        // Submit button
        const submitBtn = document.getElementById('new-article-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', handleSubmit);
        }

        // Delete button (edit mode only)
        const deleteBtn = document.getElementById('new-article-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', handleDeleteArticle);
        }

        // Tags container click
        const tagsContainer = document.getElementById('new-article-tags-container');
        if (tagsContainer) {
            tagsContainer.addEventListener('click', openTagPicker);
        }

        // Form input change detection (non-editor fields)
        const inputs = document.querySelectorAll('#new-article-title, #new-article-external-link, #new-article-client-comments');
        inputs.forEach(function (input) {
            input.addEventListener('input', markFormDirty);
        });

        // File upload handlers
        setupFileUploadHandlers();
        setupMediaLibraryHandlers();
    }

    // =========================================================================
    // CKEditor 5 Integration
    // =========================================================================

    let ckEditorAssetsPromise = null;

    function ensureCkEditorAssetsLoaded() {
        if (window.CKEDITOR && window.CKEDITOR.ClassicEditor) {
            return Promise.resolve();
        }

        if (ckEditorAssetsPromise) {
            return ckEditorAssetsPromise;
        }

        ckEditorAssetsPromise = new Promise(function (resolve, reject) {
            if (!document.querySelector('link[data-ckeditor-style="true"]')) {
                let styleElement = document.createElement('link');
                styleElement.rel = 'stylesheet';
                styleElement.href = CKEDITOR_STYLE_URL;
                styleElement.setAttribute('data-ckeditor-style', 'true');
                document.head.appendChild(styleElement);
            }

            var existingScriptElement = document.querySelector('script[data-ckeditor-script="true"]');
            if (existingScriptElement) {
                existingScriptElement.addEventListener('load', function () {
                    resolve();
                }, {once: true});
                existingScriptElement.addEventListener('error', function () {
                    reject(new Error('No se pudo cargar CKEditor 5.'));
                }, {once: true});

                return;
            }

            var scriptElement = document.createElement('script');
            scriptElement.src = CKEDITOR_SCRIPT_URL;
            scriptElement.setAttribute('data-ckeditor-script', 'true');
            scriptElement.onload = function () {
                resolve();
            };
            scriptElement.onerror = function () {
                reject(new Error('No se pudo cargar CKEditor 5.'));
            };
            document.head.appendChild(scriptElement);
        }).catch(function (error) {
            ckEditorAssetsPromise = null;
            throw error;
        });

        return ckEditorAssetsPromise;
    }

    function createCkEditorUploadAdapter(loader) {
        return {
            upload: function () {
                return loader.file
                    .then(function (file) {
                        return imageUploadProcess(file);
                    })
                    .then(function (result) {
                        if (!result || !result.file || !result.file.url) {
                            throw new Error('No se pudo subir la imagen seleccionada.');
                        }
                        loader.backendId = result.file.id;

                        return {default: result.file.url};
                    });
            },
            abort: function () {
                // Uploads are staged locally; there is no in-flight request to cancel at this point.
            }
        };
    }

    /**
     * Initialize the CKEditor 5 instance
     * Must be called after the DOM container #new-article-ckeditor is rendered
     */
    function initializeEditor() {
        if (pageState.editorInstance) {
            pageState.editorInstance.destroy();
            pageState.editorInstance = null;
        }

        const editorHolder = document.getElementById('new-article-ckeditor');
        if (!editorHolder) {
            console.error('CKEditor holder element not found');
            return Promise.resolve();
        }

        const initialDescriptionHtml = pageState.editMode && pageState.originalArticleData && pageState.originalArticleData.description
            ? sanitizeEditorHtml(pageState.originalArticleData.description)
            : '';

        return ensureCkEditorAssetsLoaded()
            .then(function () {
                if (!window.CKEDITOR || !window.CKEDITOR.ClassicEditor) {
                    throw new Error('CKEditor 5 no está disponible después de cargar los assets.');
                }

                const {
                    ClassicEditor,
                    Autosave,
                    Essentials,
                    Paragraph,
                    LinkImage,
                    Link,
                    ImageBlock,
                    ImageToolbar,
                    BlockQuote,
                    Bold,
                    ImageInsertViaUrl,
                    AutoImage,
                    Table,
                    TableToolbar,
                    Heading,
                    ImageTextAlternative,
                    ImageCaption,
                    ImageStyle,
                    Indent,
                    IndentBlock,
                    ImageInline,
                    Italic,
                    List,
                    TableCaption,
                    TodoList,
                    Underline,
                    ShowBlocks,
                    Code,
                    Highlight,
                    ImageUpload,
                    CloudServices,
                    BalloonToolbar
                } = window.CKEDITOR;
                const LICENSE_KEY =
                    'eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE4MDc2NjA3OTksImp0aSI6ImE1YjA3MTdlLTc4NDItNGZjZi04M2YxLTQ1OTUyOWQ4MDkxNiIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiXSwiZmVhdHVyZXMiOlsiRFJVUCIsIkUyUCIsIkUyVyJdLCJyZW1vdmVGZWF0dXJlcyI6WyJQQiIsIlJGIiwiU0NIIiwiVENQIiwiVEwiLCJUQ1IiLCJJUiIsIlNVQSIsIkI2NEEiLCJMUCIsIkhFIiwiUkVEIiwiUEZPIiwiV0MiLCJGQVIiLCJCS00iLCJGUEgiLCJNUkUiXSwidmMiOiI1ZjI4YzAzMiJ9.W2RJI7OfEh8GMiXn2-HTyi3FAF-skSjxYzCVPiqVoXfARsfKjfL5G5ICvQnF6hKJjit1MpWJ6yh6UnGDU1WjeQ';

                const editorConfig = {
                    attachTo: document.querySelector('#new-article-ckeditor'),
                    root: {
                        placeholder: 'Escribe una descripción detallada aquí.',
                        initialData: initialDescriptionHtml
                    },
                    toolbar: {
                        items: [
                            'undo',
                            'redo',
                            '|',
                            'showBlocks',
                            '|',
                            'heading',
                            '|',
                            'bold',
                            'italic',
                            'underline',
                            'code',
                            '|',
                            'link',
                            'insertTable',
                            'highlight',
                            'blockQuote',
                            '|',
                            'bulletedList',
                            'numberedList',
                            'todoList',
                            'outdent',
                            'indent'
                        ],
                        shouldNotGroupWhenFull: false
                    },
                    plugins: [
                        AutoImage,
                        Autosave,
                        BalloonToolbar,
                        BlockQuote,
                        Bold,
                        CloudServices,
                        Code,
                        Essentials,
                        Heading,
                        Highlight,
                        ImageBlock,
                        ImageCaption,
                        ImageInline,
                        ImageInsertViaUrl,
                        ImageStyle,
                        ImageTextAlternative,
                        ImageToolbar,
                        ImageUpload,
                        Indent,
                        IndentBlock,
                        Italic,
                        Link,
                        LinkImage,
                        List,
                        Paragraph,
                        ShowBlocks,
                        Table,
                        TableCaption,
                        TableToolbar,
                        TodoList,
                        Underline
                    ],
                    // extraPlugins: [ImageBackendIdPlugin],
                    licenseKey: LICENSE_KEY,
                    balloonToolbar: ['bold', 'italic', '|', 'link', '|', 'bulletedList', 'numberedList'],
                    heading: {
                        options: [
                            {
                                model: 'paragraph',
                                title: 'Paragraph',
                                class: 'ck-heading_paragraph'
                            },
                            {
                                model: 'heading1',
                                view: 'h1',
                                title: 'Heading 1',
                                class: 'ck-heading_heading1'
                            },
                            {
                                model: 'heading2',
                                view: 'h2',
                                title: 'Heading 2',
                                class: 'ck-heading_heading2'
                            },
                            {
                                model: 'heading3',
                                view: 'h3',
                                title: 'Heading 3',
                                class: 'ck-heading_heading3'
                            },
                            {
                                model: 'heading4',
                                view: 'h4',
                                title: 'Heading 4',
                                class: 'ck-heading_heading4'
                            },
                            {
                                model: 'heading5',
                                view: 'h5',
                                title: 'Heading 5',
                                class: 'ck-heading_heading5'
                            },
                            {
                                model: 'heading6',
                                view: 'h6',
                                title: 'Heading 6',
                                class: 'ck-heading_heading6'
                            }
                        ]
                    },
                    image: {
                        toolbar: ['toggleImageCaption', 'imageTextAlternative', '|', 'imageStyle:inline', 'imageStyle:wrapText', 'imageStyle:breakText']
                    },
                    language: 'es',
                    link: {
                        addTargetToExternalLinks: true,
                        defaultProtocol: 'https://',
                        decorators: {
                            toggleDownloadable: {
                                mode: 'manual',
                                label: 'Downloadable',
                                attributes: {
                                    download: 'file'
                                }
                            }
                        }
                    },
                    table: {
                        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
                    }
                };

                return ClassicEditor.create(editorConfig);
            })
            .then(function (editorInstance) {
                pageState.editorInstance = editorInstance;

                editorInstance.plugins.get('FileRepository').createUploadAdapter = function (loader) {
                    return createCkEditorUploadAdapter(loader);
                };

                editorInstance.model.document.on('change:data', function () {
                    markFormDirty();
                });
            })
            .catch(function (error) {
                console.error('Error initializing CKEditor:', error);
            });
    }

    function getImageDimensions(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const dimensions = {width: img.width, height: img.height};
                URL.revokeObjectURL(img.src);
                resolve(dimensions);
            };
            // Handle potential load errors
            img.onerror = () => resolve({width: 0, height: 0});
        });
    }

    function imageUploadProcess(file) {
        return getImageDimensions(file).then(function (dimensions) {
            return promptAndInsertEditorImage(file, dimensions);
        }).catch(function () {
            return {success: 0, file: ''}
        });
    }

    /**
     * Prompt for metadata and upload before inserting into CKEditor
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
            clientTempId: createTempUploadId('staged-image'),
            dimensions: dimensions ? dimensions : {},
        };

        return ImageMetadataEditorUI.promptForFileMetadata(file, defaultMetadata)
            // Load image preview
            .then(function (metadata) {
                if (!metadata) {
                    dhtmlx.message({type: 'info', text: 'Carga de imagen cancelada'});
                    return null;
                }

                return uploadEditorImageByFile(file, metadata)
                    .then(function (result) {
                        if (!result || !result.file || !result.file.url || !pageState.editorInstance) return null;
                        markFormDirty();
                        return result;
                    });
            })
            .catch(function (error) {
                console.error('Error al subir imagen arrastrada:', error);
                dhtmlx.message({
                    type: 'error',
                    text: error && error.message ? error.message : 'No se pudo subir la imagen arrastrada.'
                });
                return null;
            }).finally(function () {
                pageState.isCurrentlyUploading = false;
            });
    }

    function insertImageIntoEditor(imageUrl) {
        if (!pageState.editorInstance || !imageUrl) return;

        try {
            // Use imageBlock to create a standalone <figure><img/></figure> node in CKEditor output.
            pageState.editorInstance.model.change(function (writer) {
                const imageElement = writer.createElement('imageBlock', {
                    src: imageUrl
                });

                pageState.editorInstance.model.insertContent(
                    imageElement,
                    pageState.editorInstance.model.document.selection
                );

                writer.setSelection(imageElement, 'after');
            });
        } catch (error) {
            console.error('No se pudo insertar la imagen en el editor:', error);
            dhtmlx.message({
                type: 'error',
                text: 'No se pudo insertar la imagen en la descripción.'
            });
            return;
        }

        if (pageState.editorInstance && pageState.editorInstance.editing && pageState.editorInstance.editing.view) {
            pageState.editorInstance.editing.view.focus();
        }
        markFormDirty();
    }

    /**
     * Upload an image file to staged uploads for CKEditor image output
     * @param {File} file - Local file selected in CKEditor
     * @param {{description: string, desiredFileName: string}} metadata
     * @returns {Promise<{success: number, file: {url: string, id: string|number}}>}
     */
    function uploadEditorImageByFile(file, metadata) {
        if (!file) {
            const emptyFileError = new Error('No se seleccionó ningún archivo de imagen.');
            dhtmlx.message({ type: 'error', text: emptyFileError.message });
            return Promise.reject(emptyFileError);
        }

        if (!pageState.canUserUpload) {
            const permissionError = new Error('No tienes permisos para subir imágenes.');
            dhtmlx.message({ type: 'error', text: permissionError.message });
            return Promise.reject(permissionError);
        }

        if (!file.type || file.type.indexOf('image/') !== 0) {
            const typeError = new Error('El archivo "' + file.name + '" no es una imagen válida.');
            dhtmlx.message({ type: 'error', text: typeError.message });
            return Promise.reject(typeError);
        }

        if (file.size > MAX_EDITOR_IMAGE_UPLOAD_SIZE) {
            const sizeError = new Error('La imagen "' + file.name + '" excede el límite de 10MB.');
            dhtmlx.message({ type: 'error', text: sizeError.message });
            return Promise.reject(sizeError);
        }

        const descriptionValue = metadata && metadata.description ? metadata.description.trim() : '';
        const desiredFileName = metadata && metadata.desiredFileName ? metadata.desiredFileName.trim() : '';
        const clientTempId = metadata && metadata.clientTempId
            ? String(metadata.clientTempId)
            : createTempUploadId('staged-image');
        const stagedFile = renameBrowserFile(file, desiredFileName);
        const previewUrl = URL.createObjectURL(stagedFile);

        pageState.stagedImages = pageState.stagedImages || [];
        pageState.stagedImages.push({
            id: clientTempId,
            file: stagedFile,
            name: stagedFile.name,
            size: stagedFile.size,
            description: descriptionValue,
            previewUrl: previewUrl
        });

        markFormDirty();

        return Promise.resolve({
            success: 1,
            file: {
                url: previewUrl,
                id: clientTempId,
            }
        });
    }

    /**
     * Destroy the CKEditor instance and clean up
     */
    function destroyEditor() {
        if (pageState.editorInstance) {
            pageState.editorInstance.destroy();
            pageState.editorInstance = null;
        }
    }

    var EDITOR_HTML_SANITIZE_CONFIG = {
        USE_PROFILES: {html: true},
        ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img'],
        ADD_ATTR: ['colspan', 'rowspan', 'src', 'alt', 'title', 'style', 'class', 'width', 'height']
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

    }

    /**
     * Setup file upload handlers
     */
    function setupFileUploadHandlers() {
        var dropzone = document.getElementById('new-article-file-dropzone');
        var fileInput = document.getElementById('new-article-file-input');

        if (!dropzone || !fileInput || !pageState.canUserUpload) return;

        dropzone.addEventListener('click', function () {
            fileInput.click();
        });

        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropzone.classList.add('border-blue-500', 'bg-blue-50');
        });

        dropzone.addEventListener('dragleave', function () {
            dropzone.classList.remove('border-blue-500', 'bg-blue-50');
        });

        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropzone.classList.remove('border-blue-500', 'bg-blue-50');
            handleFileSelect(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', function (e) {
            handleFileSelect(e.target.files);
            fileInput.value = ''; // Reset to allow re-selecting same file
        });
    }

    /**
     * Handle file selection
     * @param {FileList} files - Selected files
     */
    function handleFileSelect(files) {
        const maxSize = 50 * 1024 * 1024;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.size > maxSize) {
                dhtmlx.message({
                    type: 'error',
                    text: 'El archivo "' + file.name + '" excede el límite de 50MB'
                });
                continue;
            }

            pageState.stagedFiles.push({
                id: createTempUploadId('staged-file'),
                file: file,
                name: file.name,
                size: file.size,
                description: ''
            });
        }

        updateStagedFilesDisplay();
        markFormDirty();
    }

    function createTempUploadId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return prefix + '-' + window.crypto.randomUUID();
        }

        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    }

    function ensureFileNameHasExtension(fileName, originalFileName) {
        if (!fileName) return originalFileName;

        var trimmed = fileName.trim();
        if (!trimmed) return originalFileName;

        var originalExtension = '';
        var dotIndex = originalFileName.lastIndexOf('.');
        if (dotIndex >= 0) {
            originalExtension = originalFileName.substring(dotIndex);
        }

        if (originalExtension && trimmed.toLowerCase().lastIndexOf(originalExtension.toLowerCase()) !== trimmed.length - originalExtension.length) {
            return trimmed + originalExtension;
        }

        return trimmed;
    }

    function renameBrowserFile(file, desiredFileName) {
        if (!desiredFileName || desiredFileName === file.name) return file;

        var finalName = ensureFileNameHasExtension(desiredFileName, file.name);

        try {
            return new File(
                [file],
                finalName,
                {
                    type: file.type,
                    lastModified: file.lastModified
                }
            );
        } catch (error) {
            console.warn('Could not rename File object, using original file name.', error);
            return file;
        }
    }

    function normalizeStagedEditorImageUrls(html) {
        if (!html || !pageState.stagedImages || !pageState.stagedImages.length) {
            return html;
        }

        var normalized = html;

        pageState.stagedImages.forEach(function (image) {
            if (!image.previewUrl || !image.id) return;

            var escapedPreviewUrl = image.previewUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var tempUrl = 'mapcel-image:' + image.id;

            normalized = normalized.replace(
                new RegExp(escapedPreviewUrl, 'g'),
                tempUrl
            );
        });

        return normalized;
    }

    /**
     * Update staged files display
     */
    function updateStagedFilesDisplay() {
        const container = document.getElementById('new-article-staged-files');

        if (!container) return;

        updateMediaCounts();

        if (pageState.stagedFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = pageState.stagedFiles.map(function (fileData) {
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
        container.querySelectorAll('.remove-staged-file').forEach(function (btn) {
            btn.addEventListener('click', function () {
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
        pageState.stagedFiles = pageState.stagedFiles.filter(function (f) {
            return f.id !== fileId;
        });
        updateStagedFilesDisplay();
    }
    /**
     * Setup handlers for the media library search inputs
     */
    function setupMediaLibraryHandlers() {
        var fileSearchInput = document.getElementById('new-article-file-search');
        if (fileSearchInput) {
            fileSearchInput.value = pageState.fileSearchQuery || '';
            fileSearchInput.addEventListener('input', function (e) {
                pageState.fileSearchQuery = e.target.value || '';
                updateAvailableFilesDisplay();
            });
        }

        var imageSearchInput = document.getElementById('new-article-image-search');
        if (imageSearchInput) {
            imageSearchInput.value = pageState.imageSearchQuery || '';
            imageSearchInput.addEventListener('input', function (e) {
                pageState.imageSearchQuery = e.target.value || '';
                updateAvailableImagesDisplay();
            });
        }
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

        container.innerHTML = pageState.stagedImages.map(function (imageData) {
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
        container.querySelectorAll('.remove-staged-image').forEach(function (btn) {
            btn.addEventListener('click', function () {
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
        var image = pageState.stagedImages.find(function (img) {
            return img.id === imageId;
        });

        if (image && image.previewUrl) {
            URL.revokeObjectURL(image.previewUrl);
        }

        pageState.stagedImages = pageState.stagedImages.filter(function (img) {
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

    function getIdValue(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object' && value.id !== null && value.id !== undefined) {
            return String(value.id).trim();
        }
        return String(value).trim();
    }

    function normalizeId(value) {
        return getIdValue(value).toLowerCase();
    }

    function idsMatch(left, right) {
        var leftId = normalizeId(left);
        var rightId = normalizeId(right);
        return leftId !== '' && leftId === rightId;
    }

    function toUniqueIdArray(values) {
        if (!Array.isArray(values) || values.length === 0) return [];

        var normalizedSet = new Set();
        var normalizedValues = [];

        values.forEach(function (value) {
            var rawId = getIdValue(value);
            var normalizedId = normalizeId(value);
            if (!normalizedId || normalizedSet.has(normalizedId)) return;

            normalizedSet.add(normalizedId);
            normalizedValues.push(rawId);
        });

        return normalizedValues;
    }

    function mergeMediaById(existingItems, incomingItems) {
        var mergedItems = Array.isArray(existingItems) ? existingItems.slice() : [];
        if (!Array.isArray(incomingItems) || incomingItems.length === 0) return mergedItems;

        var existingIdSet = new Set(mergedItems.map(function (item) {
            return normalizeId(item && item.id);
        }));

        incomingItems.forEach(function (item) {
            if (!item || item.id === null || item.id === undefined) return;

            var normalizedId = normalizeId(item.id);
            if (!normalizedId || existingIdSet.has(normalizedId)) return;

            existingIdSet.add(normalizedId);
            mergedItems.push(item);
        });

        return mergedItems;
    }

    /**
     * Find index of an ID in a list using normalized matching
     * @param {Array} list - Array of IDs
     * @param {string|number} id - ID to find
     * @returns {number} Index or -1
     */
    function findIdIndex(list, id) {
        var targetId = normalizeId(id);
        if (!targetId || !Array.isArray(list)) return -1;

        return list.findIndex(function (item) {
            return normalizeId(item) === targetId;
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
        const KB_IN_BYTES = 1024;
        const MB_IN_BYTES = KB_IN_BYTES * 1024;
        const GB_IN_BYTES = MB_IN_BYTES * 1024;

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
     * Resolve fileIds from original article data into attached media lists
     */
    function resolveFileIdsFromArticleData() {
        if (!pageState.originalArticleData || !pageState.originalArticleData.fileIds) return;

        const fileIds = pageState.originalArticleData.fileIds;
        if (!Array.isArray(fileIds) || fileIds.length === 0) return;

        const imageIdSet = new Set(pageState.allImages.map(function (img) {
            return normalizeId(img.id);
        }));
        const fileIdSet = new Set(pageState.allFiles.map(function (file) {
            return normalizeId(file.id);
        }));

        fileIds.forEach(function (id) {
            const normalizedId = normalizeId(id);
            if (!normalizedId) return;

            if (imageIdSet.has(normalizedId) && findIdIndex(pageState.attachedImages, normalizedId) === -1) {
                pageState.attachedImages.push(getIdValue(id));
            } else if (fileIdSet.has(normalizedId) && findIdIndex(pageState.attachedFiles, normalizedId) === -1) {
                pageState.attachedFiles.push(getIdValue(id));
            }
        });
    }

    /**
     * Load media library data for the company
     */
    function loadMediaData() {
        if (!pageState.companyCode) return;

        ImageService.getImages(pageState.companyCode)
            .then(function (images) {
                pageState.allImages = mergeMediaById(pageState.allImages, images || []);
                resolveFileIdsFromArticleData();
                updateAvailableImagesDisplay();
                updateAttachedImagesDisplay();
                updateMediaCounts();
            })
            .catch(function (error) {
                if (error.status === 404) return;
                console.error('Error loading images:', error);
                dhtmlx.message({
                    type: 'error',
                    text: 'No se pudieron cargar las imágenes disponibles'
                });
            });

        FileService.getFiles(pageState.companyCode)
            .then(function (files) {
                pageState.allFiles = mergeMediaById(pageState.allFiles, files || []);
                resolveFileIdsFromArticleData();
                updateAvailableFilesDisplay();
                updateAttachedFilesDisplay();
                updateMediaCounts();
            })
            .catch(function (error) {
                if (error.status === 404) return;
                console.error('Error loading files:', error);
                dhtmlx.message({
                    type: 'error',
                    text: 'No se pudieron cargar los archivos disponibles'
                });
            });

        if (!pageState.editMode || !pageState.articleId) return;

        var articleId = getIdValue(pageState.articleId);
        if (!articleId) return;

        var imagesByArticlePromise = typeof ImageService !== 'undefined' && typeof ImageService.getImagesByArticle === 'function'
            ? ImageService.getImagesByArticle(articleId)
            : Promise.resolve([]);

        var filesByArticlePromise = typeof FileService !== 'undefined' && typeof FileService.getFilesByArticle === 'function'
            ? FileService.getFilesByArticle(articleId, false)
            : Promise.resolve([]);

        Promise.all([imagesByArticlePromise, filesByArticlePromise])
            .then(function (results) {
                var articleImages = Array.isArray(results[0]) ? results[0] : [];
                var articleFiles = Array.isArray(results[1]) ? results[1] : [];

                pageState.allImages = mergeMediaById(pageState.allImages, articleImages);
                pageState.allFiles = mergeMediaById(pageState.allFiles, articleFiles);
                pageState.attachedImages = toUniqueIdArray(
                    pageState.attachedImages.concat(articleImages.map(function (img) {
                        return img.id;
                    }))
                );
                pageState.attachedFiles = toUniqueIdArray(
                    pageState.attachedFiles.concat(articleFiles.map(function (file) {
                        return file.id;
                    }))
                );

                resolveFileIdsFromArticleData();
                updateAvailableImagesDisplay();
                updateAttachedImagesDisplay();
                updateAvailableFilesDisplay();
                updateAttachedFilesDisplay();
                updateMediaCounts();
            })
            .catch(function (error) {
                console.error('Error loading attached media:', error);
            });
    }

    /**
     * Update the available images list (company library)
     */
    function updateAvailableImagesDisplay() {
        const container = document.getElementById('new-article-available-images');
        if (!container) return;

        let filteredImages = pageState.allImages.slice();

        if (pageState.imageSearchQuery) {
            const query = pageState.imageSearchQuery.toLowerCase();
            filteredImages = filteredImages.filter(function (img) {
                return (img.name && img.name.toLowerCase().includes(query)) ||
                    (img.description && img.description.toLowerCase().includes(query));
            });
        }

        filteredImages = filteredImages.filter(function (img) {
            return findIdIndex(pageState.attachedImages, img.id) === -1;
        });

        if (filteredImages.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No hay imágenes disponibles</div>';
            return;
        }

        container.innerHTML = filteredImages.map(function (img) {
            return renderAvailableImageItem(img);
        }).join('');

        container.querySelectorAll('[data-attach-image-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const imageId = btn.getAttribute('data-attach-image-id');
                attachImage(imageId);
            });
        });

        container.querySelectorAll('[data-copy-image-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const imageUrl = btn.getAttribute('data-copy-image-id');
                const imageId = btn.getAttribute('data-image-id');
                attachImage(imageId);
                insertImageIntoEditor(imageUrl);
            });
        });
    }

    /**
     * Render an available image row
     * @param {Object} img - Image object
     * @returns {string} HTML string
     */
    function renderAvailableImageItem(img) {
        const thumbnailUrl = img.thumbnailUrl || img.url;
        const dimensionsLabel = img.dimensions ? escapeHtml(img.dimensions) : '—';
        const sizeLabel = img.size ? escapeHtml(img.size) : '—';

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
          data-copy-image-id="${thumbnailUrl}"
          data-image-id="${escapeHtml(img.id)}"
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
        const container = document.getElementById('new-article-available-files');
        if (!container) return;

        let filteredFiles = pageState.allFiles.slice();

        if (pageState.fileSearchQuery) {
            const query = pageState.fileSearchQuery.toLowerCase();
            filteredFiles = filteredFiles.filter(function (file) {
                return (file.name && file.name.toLowerCase().includes(query)) ||
                    (file.description && file.description.toLowerCase().includes(query));
            });
        }

        filteredFiles = filteredFiles.filter(function (file) {
            return findIdIndex(pageState.attachedFiles, file.id) === -1;
        });

        if (filteredFiles.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No hay archivos disponibles</div>';
            return;
        }

        container.innerHTML = filteredFiles.map(function (file) {
            return renderAvailableFileItem(file);
        }).join('');

        container.querySelectorAll('[data-attach-file-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
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
        const container = document.getElementById('new-article-attached-images');
        if (!container) return;

        if (pageState.attachedImages.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-400"></div>';
            return;
        }

        const attachedImageObjects = pageState.attachedImages.map(function (id) {
            return pageState.allImages.find(function (img) {
                return idsMatch(img.id, id);
            });
        }).filter(function (img) {
            return img;
        });

        if (attachedImageObjects.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-400">Imágenes adjuntas no disponibles</div>';
            return;
        }

        container.innerHTML = attachedImageObjects.map(function (img) {
            const thumbnailUrl = img.thumbnailUrl || img.url || '';
            const dimensionsLabel = img.dimensions ? escapeHtml(img.dimensions) : '—';
            const sizeLabel = img.size ? escapeHtml(img.size) : '—';

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
            data-copy-image-id="${escapeHtmlAttribute(thumbnailUrl)}"
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

        container.querySelectorAll('[data-detach-image-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const imageId = btn.getAttribute('data-detach-image-id');
                detachImage(imageId);
            });
        });

        container.querySelectorAll('[data-copy-image-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const imageUrl = btn.getAttribute('data-copy-image-id');
                insertImageIntoEditor(imageUrl);
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

        var attachedFileObjects = pageState.attachedFiles.map(function (id) {
            return pageState.allFiles.find(function (file) {
                return idsMatch(file.id, id);
            });
        }).filter(function (file) {
            return file;
        });

        if (attachedFileObjects.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-400">Archivos adjuntos no disponibles</div>';
            return;
        }

        container.innerHTML = attachedFileObjects.map(function (file) {
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

        container.querySelectorAll('[data-detach-file-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var fileId = btn.getAttribute('data-detach-file-id');
                detachFile(fileId);
            });
        });
    }

    /**
     * Open tag picker
     */
    function openTagPicker() {
        var selectedIds = pageState.selectedTags.map(function (tag) {
            return tag.id;
        });

        TagPickerUI.openTagPicker(pageState.companyCode, selectedIds, function (selectedTags) {
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

        container.innerHTML = pageState.selectedTags.map(function (tag) {
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
        if (linkContent.trim().length === 0) {
            return true
        }

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
        const titleInput = document.getElementById('new-article-title');
        const statusSelect = document.getElementById('new-article-status');
        const externalLinkInput = document.getElementById('new-article-external-link');
        const clientCommentsInput = document.getElementById('new-article-client-comments');

        const tagIds = pageState.selectedTags.map(function (tag) {
            return String(tag.id);
        });

        const fileIds = pageState.attachedImages
            .slice()
            .concat(pageState.attachedFiles.slice())
            .map(function (id) { return String(id); });

        return {
            title: titleInput ? titleInput.value.trim() : '',
            descriptionHtml: descriptionHtml,
            status: statusSelect ? statusSelect.value : 'Borrador',
            externalLink: externalLinkInput ? externalLinkInput.value.trim() : '',
            clientComments: clientCommentsInput ? clientCommentsInput.value.trim() : '',
            companyCode: pageState.companyCode,
            tagIds: tagIds,
            fileIds: fileIds
        };
    }
    function appendStringArray(formData, fieldName, values) {
        if (!Array.isArray(values) || values.length === 0) return;
        values.forEach(function (value) {
            formData.append(fieldName, String(value));
        });
    }

    function appendStagedUploadsToMultipart(formData) {
        const filesManifest = [];
        (pageState.stagedFiles || []).forEach(function (f) {
            formData.append('Files', f.file);
            filesManifest.push({
                ClientTempId: f.id,
                Description: f.description || ''
            });
        });
        formData.append('FilesManifestJson', JSON.stringify(filesManifest));

        const imagesManifest = [];
        (pageState.stagedImages || []).forEach(function (img) {
            formData.append('Images', img.file);
            imagesManifest.push({
                ClientTempId: img.id,
                Description: img.description || ''
            });
        });
        formData.append('ImagesManifestJson', JSON.stringify(imagesManifest));
    }

    function buildCreateArticleMultipartData(values) {
        const formData = new FormData();

        formData.append('Title', values.title);
        formData.append('DescriptionHtml', values.descriptionHtml);
        formData.append('Status', values.status);

        if (values.externalLink) {
            formData.append('ExternalLink', values.externalLink);
        }

        if (values.clientComments) {
            formData.append('ClientComments', values.clientComments);
        }

        if (values.tagIds && values.tagIds.length) {
            values.tagIds.forEach(function (tagId) {
                formData.append('TagIds', tagId);
            });
        }

        appendStringArray(formData, 'FileIds', values.fileIds || []);

        const filesManifest = [];
        (pageState.stagedFiles || []).forEach(function (f) {
            formData.append('Files', f.file);
            filesManifest.push({
                ClientTempId: f.id,
                Description: f.description || ''
            });
        });
        formData.append('FilesManifestJson', JSON.stringify(filesManifest));

        const imagesManifest = [];
        (pageState.stagedImages || []).forEach(function (img) {
            formData.append('Images', img.file);
            imagesManifest.push({
                ClientTempId: img.id,
                Description: img.description || ''
            });
        });
        formData.append('ImagesManifestJson', JSON.stringify(imagesManifest));

        return formData;
    }

    function buildUpdateArticleMultipartData(formDataValues) {
        const multipartData = new FormData();
        const originalArticle = pageState.originalArticleData || {};

        const originalFileIds = toUniqueIdArray(originalArticle.fileIds || []);
        const currentFileIds = toUniqueIdArray(formDataValues.fileIds || []);

        const originalLookup = new Map(originalFileIds.map(function (id) {
            return [normalizeId(id), id];
        }));

        const currentLookup = new Map(currentFileIds.map(function (id) {
            return [normalizeId(id), id];
        }));

        const addedExistingFileIds = Array.from(currentLookup.keys())
            .filter(function (normalizedId) {
                return !originalLookup.has(normalizedId);
            })
            .map(function (normalizedId) {
                return currentLookup.get(normalizedId);
            });

        const removedFiles = Array.from(originalLookup.keys())
            .filter(function (normalizedId) {
                return !currentLookup.has(normalizedId);
            })
            .map(function (normalizedId) {
                return originalLookup.get(normalizedId);
            });

        multipartData.append('Title', formDataValues.title);
        multipartData.append('DescriptionHtml', formDataValues.descriptionHtml);
        multipartData.append('Status', formDataValues.status);
        multipartData.append('ExternalLink', formDataValues.externalLink || '');
        multipartData.append('ClientComments', formDataValues.clientComments || '');

        appendStringArray(multipartData, 'TagIds', formDataValues.tagIds || []);
        appendStringArray(multipartData, 'FileIds', addedExistingFileIds);
        appendStringArray(multipartData, 'RemovedFiles', removedFiles);

        appendStagedUploadsToMultipart(multipartData);

        return multipartData;
    }

    /**
     * Handle form submission (create or edit)
     * Saves editor content as HTML and sends to the backend API
     */
    function handleSubmit() {
        const submitBtn = document.getElementById('new-article-submit-btn');

        if (!pageState.editorInstance) {
            console.error('Editor not initialized');
            return;
        }

        // Save editor content as HTML string
        return Promise.resolve()
            .then(function () {
                let descriptionHtml = (pageState.editorInstance.getData());
                descriptionHtml = normalizeStagedEditorImageUrls(descriptionHtml);

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

                const formDataValues = getFormData(descriptionHtml);
                const multipartPayload = pageState.editMode
                    ? buildUpdateArticleMultipartData(formDataValues)
                    : buildCreateArticleMultipartData(formDataValues);

                if (pageState.editMode) {
                    return ArticleService.updateArticle(pageState.articleId, multipartPayload, pageState.companyCode);
                }
                return ArticleService.createArticle(multipartPayload, pageState.companyCode);
            })
            .then(function (response) {
                if (response && response.status === 'success') {
                    const actionLabel = pageState.editMode ? 'actualizado' : 'creado';
                    dhtmlx.message({
                        text: 'Artículo ' + actionLabel + ' exitosamente',
                        type: 'success',
                        expire: 3000
                    });

                    const savedData = response.data;
                    const navigateBackCallback = pageState.onNavigateBack;
                    resetPageState();
                    if (navigateBackCallback) {
                        navigateBackCallback(savedData);
                    }
                }
            })
            .catch(function (error) {
                if (error.status)
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
    }

    /**
     * Handle delete article action with confirmation
     */
    function handleDeleteArticle() {
        if (!pageState.editMode || !pageState.articleId || !pageState.companyCode) return;

        const deleteBtn = document.getElementById('new-article-delete-btn');
        const articleId = pageState.articleId;
        const companyCode = pageState.companyCode;

        dhtmlx.confirm({
            title: 'Confirmar eliminación',
            text: '¿Estás seguro de que deseas eliminar este artículo? Esto eliminará cualquier imagen o archivo subido durante su creación. Esta acción no se puede deshacer.',
            callback: function (result) {
                if (!result) return;

                if (deleteBtn) {
                    deleteBtn.disabled = true;
                    deleteBtn.textContent = 'Eliminando...';
                }

                fetch(`${API_BASE_URL}/articles/${encodeURIComponent(companyCode)}/${encodeURIComponent(articleId)}`, {
                    method: 'DELETE'
                })
                    .then(function (response) {
                        if (response.status === 409) {
                            dhtmlx.alert({
                                title: 'No se puede eliminar este artículo.',
                                text: 'Este artículo contiene uno o más archivos referenciados en otro(s) artículo(s).'
                            });
                            return;
                        }
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
                    .catch(function (error) {
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
            .then(function (canUpload) {
                pageState.canUserUpload = typeof AdminUploadOverride !== 'undefined' || canUpload;
                renderAndAttach();
            })
            .catch(function (error) {
                console.error('Error checking upload permissions:', error);
                renderAndAttach();
            });

        function renderAndAttach() {
            layoutCell.attachHTMLString(renderPageHtml());
            setTimeout(function () {
                attachEventHandlers();
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
        resetPageState();
        pageState.editMode = true;
        pageState.articleId = articleData.id;
        pageState.originalArticleData = articleData;

        // Pre-populate tags from article data
        pageState.selectedTags = [];
        if (articleData.tags && Array.isArray(articleData.tags)) {
            pageState.selectedTags = articleData.tags.map(function (tag) {
                if (typeof tag === 'string') {
                    return {id: tag, name: tag, color: '#666'};
                }
                return tag;
            });
        }

        pageState.attachedImages = toUniqueIdArray(articleData.attachedImages || []);
        pageState.attachedFiles = toUniqueIdArray(articleData.attachedFiles || []);

        initializePage(layoutCell, articleData.companyCode, companyName, onNavigateBack);
    }

    function cleanupStagedImagePreviewUrls() {
        (pageState.stagedImages || []).forEach(function (img) {
            if (img.previewUrl) {
                URL.revokeObjectURL(img.previewUrl);
            }
        });
    }

    /**
     * Close the page and clean up resources
     */
    function closePage() {
        // Destroy CKEditor instance
        destroyEditor();
        cleanupStagedImagePreviewUrls();
        resetPageState();
    }

// Public API
    return {
        openPage: openPage,
        openEditPage: openEditPage,
        closePage: closePage,
        pageState: pageState,
    };
})();
