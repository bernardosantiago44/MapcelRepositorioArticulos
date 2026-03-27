/**
 * Files Tab Manager
 * Main controller for the Files tab functionality
 * Integrates grid view, card view, upload, and metadata editing
 */

const FilesTabManager = (function() {
  'use strict';
  
  // State management
  let currentView = 'list'; // 'list' or 'card'
  let currentCompanyCode = null;
  let filesGrid = null;
  let filesCell = null;
  let filesLayout = null;
  let contentSection = null;
  let filesContentLayout = null;
  let filesDataCell = null;
  let filesPaginationCell = null;
  let currentSearchTerm = '';
  let selectedFileIds = [];
  let currentPagination = { page: 1, pageSize: PaginationShared.DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 };
  
  /**
   * Initialize the Files tab
   * @param {Object} tabCell - DHTMLX tab cell for files
   * @param {string} companyCode - Current company code
   * @param {number} initialPage - Initial page to load
   */
  function initializeFilesTab(tabCell, companyCode, initialPage) {
    currentCompanyCode = companyCode;
    filesCell = tabCell;
    if (!isNaN(initialPage) && initialPage > 0) {
      currentPagination.page = initialPage;
    }
    if (window.appState && window.appState.tabPagination && window.appState.tabPagination.files) {
      currentPagination.pageSize = window.appState.tabPagination.files.pageSize || PaginationShared.DEFAULT_PAGE_SIZE;
    }
    
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
    filesContentLayout = contentSection.attachLayout('2E');
    filesDataCell = filesContentLayout.cells('a');
    filesDataCell.hideHeader();
    filesPaginationCell = filesContentLayout.cells('b');
    filesPaginationCell.setHeight(56);
    filesPaginationCell.hideHeader();
    filesPaginationCell.fixSize(0, 1);
    filesPaginationCell.attachHTMLString('<div id="files-pagination" class="h-full w-full"></div>');
    
    // Attach top section content
    topSection.attachHTMLString(renderTopSection());
    
    // Initialize with list view by default
    filesGrid = FilesGridHelper.initializeGrid(filesDataCell, handleFileSelect);
    
    // Setup event handlers
    setTimeout(() => {
      setupTopSectionHandlers();
      loadFiles(currentPagination.page);
      
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
    if (typeof AdminUploadOverride !== 'undefined') {
      return;
    }
    
    // Check if company is selected
    if (!currentCompanyCode) {
      return;
    }
    
    // For regular users, check company settings
    CompanyService.canUsersUpload(currentCompanyCode)
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
      loadFiles(currentPagination.page);
      
    } else {
      // Attach grid view
      filesDataCell.detachObject(true);
      filesGrid = FilesGridHelper.initializeGrid(filesDataCell, handleFileSelect);
      loadFiles(currentPagination.page);
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
  function loadFiles(requestedPage) {
    const targetPage = requestedPage || currentPagination.page || 1;
    const targetPageSize = currentPagination.pageSize || PaginationShared.DEFAULT_PAGE_SIZE;
    const dataPromise = currentSearchTerm
      ? FileService.searchFiles(currentCompanyCode, currentSearchTerm).then(function(files) {
          const totalPages = Math.max(1, Math.ceil(files.length / targetPageSize));
          const safePage = PaginationShared.normalizePageNumber(targetPage, totalPages);
          const startIndex = (safePage - 1) * targetPageSize;
          const pageItems = files.slice(startIndex, startIndex + targetPageSize);
          return {
            data: pageItems,
            page: safePage,
            pageSize: targetPageSize,
            total: files.length,
            totalPages: totalPages
          };
        })
      : FileService.getFilesPagedResult(currentCompanyCode, targetPage, targetPageSize);

    dataPromise.then(function(result) {
      const files = result.data || [];
      currentPagination = {
        page: PaginationShared.normalizePageNumber(result.page || targetPage, result.totalPages || 1),
        pageSize: result.pageSize || targetPageSize,
        total: result.total || files.length,
        totalPages: result.totalPages || Math.max(1, Math.ceil((result.total || files.length) / (result.pageSize || targetPageSize)))
      };
      if (window.appState && window.appState.tabPagination && window.appState.tabPagination.files) {
        window.appState.tabPagination.files = currentPagination;
      }
      PaginationShared.renderPagination('files-pagination', currentPagination, handleFilesPageChange);
      if (window.appState && window.appState.activeTab === 'files') {
        PaginationShared.updateUrlState({
          tab: 'files',
          page: currentPagination.page,
          pageSize: currentPagination.pageSize
        });
      }

      if (currentView === 'list' && filesGrid) {
        FilesGridHelper.loadFilesData(filesGrid, currentCompanyCode, currentSearchTerm, { data: files });
      } else if (currentView === 'card' && filesDataCell) {
        filesDataCell.attachHTMLString(FilesCardViewUI.renderCardView(files));
      }
    }).catch(function(error) {
      console.error('Error loading files:', error);
      dhtmlx.message({
        type: 'error',
        text: 'Error al cargar archivos: ' + error.message
      });
    });
  }

  function handleFilesPageChange(nextPage) {
    const safePage = PaginationShared.normalizePageNumber(nextPage, currentPagination.totalPages);
    if (safePage === currentPagination.page) return;
    loadFiles(safePage);
  }
  
  /**
   * Handle file selection
   * @param {string} fileId - Selected file ID
   */
  function handleFileSelect(fileId) {
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
  }
  
  /**
   * Open upload modal
   */
  function openUploadModal() {
    FileUploadUI.openUploadModal(currentCompanyCode, (uploadedFiles) => {
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
   * Update company code and reload files
   * @param {string} companyCode - New company code
   */
  function updateCompany(companyCode) {
    currentCompanyCode = companyCode;
    currentSearchTerm = '';
    currentPagination = { page: 1, pageSize: PaginationShared.DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 };
    
    // Clear search input
    const searchInput = document.getElementById('files-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    loadFiles(1);
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
    handleFileCheckboxChange,
    goToPage: loadFiles
  };
})();

// Make it globally accessible for inline event handlers
window.FilesTabManager = FilesTabManager;
