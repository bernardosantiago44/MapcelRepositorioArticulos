/**
 * Bulk Tag Editor UI Module
 * Provides a popup component for bulk editing tags across multiple selected articles
 * 
 * Logic-driven behavior:
 * - If a tag is missing from at least one article, clicking it ADDS the tag to all articles missing it
 * - If a tag is present on ALL articles, clicking it REMOVES it from all articles
 * 
 * This is an Admin-only feature.
 * 
 * Dependencies:
 * - articleService.js (for fetching tags and bulk updates)
 * - userService.js (for role checking)
 * - Tailwind CSS (for styling)
 */

var BulkTagEditorUI = (function() {
  'use strict';
  
  // State management
  var bulkTagEditorState = {
    currentCompanyId: null,
    selectedArticles: [],        // Array of article objects with resolved tags
    allTags: [],                 // All tags for the company
    tagPresenceMap: {},          // Map of tagId -> { presentCount, missingCount, action }
    modalOverlay: null,
    onUpdateCallback: null
  };
  
  /**
   * Open the bulk tag editor for selected articles
   * @param {string} companyId - The company ID
   * @param {Array<Object>} selectedArticles - Array of selected article objects (with resolved tags)
   * @param {Function} onUpdate - Callback function called after any update
   */
  function openBulkTagEditor(companyId, selectedArticles, onUpdate) {
    // Check admin access
    if (!UserService.isAdministrator()) {
      dhtmlx.alert({
        title: 'Acceso denegado',
        text: 'Solo los administradores pueden realizar edición masiva de etiquetas.'
      });
      return;
    }
    
    if (!selectedArticles || selectedArticles.length === 0) {
      dhtmlx.alert({
        title: 'Atención',
        text: 'Por favor, seleccione al menos un artículo para editar etiquetas.'
      });
      return;
    }
    
    bulkTagEditorState.currentCompanyId = companyId;
    bulkTagEditorState.selectedArticles = selectedArticles;
    bulkTagEditorState.onUpdateCallback = onUpdate || null;
    
    // Load tags for the company
    ArticleService.getTags(companyId)
      .then(function(tags) {
        bulkTagEditorState.allTags = tags;
        calculateTagPresence();
        renderBulkTagEditorModal();
      })
      .catch(function(error) {
        console.error('Error loading tags:', error);
        dhtmlx.alert({
          title: 'Error',
          text: 'No se pudieron cargar las etiquetas. Por favor, inténtelo de nuevo.'
        });
      });
  }
  
  /**
   * Calculate the presence of each tag across selected articles
   * Determines whether each tag should be added or removed
   */
  function calculateTagPresence() {
    var presenceMap = {};
    var totalArticles = bulkTagEditorState.selectedArticles.length;
    
    // Initialize map for all tags
    bulkTagEditorState.allTags.forEach(function(tag) {
      presenceMap[tag.id] = {
        tagId: tag.id,
        tagName: tag.name,
        tagColor: tag.color,
        presentCount: 0,
        missingCount: 0,
        action: null
      };
    });
    
    // Count presence in each article
    bulkTagEditorState.selectedArticles.forEach(function(article) {
      var articleTagIds = [];
      
      if (article.tags && Array.isArray(article.tags)) {
        articleTagIds = article.tags.map(function(tag) {
          return tag.id;
        });
      }
      
      // For each company tag, check if it's in this article
      bulkTagEditorState.allTags.forEach(function(tag) {
        if (articleTagIds.indexOf(tag.id) !== -1) {
          presenceMap[tag.id].presentCount++;
        } else {
          presenceMap[tag.id].missingCount++;
        }
      });
    });
    
    // Determine action for each tag
    Object.keys(presenceMap).forEach(function(tagId) {
      var presence = presenceMap[tagId];
      
      if (presence.presentCount === totalArticles) {
        // Tag is present on ALL articles - clicking will REMOVE it
        presence.action = 'remove';
      } else {
        // Tag is missing from at least one article - clicking will ADD it
        presence.action = 'add';
      }
    });
    
    bulkTagEditorState.tagPresenceMap = presenceMap;
  }
  
  /**
   * Render the bulk tag editor modal
   */
  function renderBulkTagEditorModal() {
    var totalArticles = bulkTagEditorState.selectedArticles.length;
    
    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4';
    overlay.id = 'bulk-tag-editor-overlay';
    
    // Create modal container
    var modalContainer = document.createElement('div');
    modalContainer.className = 'bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col';
    
    // Modal header
    var modalHeader = document.createElement('div');
    modalHeader.className = 'px-6 py-4 border-b border-gray-200';
    modalHeader.innerHTML = 
      '<h2 class="text-lg font-semibold text-gray-800 mb-2">Edición Masiva de Etiquetas</h2>' +
      '<p class="text-sm text-gray-600">' +
        '<span class="font-medium">' + totalArticles + ' artículo' + (totalArticles !== 1 ? 's' : '') + ' seleccionado' + (totalArticles !== 1 ? 's' : '') + '</span>' +
      '</p>' +
      // '<div class="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">' +
      //   '<strong>Lógica de operación:</strong>' +
      //   '<ul class="mt-1 list-disc list-inside">' +
      //     '<li><span class="inline-flex items-center"><span class="w-2 h-2 bg-green-500 rounded-full mr-1"></span>Verde:</span> Clic añadirá esta etiqueta a los artículos que no la tienen</li>' +
      //     '<li><span class="inline-flex items-center"><span class="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Rojo:</span> Clic eliminará esta etiqueta de todos los artículos</li>' +
      //   '</ul>' +
      '</div>';
    
    // Modal body
    var modalBody = document.createElement('div');
    modalBody.className = 'flex-1 overflow-y-auto p-6';
    modalBody.id = 'bulk-tag-editor-body';
    modalBody.innerHTML = renderTagList();
    
    // Modal footer
    var modalFooter = document.createElement('div');
    modalFooter.className = 'px-6 py-4 border-t border-gray-200 flex justify-end';
    modalFooter.innerHTML = 
      '<button id="bulk-tag-editor-close-btn" ' +
        'class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">' +
        'Cerrar' +
      '</button>';
    
    // Assemble modal
    modalContainer.appendChild(modalHeader);
    modalContainer.appendChild(modalBody);
    modalContainer.appendChild(modalFooter);
    overlay.appendChild(modalContainer);
    
    // Add to document
    document.body.appendChild(overlay);
    bulkTagEditorState.modalOverlay = overlay;
    
    // Attach event listeners
    attachEventListeners();
    
    // Prevent clicks on modal from closing it
    modalContainer.addEventListener('click', function(e) {
      e.stopPropagation();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', function() {
      closeBulkTagEditor();
    });
  }
  
  /**
   * Render the list of tags with their action indicators
   * @returns {string} HTML string for tag list
   */
  function renderTagList() {
    if (bulkTagEditorState.allTags.length === 0) {
      return '<div class="text-center py-8">' +
        '<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>' +
        '</svg>' +
        '<p class="mt-4 text-gray-500">No hay etiquetas disponibles para esta empresa</p>' +
      '</div>';
    }
    
    var totalArticles = bulkTagEditorState.selectedArticles.length;
    var html = '<div class="grid gap-3">';
    
    bulkTagEditorState.allTags.forEach(function(tag) {
      var presence = bulkTagEditorState.tagPresenceMap[tag.id];
      var isAddAction = presence.action === 'add';
      
      // Determine button style based on action
      var actionBgClass = isAddAction ? 'bg-green-50 hover:bg-green-100 border-green-200' : 'bg-red-50 hover:bg-red-100 border-red-200';
      var actionIndicatorClass = isAddAction ? 'bg-green-500' : 'bg-red-500';
      var actionText = isAddAction 
        ? 'Clic para añadir a ' + presence.missingCount + ' artículo' + (presence.missingCount !== 1 ? 's' : '')
        : 'Clic para eliminar de todos los artículos';
      
      // Presence indicator text
      var presenceText = presence.presentCount + '/' + totalArticles + ' artículos tienen esta etiqueta';
      
      html += `<button class="bulk-tag-btn flex items-center justify-between p-4 border rounded-lg ${actionBgClass} transition-colors cursor-pointer w-full text-left" ` +
              `data-tag-id="${tag.id}" data-action="${presence.action}">
        <div class="flex items-center space-x-3">
          <span class="w-3 h-3 rounded-full ${actionIndicatorClass}"></span>
          ${renderTagBadge(tag)}
        </div>
        <div class="text-right">
          <div class="text-sm text-gray-600">${presenceText}</div>
          <div class="text-xs text-gray-500 mt-1">${actionText}</div>
        </div>
      </button>`;
    });
    
    html += '</div>';
    return html;
  }
  
  /**
   * Attach event listeners to modal elements
   */
  function attachEventListeners() {
    // Close button
    var closeBtn = document.getElementById('bulk-tag-editor-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeBulkTagEditor();
      });
    }
    
    // Tag buttons
    var tagButtons = document.querySelectorAll('.bulk-tag-btn');
    tagButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tagId = btn.getAttribute('data-tag-id');
        var action = btn.getAttribute('data-action');
        handleTagClick(tagId, action);
      });
    });
  }
  
  /**
   * Handle click on a tag button
   * @param {string} tagId - Tag ID
   * @param {string} action - 'add' or 'remove'
   */
  function handleTagClick(tagId, action) {
    var tagInfo = bulkTagEditorState.tagPresenceMap[tagId];
    var tagName = tagInfo ? tagInfo.tagName : tagId;
    
    // Confirm the action
    var actionText = action === 'add' ? 'añadir' : 'eliminar';
    var targetText = action === 'add' 
      ? tagInfo.missingCount + ' artículo' + (tagInfo.missingCount !== 1 ? 's' : '')
      : 'todos los ' + tagInfo.presentCount + ' artículos';
    
    var confirmMessage = '¿Está seguro de que desea ' + actionText + ' la etiqueta "' + tagName + '" de ' + targetText + '?';
    
    dhtmlx.confirm({
      title: 'Confirmar acción',
      text: confirmMessage,
      callback: function(result) {
        if (result) {
          performBulkUpdate(tagId, action);
        }
      }
    });
  }
  
  /**
   * Perform the bulk update operation
   * @param {string} tagId - Tag ID
   * @param {string} action - 'add' or 'remove'
   */
  function performBulkUpdate(tagId, action) {
    var articleIds = bulkTagEditorState.selectedArticles.map(function(article) {
      return article.id;
    });
    
    // Show loading indicator
    var modalBody = document.getElementById('bulk-tag-editor-body');
    if (modalBody) {
      modalBody.innerHTML = '<div class="text-center py-12">' +
        '<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>' +
        '<p class="mt-4 text-gray-600">Actualizando etiquetas...</p>' +
      '</div>';
    }
    
    ArticleService.bulkUpdateTags(articleIds, tagId, action)
      .then(function(response) {
        if (response.status === 'success') {
          var actionVerb = action === 'add' ? 'añadida' : 'eliminada';
          dhtmlx.message({
            text: 'Etiqueta ' + actionVerb + ' exitosamente de ' + response.updatedCount + ' artículo' + (response.updatedCount !== 1 ? 's' : ''),
            type: 'success',
            expire: 3000
          });
          
          // Refresh the articles data and recalculate presence
          return refreshArticlesData();
        }
      })
      .then(function() {
        // Recalculate and re-render
        calculateTagPresence();
        if (modalBody) {
          modalBody.innerHTML = renderTagList();
          attachEventListeners();
        }
        
        // Call the update callback
        if (bulkTagEditorState.onUpdateCallback) {
          bulkTagEditorState.onUpdateCallback();
        }
      })
      .catch(function(error) {
        console.error('Error performing bulk update:', error);
        dhtmlx.alert({
          title: 'Error',
          text: 'No se pudo actualizar las etiquetas. Por favor, inténtelo de nuevo.'
        });
        
        // Restore the tag list
        if (modalBody) {
          modalBody.innerHTML = renderTagList();
          attachEventListeners();
        }
      });
  }
  
  /**
   * Refresh the articles data after an update
   * Uses bulk fetch for better performance
   * @returns {Promise} Promise that resolves when data is refreshed
   */
  function refreshArticlesData() {
    var articleIds = bulkTagEditorState.selectedArticles.map(function(article) {
      return article.id;
    });
    
    // Fetch updated articles using bulk method
    return ArticleService.getArticlesByIds(articleIds)
      .then(function(updatedArticles) {
        // Filter out any null results
        bulkTagEditorState.selectedArticles = updatedArticles.filter(function(article) {
          return article !== null;
        });
      });
  }
  
  /**
   * Close the bulk tag editor
   */
  function closeBulkTagEditor() {
    if (bulkTagEditorState.modalOverlay) {
      bulkTagEditorState.modalOverlay.remove();
      bulkTagEditorState.modalOverlay = null;
    }
    
    // Clean up state
    bulkTagEditorState.currentCompanyId = null;
    bulkTagEditorState.selectedArticles = [];
    bulkTagEditorState.allTags = [];
    bulkTagEditorState.tagPresenceMap = {};
    bulkTagEditorState.onUpdateCallback = null;
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Public API
  return {
    openBulkTagEditor: openBulkTagEditor,
    closeBulkTagEditor: closeBulkTagEditor
  };
})();
