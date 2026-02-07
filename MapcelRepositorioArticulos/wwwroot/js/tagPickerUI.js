/**
 * Tag Picker UI Module
 * Provides a reusable popup component for selecting tags
 * 
 * Features:
 * - Multi-select with checkboxes
 * - Search/filter functionality
 * - Pagination for large tag lists
 * - Can be triggered from anywhere in the app
 * 
 * Dependencies:
 * - articleService.js (for fetching tags)
 * - Tailwind CSS (for styling)
 */

var TagPickerUI = (function() {
  'use strict';
  
  // State management
  var tagPickerState = {
    currentCompanyId: null,
    allTags: [],
    filteredTags: [],
    selectedTagIds: [],
    searchQuery: '',
    currentPage: 1,
    tagsPerPage: 10,
    pickerOverlay: null,
    onSelectionCallback: null,
    searchListenerAttached: false,  // Listener guard to prevent duplication
    searchDebounceTimer: null       // Debounce timer for search input
  };
  
  // Constants
  var TAG_SEARCH_DEBOUNCE_DELAY = 300; // milliseconds
  
  /**
   * Open the tag picker
   * @param {string} companyId - The company ID to load tags for
   * @param {Array<string>} selectedTagIds - Currently selected tag IDs
   * @param {Function} onSelection - Callback function called with selected tags array
   */
  function openTagPicker(companyId, selectedTagIds, onSelection) {
    tagPickerState.currentCompanyId = companyId;
    tagPickerState.selectedTagIds = selectedTagIds || [];
    tagPickerState.onSelectionCallback = onSelection || null;
    tagPickerState.searchQuery = '';
    tagPickerState.currentPage = 1;
    
    // Load tags for the company
    ArticleService.getTags(companyId)
      .then(function(tags) {
        tagPickerState.allTags = tags;
        tagPickerState.filteredTags = tags;
        renderTagPickerModal();
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
   * Render the tag picker modal
   */
  function renderTagPickerModal() {
    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4';
    overlay.id = 'tag-picker-overlay';
    
    // Create modal container
    var modalContainer = document.createElement('div');
    modalContainer.className = 'bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col';
    
    // Modal header
    var modalHeader = document.createElement('div');
    modalHeader.className = 'px-6 py-4 border-b border-gray-200';
    modalHeader.innerHTML = `
      <h2 class="text-lg font-semibold text-gray-800 mb-3">Seleccionar Etiquetas</h2>
      <div class="relative">
        <input type="text" id="tag-picker-search" 
               class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               placeholder="Buscar etiquetas..." />
        <svg class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    `;
    
    // Modal body
    var modalBody = document.createElement('div');
    modalBody.className = 'flex-1 overflow-y-auto p-6';
    modalBody.id = 'tag-picker-body';
    modalBody.innerHTML = renderTagList();
    
    // Modal footer
    var modalFooter = document.createElement('div');
    modalFooter.className = 'px-6 py-4 border-t border-gray-200 flex justify-between items-center';
    modalFooter.innerHTML = `
      <div class="text-sm text-gray-500">
        <span id="tag-picker-selected-count">${tagPickerState.selectedTagIds.length}</span> seleccionada${tagPickerState.selectedTagIds.length !== 1 ? 's' : ''}
      </div>
      <div class="flex space-x-3">
        <button id="tag-picker-cancel-btn" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button id="tag-picker-apply-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
          Aplicar
        </button>
      </div>
    `;
    
    // Assemble modal
    modalContainer.appendChild(modalHeader);
    modalContainer.appendChild(modalBody);
    modalContainer.appendChild(modalFooter);
    overlay.appendChild(modalContainer);
    
    // Add to document
    document.body.appendChild(overlay);
    tagPickerState.pickerOverlay = overlay;
    
    // Attach event listeners
    attachTagPickerEventListeners();
    
    // Prevent clicks on modal from closing it
    modalContainer.addEventListener('click', function(e) {
      e.stopPropagation();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', function() {
      closeTagPicker(false);
    });
  }
  
  /**
   * Render the list of tags with checkboxes
   * @returns {string} HTML string for tag list
   */
  function renderTagList() {
    if (tagPickerState.filteredTags.length === 0) {
      return `
        <div class="text-center py-8">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
          </svg>
          <p class="mt-4 text-gray-500">No se encontraron etiquetas</p>
        </div>
      `;
    }
    
    // Calculate pagination
    var totalPages = Math.ceil(tagPickerState.filteredTags.length / tagPickerState.tagsPerPage);
    var startIndex = (tagPickerState.currentPage - 1) * tagPickerState.tagsPerPage;
    var endIndex = Math.min(startIndex + tagPickerState.tagsPerPage, tagPickerState.filteredTags.length);
    var currentPageTags = tagPickerState.filteredTags.slice(startIndex, endIndex);
    
    var html = '<div class="space-y-2">';
    
    currentPageTags.forEach(function(tag) {
      var isSelected = tagPickerState.selectedTagIds.indexOf(tag.id) !== -1;
      var checkboxId = 'tag-checkbox-' + tag.id;
      
      html += `
        <label class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          <input type="checkbox" id="${checkboxId}" 
                 class="tag-picker-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" 
                 data-tag-id="${tag.id}" 
                 ${isSelected ? 'checked' : ''} />
          <div class="ml-3 flex items-center space-x-3 flex-1">
            ${renderTagBadge(tag)}
            <span class="text-sm text-gray-600">${escapeHtml(tag.description || '')}</span>
          </div>
        </label>
      `;
    });
    
    html += '</div>';
    
    // Add pagination if needed
    if (totalPages > 1) {
      html += '<div class="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">';
      html += '<div class="text-sm text-gray-500">';
      html += 'Mostrando ' + (startIndex + 1) + '-' + endIndex + ' de ' + tagPickerState.filteredTags.length;
      html += '</div>';
      html += '<div class="flex space-x-2">';
      
      // Previous button
      if (tagPickerState.currentPage > 1) {
        html += '<button id="tag-picker-prev-btn" class="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm">';
        html += 'Anterior';
        html += '</button>';
      }
      
      // Page numbers
      html += '<span class="px-3 py-1 text-sm text-gray-600">';
      html += 'Página ' + tagPickerState.currentPage + ' de ' + totalPages;
      html += '</span>';
      
      // Next button
      if (tagPickerState.currentPage < totalPages) {
        html += '<button id="tag-picker-next-btn" class="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm">';
        html += 'Siguiente';
        html += '</button>';
      }
      
      html += '</div>';
      html += '</div>';
    }
    
    return html;
  }
  
  /**
   * Attach event listeners to tag picker elements
   */
  function attachTagPickerEventListeners() {
    // Search input - with listener guard and debounce
    var searchInput = document.getElementById('tag-picker-search');
    if (searchInput && !tagPickerState.searchListenerAttached) {
      tagPickerState.searchListenerAttached = true;
      searchInput.addEventListener('input', function() {
        // Clear any existing debounce timer
        if (tagPickerState.searchDebounceTimer) {
          clearTimeout(tagPickerState.searchDebounceTimer);
        }
        
        // Set a new debounce timer
        var currentValue = searchInput.value;
        tagPickerState.searchDebounceTimer = setTimeout(function() {
          handleSearch(currentValue);
        }, TAG_SEARCH_DEBOUNCE_DELAY);
      });
    }
    
    // Cancel button
    var cancelBtn = document.getElementById('tag-picker-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        closeTagPicker(false);
      });
    }
    
    // Apply button
    var applyBtn = document.getElementById('tag-picker-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', function() {
        closeTagPicker(true);
      });
    }
    
    // Checkbox change events
    var checkboxes = document.querySelectorAll('.tag-picker-checkbox');
    checkboxes.forEach(function(checkbox) {
      checkbox.addEventListener('change', function() {
        handleCheckboxChange(checkbox);
      });
    });
    
    // Pagination buttons
    var prevBtn = document.getElementById('tag-picker-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        changePage(tagPickerState.currentPage - 1);
      });
    }
    
    var nextBtn = document.getElementById('tag-picker-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        changePage(tagPickerState.currentPage + 1);
      });
    }
  }
  
  /**
   * Handle search input
   * @param {string} query - Search query
   */
  function handleSearch(query) {
    tagPickerState.searchQuery = query.toLowerCase().trim();
    tagPickerState.currentPage = 1;
    
    // Filter tags based on search query
    if (tagPickerState.searchQuery === '') {
      tagPickerState.filteredTags = tagPickerState.allTags;
    } else {
      tagPickerState.filteredTags = tagPickerState.allTags.filter(function(tag) {
        return tag.name.toLowerCase().includes(tagPickerState.searchQuery) ||
               (tag.description && tag.description.toLowerCase().includes(tagPickerState.searchQuery));
      });
    }
    
    // Refresh the tag list
    refreshTagList();
  }
  
  /**
   * Handle checkbox change
   * @param {HTMLElement} checkbox - The checkbox element
   */
  function handleCheckboxChange(checkbox) {
    var tagId = checkbox.getAttribute('data-tag-id');
    var isChecked = checkbox.checked;
    
    if (isChecked) {
      // Add to selected tags
      if (tagPickerState.selectedTagIds.indexOf(tagId) === -1) {
        tagPickerState.selectedTagIds.push(tagId);
      }
    } else {
      // Remove from selected tags
      var index = tagPickerState.selectedTagIds.indexOf(tagId);
      if (index !== -1) {
        tagPickerState.selectedTagIds.splice(index, 1);
      }
    }
    
    // Update selected count
    updateSelectedCount();
  }
  
  /**
   * Update the selected count display
   */
  function updateSelectedCount() {
    var countElement = document.getElementById('tag-picker-selected-count');
    if (countElement) {
      countElement.textContent = tagPickerState.selectedTagIds.length;
      
      // Update the parent text while preserving the count element
      var parentElement = countElement.parentElement;
      if (parentElement) {
        // Clear and rebuild the text node properly
        parentElement.textContent = '';
        var countSpan = document.createElement('span');
        countSpan.id = 'tag-picker-selected-count';
        countSpan.textContent = tagPickerState.selectedTagIds.length;
        parentElement.appendChild(countSpan);
        parentElement.appendChild(document.createTextNode(' seleccionada' + (tagPickerState.selectedTagIds.length !== 1 ? 's' : '')));
      }
    }
  }
  
  /**
   * Change to a different page
   * @param {number} page - Page number
   */
  function changePage(page) {
    var totalPages = Math.ceil(tagPickerState.filteredTags.length / tagPickerState.tagsPerPage);
    
    if (page < 1 || page > totalPages) {
      return;
    }
    
    tagPickerState.currentPage = page;
    refreshTagList();
  }
  
  /**
   * Refresh the tag list in the picker
   */
  function refreshTagList() {
    var modalBody = document.getElementById('tag-picker-body');
    if (modalBody) {
      modalBody.innerHTML = renderTagList();
      attachTagPickerEventListeners();
    }
  }
  
  /**
   * Close the tag picker
   * @param {boolean} applyChanges - Whether to apply the selected tags
   */
  function closeTagPicker(applyChanges) {
    if (applyChanges && tagPickerState.onSelectionCallback) {
      // Get the selected tag objects
      var selectedTags = tagPickerState.allTags.filter(function(tag) {
        return tagPickerState.selectedTagIds.indexOf(tag.id) !== -1;
      });
      
      tagPickerState.onSelectionCallback(selectedTags);
    }
    
    if (tagPickerState.pickerOverlay) {
      tagPickerState.pickerOverlay.remove();
      tagPickerState.pickerOverlay = null;
    }
    
    // Clean up state
    tagPickerState.currentCompanyId = null;
    tagPickerState.allTags = [];
    tagPickerState.filteredTags = [];
    tagPickerState.selectedTagIds = [];
    tagPickerState.searchQuery = '';
    tagPickerState.currentPage = 1;
    tagPickerState.onSelectionCallback = null;
    tagPickerState.searchListenerAttached = false; // Reset listener guard
    
    // Clear any pending debounce timer
    if (tagPickerState.searchDebounceTimer) {
      clearTimeout(tagPickerState.searchDebounceTimer);
      tagPickerState.searchDebounceTimer = null;
    }
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
    openTagPicker: openTagPicker,
    closeTagPicker: closeTagPicker
  };
})();
