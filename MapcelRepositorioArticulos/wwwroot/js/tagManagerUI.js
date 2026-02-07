/**
 * Tag Manager UI Module
 * Provides an administrative interface for managing company-scoped tags
 * 
 * Features:
 * - List all tags for a company
 * - Create new tags
 * - Edit existing tags
 * - Delete tags
 * - Color picker with preset colors
 * - Live preview badge
 * 
 * Dependencies:
 * - articleService.js (for tag CRUD operations)
 * - Tailwind CSS (for styling)
 */

var TagManagerUI = (function() {
  'use strict';
  
  // State management
  var tagManagerState = {
    currentCompanyId: null,
    tags: [],
    editingTagId: null,
    modalOverlay: null,
    onTagsChangedCallback: null
  };
  
  // Preset colors for the color picker
  var PRESET_COLORS = [
    { name: 'Red', hex: '#ef4444' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Yellow', hex: '#eab308' },
    { name: 'Lime', hex: '#84cc16' },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Teal', hex: '#14b8a6' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Sky', hex: '#0ea5e9' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Violet', hex: '#8b5cf6' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Fuchsia', hex: '#d946ef' },
    { name: 'Pink', hex: '#ec4899' }
  ];
  
  /**
   * Open the Tag Manager modal for a specific company
   * @param {string} companyId - The company ID
   * @param {Function} onTagsChanged - Callback when tags are modified (optional)
   */
  function openTagManager(companyId, onTagsChanged) {
    tagManagerState.currentCompanyId = companyId;
    tagManagerState.onTagsChangedCallback = onTagsChanged || null;
    
    // Load tags for the company
    ArticleService.getTags(companyId)
      .then(function(tags) {
        tagManagerState.tags = tags;
        renderTagManagerModal();
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
   * Render the Tag Manager modal
   */
  function renderTagManagerModal() {
    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4';
    
    // Create modal container
    var modalContainer = document.createElement('div');
    modalContainer.className = 'bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col';
    
    // Modal header
    var modalHeader = document.createElement('div');
    modalHeader.className = 'px-6 py-4 border-b border-gray-200 flex items-center justify-between';
    modalHeader.innerHTML = `
      <h2 class="text-xl font-semibold text-gray-800">Administrar Etiquetas</h2>
      <button id="tag-manager-close-btn" class="text-gray-400 hover:text-gray-600 transition-colors">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    `;
    
    // Modal body
    var modalBody = document.createElement('div');
    modalBody.className = 'flex-1 overflow-y-auto p-6';
    modalBody.innerHTML = renderTagList();
    
    // Modal footer
    var modalFooter = document.createElement('div');
    modalFooter.className = 'px-6 py-4 border-t border-gray-200 flex justify-between items-center';
    modalFooter.innerHTML = `
      <button id="tag-manager-new-tag-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
        Nueva etiqueta
      </button>
      <div class="text-sm text-gray-500">
        ${tagManagerState.tags.length} etiqueta${tagManagerState.tags.length !== 1 ? 's' : ''}
      </div>
    `;
    
    // Assemble modal
    modalContainer.appendChild(modalHeader);
    modalContainer.appendChild(modalBody);
    modalContainer.appendChild(modalFooter);
    overlay.appendChild(modalContainer);
    
    // Add to document
    document.body.appendChild(overlay);
    tagManagerState.modalOverlay = overlay;
    
    // Attach event listeners
    attachTagManagerEventListeners();
    
    // Prevent clicks on modal from closing it
    modalContainer.addEventListener('click', function(e) {
      e.stopPropagation();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', function() {
      closeTagManager();
    });
  }
  
  /**
   * Render the list of tags
   * @returns {string} HTML string for tag list
   */
  function renderTagList() {
    if (tagManagerState.tags.length === 0) {
      return `
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
          </svg>
          <p class="mt-4 text-gray-500">No hay etiquetas creadas</p>
          <p class="mt-1 text-sm text-gray-400">Crea tu primera etiqueta haciendo clic en "Nueva etiqueta"</p>
        </div>
      `;
    }
    
    var html = '<div class="space-y-3">';
    
    tagManagerState.tags.forEach(function(tag) {
      html += `
        <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <div class="flex items-center space-x-4 flex-1">
            ${renderTagBadge(tag)}
            <div class="flex-1">
              <p class="text-sm text-gray-600">${escapeHtml(tag.description || 'Sin descripción')}</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <button class="tag-edit-btn p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" 
                    data-tag-id="${tag.id}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button class="tag-delete-btn p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors" 
                    data-tag-id="${tag.id}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }
  
  /**
   * Attach event listeners to tag manager elements
   */
  function attachTagManagerEventListeners() {
    // Close button
    var closeBtn = document.getElementById('tag-manager-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeTagManager();
      });
    }
    
    // New tag button
    var newTagBtn = document.getElementById('tag-manager-new-tag-btn');
    if (newTagBtn) {
      newTagBtn.addEventListener('click', function() {
        openTagForm(null);
      });
    }
    
    // Edit buttons
    var editButtons = document.querySelectorAll('.tag-edit-btn');
    editButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tagId = btn.getAttribute('data-tag-id');
        openTagForm(tagId);
      });
    });
    
    // Delete buttons
    var deleteButtons = document.querySelectorAll('.tag-delete-btn');
    deleteButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tagId = btn.getAttribute('data-tag-id');
        confirmDeleteTag(tagId);
      });
    });
  }
  
  /**
   * Open the tag form for creating or editing a tag
   * @param {string|null} tagId - Tag ID to edit, or null to create new
   */
  function openTagForm(tagId) {
    tagManagerState.editingTagId = tagId;
    
    var tag = null;
    if (tagId) {
      tag = tagManagerState.tags.find(function(t) { return t.id === tagId; });
      if (!tag) {
        dhtmlx.alert({
          title: 'Error',
          text: 'Etiqueta no encontrada'
        });
        return;
      }
    }
    
    var isEdit = tagId !== null;
    var formTitle = isEdit ? 'Editar Etiqueta' : 'Nueva Etiqueta';
    var formData = tag || { name: '', color: PRESET_COLORS[0].hex, description: '' };
    
    // Create form overlay
    var formOverlay = document.createElement('div');
    formOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4';
    formOverlay.id = 'tag-form-overlay';
    
    // Create form container
    var formContainer = document.createElement('div');
    formContainer.className = 'bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden';
    
    // Form header
    var formHeader = document.createElement('div');
    formHeader.className = 'px-6 py-4 border-b border-gray-200';
    formHeader.innerHTML = `
      <h3 class="text-lg font-semibold text-gray-800">${formTitle}</h3>
    `;
    
    // Form body
    var formBody = document.createElement('div');
    formBody.className = 'p-6 space-y-4';
    
    // Name input
    var nameGroup = document.createElement('div');
    nameGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
      <input type="text" id="tag-form-name" value="${escapeHtml(formData.name)}" 
             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
             placeholder="Ej: Bug, Feature, Urgente" />
    `;
    formBody.appendChild(nameGroup);
    
    // Color picker
    var colorGroup = document.createElement('div');
    colorGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-2">Color *</label>
      <div class="grid grid-cols-8 gap-2 mb-2" id="tag-form-color-presets"></div>
      <input type="color" id="tag-form-color-custom" value="${formData.color}" 
             class="w-full h-10 border border-gray-300 rounded-md cursor-pointer" />
    `;
    formBody.appendChild(colorGroup);
    
    // Description textarea
    var descGroup = document.createElement('div');
    descGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
      <textarea id="tag-form-description" rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Descripción opcional de la etiqueta">${escapeHtml(formData.description || '')}</textarea>
    `;
    formBody.appendChild(descGroup);
    
    // Preview
    var previewGroup = document.createElement('div');
    previewGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-2">Vista previa</label>
      <div id="tag-form-preview" class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
           style="background-color: ${formData.color};">
        ${escapeHtml(formData.name) || 'Nombre de etiqueta'}
      </div>
    `;
    formBody.appendChild(previewGroup);
    
    // Form footer
    var formFooter = document.createElement('div');
    formFooter.className = 'px-6 py-4 border-t border-gray-200 flex justify-end space-x-3';
    formFooter.innerHTML = `
      <button id="tag-form-cancel-btn" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
        Cancelar
      </button>
      <button id="tag-form-save-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
        ${isEdit ? 'Guardar cambios' : 'Crear etiqueta'}
      </button>
    `;
    
    // Assemble form
    formContainer.appendChild(formHeader);
    formContainer.appendChild(formBody);
    formContainer.appendChild(formFooter);
    formOverlay.appendChild(formContainer);
    
    // Add to document
    document.body.appendChild(formOverlay);
    
    // Prevent clicks on form from closing it
    formContainer.addEventListener('click', function(e) {
      e.stopPropagation();
    });
    
    // Close on overlay click
    formOverlay.addEventListener('click', function() {
      closeTagForm();
    });
    
    // Render color presets after DOM is ready
    // Using requestAnimationFrame ensures the DOM is painted before we attach listeners
    requestAnimationFrame(function() {
      renderColorPresets(formData.color);
      attachTagFormEventListeners(isEdit);
    });
  }
  
  /**
   * Render color preset buttons
   * @param {string} selectedColor - Currently selected color
   */
  function renderColorPresets(selectedColor) {
    var presetsContainer = document.getElementById('tag-form-color-presets');
    if (!presetsContainer) return;
    
    presetsContainer.innerHTML = '';
    
    PRESET_COLORS.forEach(function(preset) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'w-8 h-8 rounded-md border-2 transition-all hover:scale-110';
      button.style.backgroundColor = preset.hex;
      button.title = preset.name;
      button.setAttribute('data-color', preset.hex);
      
      if (preset.hex.toLowerCase() === selectedColor.toLowerCase()) {
        button.className += ' border-gray-800 scale-110';
      } else {
        button.className += ' border-transparent';
      }
      
      button.addEventListener('click', function() {
        selectColor(preset.hex);
      });
      
      presetsContainer.appendChild(button);
    });
  }
  
  /**
   * Select a color and update the preview
   * @param {string} color - Hex color code
   */
  function selectColor(color) {
    var customInput = document.getElementById('tag-form-color-custom');
    if (customInput) {
      customInput.value = color;
    }
    
    // Update preset button styles
    var presetButtons = document.querySelectorAll('#tag-form-color-presets button');
    presetButtons.forEach(function(btn) {
      var btnColor = btn.getAttribute('data-color');
      if (btnColor.toLowerCase() === color.toLowerCase()) {
        btn.className = 'w-8 h-8 rounded-md border-2 transition-all hover:scale-110 border-gray-800 scale-110';
      } else {
        btn.className = 'w-8 h-8 rounded-md border-2 transition-all hover:scale-110 border-transparent';
      }
    });
    
    updatePreview();
  }
  
  /**
   * Update the preview badge
   */
  function updatePreview() {
    var nameInput = document.getElementById('tag-form-name');
    var colorInput = document.getElementById('tag-form-color-custom');
    var preview = document.getElementById('tag-form-preview');
    
    if (nameInput && colorInput && preview) {
      var name = nameInput.value.trim() || 'Nombre de etiqueta';
      var color = colorInput.value;
      
      preview.textContent = name;
      preview.style.backgroundColor = color;
    }
  }
  
  /**
   * Attach event listeners to tag form elements
   * @param {boolean} isEdit - Whether this is an edit operation
   */
  function attachTagFormEventListeners(isEdit) {
    // Cancel button
    var cancelBtn = document.getElementById('tag-form-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        closeTagForm();
      });
    }
    
    // Save button
    var saveBtn = document.getElementById('tag-form-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveTag(isEdit);
      });
    }
    
    // Name input - update preview on input
    var nameInput = document.getElementById('tag-form-name');
    if (nameInput) {
      nameInput.addEventListener('input', updatePreview);
    }
    
    // Color input - update preview on change
    var colorInput = document.getElementById('tag-form-color-custom');
    if (colorInput) {
      colorInput.addEventListener('input', function() {
        updatePreview();
        // Update preset button styles to reflect custom color
        renderColorPresets(colorInput.value);
      });
    }
  }
  
  /**
   * Save the tag (create or update)
   * @param {boolean} isEdit - Whether this is an edit operation
   */
  function saveTag(isEdit) {
    var nameInput = document.getElementById('tag-form-name');
    var colorInput = document.getElementById('tag-form-color-custom');
    var descInput = document.getElementById('tag-form-description');
    
    if (!nameInput || !colorInput) {
      return;
    }
    
    var name = nameInput.value.trim();
    var color = colorInput.value;
    var description = descInput ? descInput.value.trim() : '';
    
    // Validate
    if (!name) {
      dhtmlx.alert({
        title: 'Error de validación',
        text: 'El nombre de la etiqueta es obligatorio.'
      });
      return;
    }
    
    var tagData = {
      name: name,
      color: color,
      description: description,
      companyId: tagManagerState.currentCompanyId
    };
    
    var promise;
    if (isEdit) {
      promise = ArticleService.updateTag(tagManagerState.editingTagId, tagData);
    } else {
      promise = ArticleService.createTag(tagData);
    }
    
    promise
      .then(function(response) {
        if (response.status === 'success') {
          dhtmlx.message({
            text: isEdit ? 'Etiqueta actualizada exitosamente' : 'Etiqueta creada exitosamente',
            type: 'success',
            expire: 3000
          });
          
          closeTagForm();
          
          // Reload tags and refresh the list
          return ArticleService.getTags(tagManagerState.currentCompanyId);
        }
      })
      .then(function(tags) {
        if (tags) {
          tagManagerState.tags = tags;
          refreshTagList();
          
          // Call the callback if provided
          if (tagManagerState.onTagsChangedCallback) {
            tagManagerState.onTagsChangedCallback();
          }
        }
      })
      .catch(function(error) {
        console.error('Error saving tag:', error);
        dhtmlx.alert({
          title: 'Error',
          text: 'No se pudo guardar la etiqueta. Por favor, inténtelo de nuevo.'
        });
      });
  }
  
  /**
   * Confirm and delete a tag
   * @param {string} tagId - Tag ID to delete
   */
  function confirmDeleteTag(tagId) {
    var tag = tagManagerState.tags.find(function(t) { return t.id === tagId; });
    if (!tag) {
      return;
    }
    
    dhtmlx.confirm({
      title: 'Confirmar eliminación',
      text: '¿Estás seguro de que deseas eliminar la etiqueta "' + tag.name + '"? Esta acción no se puede deshacer.',
      callback: function(result) {
        if (result) {
          deleteTag(tagId);
        }
      }
    });
  }
  
  /**
   * Delete a tag
   * @param {string} tagId - Tag ID to delete
   */
  function deleteTag(tagId) {
    ArticleService.deleteTag(tagId)
      .then(function(response) {
        if (response.status === 'success') {
          dhtmlx.message({
            text: 'Etiqueta eliminada exitosamente',
            type: 'success',
            expire: 3000
          });
          
          // Reload tags and refresh the list
          return ArticleService.getTags(tagManagerState.currentCompanyId);
        }
      })
      .then(function(tags) {
        if (tags) {
          tagManagerState.tags = tags;
          refreshTagList();
          
          // Call the callback if provided
          if (tagManagerState.onTagsChangedCallback) {
            tagManagerState.onTagsChangedCallback();
          }
        }
      })
      .catch(function(error) {
        console.error('Error deleting tag:', error);
        dhtmlx.alert({
          title: 'Error',
          text: 'No se pudo eliminar la etiqueta. Por favor, inténtelo de nuevo.'
        });
      });
  }
  
  /**
   * Refresh the tag list in the modal
   */
  function refreshTagList() {
    var modalBody = tagManagerState.modalOverlay ? 
      tagManagerState.modalOverlay.querySelector('.overflow-y-auto') : null;
    
    if (modalBody) {
      modalBody.innerHTML = renderTagList();
      attachTagManagerEventListeners();
    }
    
    // Update tag count in footer
    var tagCount = tagManagerState.modalOverlay ? 
      tagManagerState.modalOverlay.querySelector('.text-sm.text-gray-500') : null;
    
    if (tagCount) {
      tagCount.textContent = tagManagerState.tags.length + ' etiqueta' + 
        (tagManagerState.tags.length !== 1 ? 's' : '');
    }
  }
  
  /**
   * Close the tag form
   */
  function closeTagForm() {
    var formOverlay = document.getElementById('tag-form-overlay');
    if (formOverlay) {
      formOverlay.remove();
    }
    tagManagerState.editingTagId = null;
  }
  
  /**
   * Close the Tag Manager modal
   */
  function closeTagManager() {
    if (tagManagerState.modalOverlay) {
      tagManagerState.modalOverlay.remove();
      tagManagerState.modalOverlay = null;
    }
    
    // Clean up state
    tagManagerState.currentCompanyId = null;
    tagManagerState.tags = [];
    tagManagerState.editingTagId = null;
    tagManagerState.onTagsChangedCallback = null;
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
    openTagManager: openTagManager,
    closeTagManager: closeTagManager
  };
})();
