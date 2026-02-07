/**
 * Files Tab Manager
 * Main controller for the Files tab functionality
 * Integrates grid view, card view, upload, and metadata editing
 */

const FilesTabManager = (function() {
  'use strict';
  
  // State management
  let currentView = 'list'; // 'list' or 'card'
  let currentCompanyId = null;
  let filesGrid = null;
  let filesCell = null;
  let filesLayout = null;
  let contentSection = null;
  let currentSearchTerm = '';
  let selectedFileIds = [];
  
  /**
   * Initialize the Files tab
   * @param {Object} tabCell - DHTMLX tab cell for files
   * @param {string} companyId - Current company ID
   */
  function initializeFilesTab(tabCell, companyId) {
    currentCompanyId = companyId;
    filesCell = tabCell;
    
    // Create layout for files tab
    filesLayout = tabCell.attachLayout('2E');
    
    // Top section - Toolbar and search
    const topSection = filesLayout.cells('a');
    topSection.hideHeader();
    topSection.setHeight(120);
    topSection.fixSize(0, 1);
    
    // Bottom section - Files display (grid or card view)
    contentSection = filesLayout.cells('b');
    contentSection.hideHeader();
    
    // Attach top section content
    topSection.attachHTMLString(renderTopSection());
    
    // Initialize with list view by default
    filesGrid = FilesGridHelper.initializeGrid(contentSection, handleFileSelect);
    
    // Setup event handlers
    setTimeout(() => {
      setupTopSectionHandlers();
      loadFiles();
      
      // Apply permission-based visibility
      applyUploadPermissions();
    }, 100);
    
    return {
      filesLayout,
      filesGrid,
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
        const uploadBtn = document.getElementById('files-upload-btn');
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
        const uploadBtn = document.getElementById('files-upload-btn');
        if (uploadBtn) {
          uploadBtn.style.display = 'none';
        }
      });
  }
  
  /**
   * Render the top section HTML (search, view toggle, actions)
   * @returns {string} HTML string
   */
  function renderTopSection() {
    return `
      <div class="p-4 bg-white border-b border-gray-200">
        <!-- Title -->
        <div class="mb-4">
          <h2 class="text-2xl font-bold text-gray-900">Archivos</h2>
        </div>
        
        <!-- Controls Row -->
        <div class="flex items-center justify-between">
          <!-- Search Bar -->
          <div class="flex-1 w-full">
            <div class="relative">
              <input 
                type="text" 
                id="files-search-input"
                placeholder="Buscar archivos..."
                class="w-1/3 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <!-- View Toggle and Actions -->
          <div class="flex items-center space-x-3">
            <!-- View Toggle -->
            <div class="flex items-center bg-gray-100 rounded-md p-1">
              <button 
                id="files-view-card-btn"
                class="px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentView === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
                title="Vista de tarjetas"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                </svg>
              </button>
              <button 
                id="files-view-list-btn"
                class="px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentView === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
                title="Vista de lista"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                </svg>
              </button>
            </div>
            
            <!-- Action Buttons -->
            <button 
              id="files-upload-btn"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Subir archivo
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
    const searchInput = document.getElementById('files-search-input');
    const viewCardBtn = document.getElementById('files-view-card-btn');
    const viewListBtn = document.getElementById('files-view-list-btn');
    const uploadBtn = document.getElementById('files-upload-btn');
    
    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        currentSearchTerm = e.target.value;
        loadFiles();
      }, 300));
    }
    
    // View toggle buttons
    if (viewCardBtn) {
      viewCardBtn.addEventListener('click', () => {
        switchView('card');
      });
    }
    
    if (viewListBtn) {
      viewListBtn.addEventListener('click', () => {
        switchView('list');
      });
    }
    
    // Upload button
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        openUploadModal();
      });
    }
  }
  
  /**
   * Switch between list and card views
   * @param {string} viewType - 'list' or 'card'
   */
  function switchView(viewType) {
    if (currentView === viewType) {
      return;
    }
    
    currentView = viewType;
    
    if (viewType === 'card') {
      // Detach grid and attach card view
      if (filesGrid) {
        filesGrid.destructor();
        filesGrid = null;
      }
      
      // Load files and render card view
      const dataPromise = currentSearchTerm 
        ? FileService.searchFiles(currentCompanyId, currentSearchTerm)
        : FileService.getFiles(currentCompanyId);
      
      dataPromise.then(files => {
        contentSection.attachHTMLString(FilesCardViewUI.renderCardView(files));
      });
      
    } else {
      // Attach grid view
      contentSection.detachObject(true);
      filesGrid = FilesGridHelper.initializeGrid(contentSection, handleFileSelect);
      loadFiles();
    }
    
    // Update button styles
    updateViewToggleButtons();
  }
  
  /**
   * Update view toggle button styles
   */
  function updateViewToggleButtons() {
    const viewCardBtn = document.getElementById('files-view-card-btn');
    const viewListBtn = document.getElementById('files-view-list-btn');
    
    if (viewCardBtn && viewListBtn) {
      if (currentView === 'card') {
        viewCardBtn.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
        viewCardBtn.classList.remove('text-gray-600');
        viewListBtn.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
        viewListBtn.classList.add('text-gray-600');
      } else {
        viewListBtn.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
        viewListBtn.classList.remove('text-gray-600');
        viewCardBtn.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
        viewCardBtn.classList.add('text-gray-600');
      }
    }
  }
  
  /**
   * Load files for the current company
   */
  function loadFiles() {
    if (currentView === 'list' && filesGrid) {
      FilesGridHelper.loadFilesData(filesGrid, currentCompanyId, currentSearchTerm);
    } else if (currentView === 'card' && contentSection) {
      const dataPromise = currentSearchTerm 
        ? FileService.searchFiles(currentCompanyId, currentSearchTerm)
        : FileService.getFiles(currentCompanyId);
      
      dataPromise.then(files => {
        contentSection.attachHTMLString(FilesCardViewUI.renderCardView(files));
      });
    }
  }
  
  /**
   * Handle file selection
   * @param {string} fileId - Selected file ID
   */
  function handleFileSelect(fileId) {
    console.log('File selected:', fileId);
    // TODO: Show file details in sidebar or modal
  }
  
  /**
   * Handle file checkbox change
   * @param {string} fileId - File ID
   */
  function handleFileCheckboxChange(fileId) {
    const index = selectedFileIds.indexOf(fileId);
    if (index > -1) {
      selectedFileIds.splice(index, 1);
    } else {
      selectedFileIds.push(fileId);
    }
    console.log('Selected files:', selectedFileIds);
  }
  
  /**
   * Open upload modal
   */
  function openUploadModal() {
    FileUploadUI.openUploadModal(currentCompanyId, (uploadedFiles) => {
      // Refresh files list after upload
      refreshFilesList();
    });
  }
  
  /**
   * Open edit description modal
   * @param {string} fileId - File ID to edit
   */
  function openEditDescriptionModal(fileId) {
    FileMetadataEditorUI.openEditModal(fileId, (updatedFile) => {
      // Refresh files list after update
      refreshFilesList();
    });
  }
  
  /**
   * Refresh files list
   */
  function refreshFilesList() {
    loadFiles();
  }
  
  /**
   * Update company ID and reload files
   * @param {string} companyId - New company ID
   */
  function updateCompany(companyId) {
    currentCompanyId = companyId;
    currentSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('files-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    loadFiles();
  }
  
  /**
   * Debounce function for search input
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  // Public API
  return {
    initializeFilesTab,
    updateCompany,
    refreshFilesList,
    openUploadModal,
    openEditDescriptionModal,
    handleFileSelect,
    handleFileCheckboxChange
  };
})();

// Make it globally accessible for inline event handlers
window.FilesTabManager = FilesTabManager;
