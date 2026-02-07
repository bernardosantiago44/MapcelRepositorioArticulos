/**
 * Images Tab Manager
 * Main controller for the Images tab functionality
 * Integrates gallery view, list view, bulk selection, and image operations
 */

const ImagesTabManager = (function() {
  'use strict';
  
  // State management
  let currentView = 'gallery'; // 'gallery' or 'list'
  let currentCompanyId = null;
  let imagesGrid = null;
  let imagesCell = null;
  let imagesLayout = null;
  let contentSection = null;
  let currentSearchTerm = '';
  let selectedImageIds = [];
  let currentImages = [];
  
  /**
   * Initialize the Images tab
   * @param {Object} tabCell - DHTMLX tab cell for images
   * @param {string} companyId - Current company ID
   */
  function initializeImagesTab(tabCell, companyId) {
    currentCompanyId = companyId;
    imagesCell = tabCell;
    
    // Create layout for images tab
    imagesLayout = tabCell.attachLayout('2E');
    
    // Top section - Toolbar and search
    const topSection = imagesLayout.cells('a');
    topSection.hideHeader();
    topSection.setHeight(120);
    topSection.fixSize(0, 1);
    
    // Bottom section - Images display (gallery or list view)
    contentSection = imagesLayout.cells('b');
    contentSection.hideHeader();
    
    // Attach top section content
    topSection.attachHTMLString(renderTopSection());
    
    // Initialize with gallery view by default
    loadImages();
    
    // Setup event handlers
    setTimeout(() => {
      setupTopSectionHandlers();
      
      // Apply permission-based visibility
      applyUploadPermissions();
    }, 100);
    
    return {
      imagesLayout,
      imagesGrid,
      contentSection
    };
  }
  
  /**
   * Apply upload permissions based on company settings
   * Hides/shows upload button for non-admin users
   */
  function applyUploadPermissions() {
    // Admins always have full access
    if (UserService.isAdministrator()) {
      return;
    }
    
    // Check if company is selected
    if (!currentCompanyId) {
      return;
    }
    
    // For regular users, check company settings
    CompanyService.canUsersUpload(currentCompanyId)
      .then(function(canUpload) {
        const uploadBtn = document.getElementById('images-upload-btn');
        if (uploadBtn) {
          if (canUpload) {
            uploadBtn.style.display = '';
          } else {
            // Hide button for users without upload permission
            uploadBtn.style.display = 'none';
          }
        }
      })
      .catch(function(error) {
        console.error('Error checking upload permissions:', error);
        // Default to hiding the button if there's an error
        const uploadBtn = document.getElementById('images-upload-btn');
        if (uploadBtn) {
          uploadBtn.style.display = 'none';
        }
      });
  }
  
  /**
   * Render the top section HTML (search, view toggle, actions, master checkbox)
   * @returns {string} HTML string
   */
  function renderTopSection() {
    return `
      <div class="p-4 bg-white border-b border-gray-200">
        <!-- Title -->
        <div class="mb-4">
          <h2 class="text-2xl font-bold text-gray-900">Imágenes</h2>
        </div>
        
        <!-- Controls Row -->
        <div class="flex items-center justify-between">
          <!-- Left Section: Master Checkbox + Search -->
          <div class="flex items-center space-x-4 w-1/2">
            <!-- Master Checkbox -->
            <div class="flex items-center">
              <input 
                type="checkbox" 
                id="images-master-checkbox"
                class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                title="Seleccionar/Deseleccionar todo"
              />
              <label for="images-master-checkbox" class="ml-2 text-sm text-gray-600 cursor-pointer">
                Todo
              </label>
            </div>
            
            <!-- Search Bar -->
            <div class="w-2/3">
              <div class="relative">
                <input 
                  type="text" 
                  id="images-search-input"
                  placeholder="Buscar por nombre, descripción o dimensiones..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Right Section: View Toggle + Actions -->
          <div class="flex items-center space-x-3">
            <!-- Bulk Delete Button (hidden by default) -->
            <button 
              id="images-bulk-delete-btn"
              class="hidden px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 items-center space-x-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              <span id="images-bulk-delete-text">Eliminar seleccionados</span>
            </button>

            <!-- Bulk copy links button-->
            <button
              id="get-images-links-btn"
              class="hidden px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 items-center space-x-2"
            >
            <span id="get-images-links-text">Copiar Enlaces</span>
            </button>
            
            <!-- View Toggle -->
            <div class="flex items-center bg-gray-100 rounded-md p-1">
              <button 
                id="images-view-gallery-btn"
                class="px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentView === 'gallery' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
                title="Vista de galería"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                </svg>
              </button>
              <button 
                id="images-view-list-btn"
                class="px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentView === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
                title="Vista de lista"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                </svg>
              </button>
            </div>
            
            <!-- Upload Button -->
            <button 
              id="images-upload-btn"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Subir imágenes
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Setup event handlers for top section
   */
  function setupTopSectionHandlers() {
    const searchInput = document.getElementById('images-search-input');
    const viewGalleryBtn = document.getElementById('images-view-gallery-btn');
    const viewListBtn = document.getElementById('images-view-list-btn');
    const masterCheckbox = document.getElementById('images-master-checkbox');
    const bulkDeleteBtn = document.getElementById('images-bulk-delete-btn');
    const bulkCopyUrlsBtn = document.getElementById('get-images-links-btn');
    const uploadBtn = document.getElementById('images-upload-btn');
    
    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        currentSearchTerm = e.target.value;
        loadImages();
      }, 300));
    }
    
    // View toggle buttons
    if (viewGalleryBtn) {
      viewGalleryBtn.addEventListener('click', () => {
        switchView('gallery');
      });
    }
    
    if (viewListBtn) {
      viewListBtn.addEventListener('click', () => {
        switchView('list');
      });
    }
    
    // Master checkbox
    if (masterCheckbox) {
      masterCheckbox.addEventListener('change', () => {
        handleMasterCheckboxChange();
      });
    }
    
    // Bulk delete button
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => {
        openBulkDeleteConfirmation();
      });
    }
    
    // Bulk copy selected images urls
    if (bulkCopyUrlsBtn) {
      bulkCopyUrlsBtn.addEventListener('click', () => {
        // TODO: Test over Https 
        bulkCopyImagesUrls();
      })
    }
    
    // Upload button
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        openUploadModal();
      });
    }
  }
  
  function bulkCopyImagesUrls() {
    ImageService.getImagesURLs(selectedImageIds)
        .then(response => {
          const imagesLinksMarkdown = response
              .map(image => {
                return `![Imagen](${image.url})`;
              })
              .join('\n');
          navigator.clipboard.writeText(imagesLinksMarkdown).catch();
        });
    
  }
  
  /**
   * Handle master checkbox change with smart toggle logic
   * - If at least one item is unselected, select ALL items
   * - If all items are already selected, deselect everything
   */
  function handleMasterCheckboxChange() {
    const allSelected = selectedImageIds.length === currentImages.length && currentImages.length > 0;
    const grid = contentSection.getAttachedObject();
    
    if (allSelected) {
      // Deselect all
      selectedImageIds = [];
      if (typeof(window.dhtmlXGridObject) == "function" && grid instanceof window.dhtmlXGridObject) {
        grid.uncheckAll();
      }
    } else {
      // Select all visible images
      selectedImageIds = currentImages.map(img => img.id);
      if (typeof(window.dhtmlXGridObject) == "function" && grid instanceof window.dhtmlXGridObject) {
        grid.checkAll();
      }
    }
    
    updateSelectionUI();
  }
  
  /**
   * Handle individual image checkbox change
   * @param {string} imageId - Image ID
   */
  function handleImageCheckboxChange(imageId) {
    const index = selectedImageIds.indexOf(imageId);
    
    if (index > -1) {
      selectedImageIds.splice(index, 1);
    } else {
      selectedImageIds.push(imageId);
    }
    
    updateSelectionUI();
  }
  
  /**
   * Update selection UI (master checkbox state, bulk delete button visibility)
   */
  function updateSelectionUI() {
    const masterCheckbox = document.getElementById('images-master-checkbox');
    const bulkDeleteBtn = document.getElementById('images-bulk-delete-btn');
    const bulkDeleteText = document.getElementById('images-bulk-delete-text');
    const bulkCopyUrlsBtn = document.getElementById('get-images-links-btn');
    const bulkCopyUrlsText = document.getElementById('get-images-links-text');
    
    const selectedCount = selectedImageIds.length;
    const totalCount = currentImages.length;
    
    // Update master checkbox state
    if (masterCheckbox) {
      if (selectedCount === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
      } else if (selectedCount === totalCount) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
      } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
      }
    }
    
    // Update bulk delete button
    if (bulkDeleteBtn) {
      if (selectedCount > 0) {
        bulkDeleteBtn.classList.remove('hidden');
        bulkDeleteBtn.classList.add('flex');
        if (bulkDeleteText) {
          bulkDeleteText.textContent = `Eliminar seleccionados (${selectedCount})`;
        }
      } else {
        bulkDeleteBtn.classList.add('hidden');
        bulkDeleteBtn.classList.remove('flex');
      }
    }
    
    if (bulkCopyUrlsBtn) {
      if (selectedCount > 0) {
        bulkCopyUrlsBtn.classList.remove('hidden');
        bulkCopyUrlsBtn.classList.add('flex');
        if (bulkCopyUrlsText) {
          bulkCopyUrlsText.textContent = `Copiar enlaces (${selectedCount})`;
        }
      } else {
        bulkCopyUrlsBtn.classList.add('hidden');
        bulkCopyUrlsBtn.classList.remove('flex');
      }
    }
    
    // Update individual checkboxes in gallery view
    if (currentView === 'gallery') {
      currentImages.forEach(image => {
        const isSelected = selectedImageIds.includes(image.id);
        ImagesGalleryViewUI.updateCheckboxState(image.id, isSelected);
      });
    }
  }
  
  /**
   * Switch between gallery and list views
   * @param {string} viewType - 'gallery' or 'list'
   */
  function switchView(viewType) {
    if (currentView === viewType) {
      return;
    }
    
    currentView = viewType;
    
    if (viewType === 'list') {
      // Detach gallery and attach grid view
      contentSection.detachObject(true);
      imagesGrid = ImagesGridHelper.initializeGrid(contentSection, handleImageSelect);
      loadImagesIntoGrid();
    } else {
      // Detach grid and attach gallery view
      if (imagesGrid) {
        imagesGrid.destructor();
        imagesGrid = null;
      }
      loadImages();
    }
    
    // Update button styles
    updateViewToggleButtons();
  }
  
  /**
   * Update view toggle button styles
   */
  function updateViewToggleButtons() {
    const viewGalleryBtn = document.getElementById('images-view-gallery-btn');
    const viewListBtn = document.getElementById('images-view-list-btn');
    
    if (viewGalleryBtn && viewListBtn) {
      if (currentView === 'gallery') {
        viewGalleryBtn.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
        viewGalleryBtn.classList.remove('text-gray-600');
        viewListBtn.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
        viewListBtn.classList.add('text-gray-600');
      } else {
        viewListBtn.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
        viewListBtn.classList.remove('text-gray-600');
        viewGalleryBtn.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
        viewGalleryBtn.classList.add('text-gray-600');
      }
    }
  }
  
  /**
   * Load images for the current company
   */
  function loadImages() {
    const dataPromise = currentSearchTerm 
      ? ImageService.searchImages(currentCompanyId, currentSearchTerm)
      : ImageService.getImages(currentCompanyId);
    
    dataPromise.then(images => {
      currentImages = images;
      
      // Clear selection when images change due to search
      if (currentSearchTerm) {
        // Keep only selections that are still in the filtered results
        selectedImageIds = selectedImageIds.filter(id => 
          images.some(img => img.id === id)
        );
      }
      
      if (currentView === 'gallery') {
        contentSection.attachHTMLString(ImagesGalleryViewUI.renderGalleryView(images, selectedImageIds));
        // Initialize lazy loading after rendering
        setTimeout(() => {
          ImagesGalleryViewUI.initializeLazyLoading();
        }, 100);
      } else if (currentView === 'list' && imagesGrid) {
        loadImagesIntoGrid();
      }
      
      updateSelectionUI();
    }).catch(error => {
      console.error('Error loading images:', error);
      dhtmlx.message({
        type: 'error',
        text: 'Error al cargar imágenes'
      });
    });
  }
  
  /**
   * Load images into the grid
   */
  function loadImagesIntoGrid() {
    if (imagesGrid) {
      ImagesGridHelper.loadImagesData(imagesGrid, currentCompanyId, currentSearchTerm);
    }
  }
  
  /**
   * Handle image selection (click on card)
   * @param {string} imageId - Selected image ID
   */
  function handleImageSelect(imageId) {
    console.log('Image selected:', imageId);
    // Open preview when clicking on the card
    openImagePreview(imageId);
  }
  
  /**
   * Open image preview modal
   * @param {string} imageId - Image ID to preview
   */
  function openImagePreview(imageId) {
    ImagePreviewModal.openPreview(imageId);
  }
  
  /**
   * Download image
   * @param {string} imageId - Image ID to download
   */
  function downloadImage(imageId) {
    ImageService.downloadImage(imageId)
      .then(() => {
        dhtmlx.message({
          type: 'success',
          text: 'Descargando imagen...'
        });
      })
      .catch(error => {
        console.error('Error downloading image:', error);
        dhtmlx.message({
          type: 'error',
          text: 'Error al descargar imagen'
        });
      });
  }
  
  /**
   * Open edit description modal
   * @param {string} imageId - Image ID to edit
   */
  function openEditDescriptionModal(imageId) {
    ImageMetadataEditorUI.openEditModal(imageId, (updatedImage) => {
      // Refresh images list after update
      refreshImagesList();
    });
  }
  
  /**
   * Delete a single image with confirmation
   * @param {string} imageId - Image ID to delete
   */
  function deleteSingleImage(imageId) {
    // Get image name for confirmation message
    ImageService.getImageById(imageId)
      .then(image => {
        if (!image) {
          dhtmlx.message({
            type: 'error',
            text: 'Imagen no encontrada'
          });
          return;
        }
        
        // Escape image name for display
        const escapedName = Utils.escapeHtml(image.name);
        
        showDeleteConfirmationModal(
          '¿Eliminar imagen?',
          `¿Estás seguro de que deseas eliminar "${escapedName}"?`,
          () => {
            ImageService.deleteImage(imageId)
              .then(() => {
                dhtmlx.message({
                  type: 'success',
                  text: 'Imagen eliminada correctamente'
                });
                
                // Remove from selection if selected
                const index = selectedImageIds.indexOf(imageId);
                if (index > -1) {
                  selectedImageIds.splice(index, 1);
                }
                
                refreshImagesList();
              })
              .catch(error => {
                console.error('Error deleting image:', error);
                dhtmlx.message({
                  type: 'error',
                  text: 'Error al eliminar imagen'
                });
              });
          }
        );
      });
  }
  
  /**
   * Open bulk delete confirmation modal
   */
  function openBulkDeleteConfirmation() {
    if (selectedImageIds.length === 0) {
      dhtmlx.message({
        type: 'info',
        text: 'No hay imágenes seleccionadas'
      });
      return;
    }
    
    showDeleteConfirmationModal(
      '¿Eliminar imágenes seleccionadas?',
      `¿Estás seguro de que deseas eliminar ${selectedImageIds.length} imagen${selectedImageIds.length > 1 ? 'es' : ''}? Esta acción no se puede deshacer.`,
      () => {
        executeBulkDelete();
      }
    );
  }
  
  /**
   * Execute bulk delete operation
   */
  function executeBulkDelete() {
    ImageService.bulkDeleteImages(selectedImageIds)
      .then(result => {
        dhtmlx.message({
          type: 'success',
          text: `${result.deletedCount} imagen${result.deletedCount > 1 ? 'es eliminadas' : ' eliminada'} correctamente`
        });
        
        // Clear selection
        selectedImageIds = [];
        
        refreshImagesList();
      })
      .catch(error => {
        console.error('Error bulk deleting images:', error);
        dhtmlx.message({
          type: 'error',
          text: 'Error al eliminar imágenes'
        });
      });
  }
  
  /**
   * Show delete confirmation modal
   * @param {string} title - Modal title
   * @param {string} message - Confirmation message
   * @param {Function} onConfirm - Callback when confirmed
   */
  function showDeleteConfirmationModal(title, message, onConfirm) {
    // Create modal HTML
    const modalHTML = `
      <div 
        id="delete-confirmation-modal" 
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50"
        onclick="ImagesTabManager.closeDeleteConfirmationModal(event)"
      >
        <div 
          class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
          onclick="event.stopPropagation()"
        >
          <!-- Header -->
          <div class="px-6 py-4 bg-red-50 border-b border-red-100">
            <div class="flex items-center space-x-3">
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
            </div>
          </div>
          
          <!-- Body -->
          <div class="px-6 py-4">
            <p class="text-gray-600">${message}</p>
          </div>
          
          <!-- Footer -->
          <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button 
              onclick="ImagesTabManager.closeDeleteConfirmationModal()"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button 
              id="delete-confirm-btn"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Append to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add confirm button handler
    const confirmBtn = document.getElementById('delete-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        closeDeleteConfirmationModal();
        onConfirm();
      });
    }
    
    // Add keyboard listener for ESC
    document.addEventListener('keydown', handleDeleteModalKeyDown);
  }
  
  /**
   * Handle keyboard events for delete modal
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleDeleteModalKeyDown(event) {
    if (event.key === 'Escape') {
      closeDeleteConfirmationModal();
    }
  }
  
  /**
   * Close delete confirmation modal
   * @param {Event} event - Optional click event
   */
  function closeDeleteConfirmationModal(event) {
    if (event && event.target.id !== 'delete-confirmation-modal') {
      return;
    }
    
    const modal = document.getElementById('delete-confirmation-modal');
    if (modal) {
      modal.remove();
    }
    
    document.removeEventListener('keydown', handleDeleteModalKeyDown);
  }
  
  /**
   * Open image upload modal
   */
  function openUploadModal() {
    ImageUploadUI.openUploadModal(currentCompanyId, (uploadedImages) => {
      // Reset selection state after upload
      selectedImageIds = [];
      
      // Reset master checkbox
      const masterCheckbox = document.getElementById('images-master-checkbox');
      if (masterCheckbox) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
      }
      
      // Hide bulk delete button
      const bulkDeleteBtn = document.getElementById('images-bulk-delete-btn');
      if (bulkDeleteBtn) {
        bulkDeleteBtn.classList.add('hidden');
        bulkDeleteBtn.classList.remove('flex');
      }
      
      // Refresh images gallery
      refreshImagesList();
    });
  }
  
  /**
   * Refresh images list
   */
  function refreshImagesList() {
    loadImages();
  }
  
  /**
   * Update company ID and reload images
   * @param {string} companyId - New company ID
   */
  function updateCompany(companyId) {
    currentCompanyId = companyId;
    currentSearchTerm = '';
    selectedImageIds = [];
    
    // Clear search input
    const searchInput = document.getElementById('images-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    loadImages();
  }
  
  // Public API
  return {
    initializeImagesTab,
    updateCompany,
    refreshImagesList,
    handleImageSelect,
    handleImageCheckboxChange,
    openImagePreview,
    downloadImage,
    openEditDescriptionModal,
    deleteSingleImage,
    closeDeleteConfirmationModal,
    openUploadModal
  };
})();

// Make it globally accessible for inline event handlers
window.ImagesTabManager = ImagesTabManager;
