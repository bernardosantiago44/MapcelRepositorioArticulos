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
    stagedFiles: [],         // Files selected for upload (not yet saved)
    stagedImages: [],        // Images selected for upload (not yet saved)
    isFormDirty: false,
    allTags: [],
    canUserUpload: true,     // Determined by CompanySettings
    editorInstance: null,    // Editor.js instance
    editMode: false,         // true when editing an existing article
    articleId: null,         // Article ID when in edit mode
    originalArticleData: null // Original article data for edit mode
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
    pageState.stagedFiles = [];
    pageState.stagedImages = [];
    pageState.isFormDirty = false;
    pageState.editMode = false;
    pageState.articleId = null;
    pageState.originalArticleData = null;
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
          <div id="new-article-editor-container" class="border border-gray-300 rounded-lg overflow-hidden bg-white">
            <div id="new-article-editorjs" class="min-h-[200px] px-4 py-2"></div>
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
    var submitLabel = pageState.editMode ? 'Guardar Cambios' : 'Crear Artículo';
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
          ${submitLabel}
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

    // Form input change detection (non-editor fields)
    var inputs = document.querySelectorAll('#new-article-title, #new-article-external-link, #new-article-client-comments');
    inputs.forEach(function(input) {
      input.addEventListener('input', markFormDirty);
    });

    // File upload handlers
    setupFileUploadHandlers();
    setupImageUploadHandlers();
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

    pageState.editorInstance = new EditorJS({
      holder: 'new-article-editorjs',
      placeholder: 'Describe el artículo en detalle...',
      tools: {
        header: {
          class: Header,
          config: {
            levels: [1, 2, 3, 4, 5, 6],
            defaultLevel: 2
          }
        },
        list: {
          class: NestedList || EditorjsList || List,
          inlineToolbar: true
        },
        table: {
          class: Table,
          inlineToolbar: true
        }
      },
      onChange: function() {
        markFormDirty();
      }
    });
  }

  /**
   * Destroy the Editor.js instance and clean up
   */
  function destroyEditor() {
    if (pageState.editorInstance) {
      pageState.editorInstance.destroy();
      pageState.editorInstance = null;
    }
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
            tableHtml += '<' + cellTag + '>' + cell + '</' + cellTag + '>';
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</table>';
        return tableHtml;
      }
    };

    var parser = edjsHTML(customParsers);
    var htmlArray = parser.parse(editorData);
    return htmlArray.join('');
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
    var sanitizedHtml = typeof DOMPurify !== 'undefined'
      ? DOMPurify.sanitize(htmlString, { USE_PROFILES: { html: true } })
      : htmlString;

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
      // Last-resort fallback: insert as paragraph
      editor.blocks.insert('paragraph', { text: sanitizedHtml });
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
    var titleInput = document.getElementById('new-article-title');

    var errors = [];

    if (!titleInput || !titleInput.value.trim()) {
      errors.push('El título es obligatorio');
    }

    if (!descriptionHtml || !descriptionHtml.trim()) {
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
      attachedImages: pageState.stagedImages.map(function(img) { return img.id; }),
      attachedFiles: pageState.stagedFiles.map(function(file) { return file.id; }),
      fileIds: [
        ...pageState.stagedImages.map(function(img) { return img.id; }),
        ...pageState.stagedFiles.map(function(file) { return file.id; })
      ]
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
        var descriptionHtml = convertEditorDataToHtml(editorData);

        // Sanitize the output HTML
        if (typeof DOMPurify !== 'undefined') {
          descriptionHtml = DOMPurify.sanitize(descriptionHtml, { USE_PROFILES: { html: true } });
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
            FileService.createFile({
              name: fileData.name,
              size: fileData.size,
              companyCode: pageState.companyCode,
              file: fileData.file
            }).then(function(response) {
              return { type: 'file', id: response.data.id };
            })
          );
        });

        pageState.stagedImages.forEach(function(imageData) {
          uploadPromises.push(
            ImageService.createImage({
              name: imageData.name,
              size: imageData.size,
              companyCode: pageState.companyCode,
              file: imageData.file
            }).then(function(response) {
              return { type: 'image', id: response.data.id };
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
        initializeEditor();
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
    isPageOpen: isPageOpen,
    navigateToGrid: navigateToGrid
  };
})();
