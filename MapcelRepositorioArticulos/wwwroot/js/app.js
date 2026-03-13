/**
 * Articles Repository Application - Main Entry Point
 * DHTMLX 5.x Legacy API Implementation
 * 
 * Dependencies (must be loaded in order):
 * - dataModels.js
 * - articleService.js
 * - userService.js
 * - articleDetailUI.js
 * - articlesGridHelper.js
 */

window.dhx4.skin = 'material';

// ============================================================================
// Layout Configuration Constants
// ============================================================================

const GRID_SIDEBAR_ASPECT_WIDTH = 0.45;
const window_width = window.innerWidth;

var LAYOUT_CONFIG = {
  HEADER_HEIGHT: '110',
  FILTERS_SECTION_HEIGHT: '120',
  SIDEBAR_WIDTH: `${GRID_SIDEBAR_ASPECT_WIDTH * window_width}`,
};

// ============================================================================
// Global State Management
// ============================================================================

var appState = {
  currentUser: null,
  selectedCompanyCode: null,
  selectedArticleId: null,
  articlesGrid: null,
  companyCombo: null,
  sidebarCell: null,
  filesTab: null,
  filesTabInitialized: false,
  // New filter-related state
  allArticles: [],           // All articles for the current company (unfiltered)
  filteredArticles: [],      // Filtered articles displayed in grid
  filterForm: null,          // DHTMLX Form for filters
  statusCombo: null,         // Status filter combo
  startDateCalendar: null,   // Start date calendar
  endDateCalendar: null,     // End date calendar
  selectedFilterTags: [],    // Tags selected for filtering
  // View state for articles tab
  currentArticlesView: 'grid',  // 'grid' or 'new-article'
  articlesLayoutCache: null     // Cache for the articles layout when showing new article page
};

// ============================================================================
// Main Layout Structure
// ============================================================================

var main_layout = new dhtmlXLayoutObject(document.body, '2E');

// Header Section
var header = main_layout.cells('a');
header.setHeight(LAYOUT_CONFIG.HEADER_HEIGHT);
header.fixSize(0, 1);

var header_stack = header.attachLayout('2U');

// Header Left - Application Title
var header_leading = header_stack.cells('a');
header_leading.hideHeader();
header_leading.fixSize(1, 0);
header_leading.attachHTMLString(`
  <div class="h-full w-full flex items-center justify-between px-4">
    <div>
      <div class="text-lg font-semibold">Repositorio de Artículos</div>
      <div class="text-xs text-gray-500">Gestión de artículos</div>
    </div>
  </div>
`);

// Header Right - Toolbar
var header_trailing = header_stack.cells('b');
header_trailing.hideHeader();
header_trailing.fixSize(1, 0);

var header_toolbar = header_trailing.attachToolbar();
header_toolbar.setIconsPath('/Dhtmlx/codebase/imgs/');
header_toolbar.addButton('new_article', 1, 'Nuevo artículo');
header_toolbar.addButton('edit_company', 2, 'Editar Compañía');

// Toolbar Click Handler
header_toolbar.attachEvent('onClick', function(id) {
  if (id === 'new_article') {
    openNewArticleForm();
  } else if (id === 'edit_company') {
    openCompanySettingsForm();
  }
});

main_layout.setSizes();

// ============================================================================
// Main Content - Tabbar
// ============================================================================

var main_content = main_layout.cells('b');
var tabbar = main_content.attachTabbar();

// Articles Tab
tabbar.addTab('articles', 'Artículos');
var articles = tabbar.cells('articles');
articles.setActive();

// Create layout for articles tab with sidebar: Filters (top), Grid (center), Sidebar (right)
var articles_layout = articles.attachLayout('2E');

// ============================================================================
// Filters Section (Top)
// ============================================================================

var filters_container = articles_layout.cells('a');
filters_container.setHeight(LAYOUT_CONFIG.FILTERS_SECTION_HEIGHT);
filters_container.hideHeader();
filters_container.fixSize(0, 1);
filters_container.setHeight(90);

// ============================================================================
// Grid Section (Center) and Sidebar (Right)
// ============================================================================

var grid_sidebar_layout = articles_layout.cells('b');
grid_sidebar_layout.hideHeader();

// Grid Toolbar Area (various actions)
var grid_toolbar = grid_sidebar_layout.attachToolbar();
grid_toolbar.setIconsPath('/Dhtmlx/codebase/imgs/');
grid_toolbar.addSeparator('sep_bulk', 1);
grid_toolbar.addButton('bulk_edit_tags', 2, 'Editar Etiquetas (Selección)');
grid_toolbar.addSeparator('sep_clear', 3);
grid_toolbar.addButton('manage_tags', 4, 'Administrar Etiquetas');

grid_toolbar.setItemToolTip('manage_tags', 'Administrar las etiquetas de la empresa');
grid_toolbar.setItemToolTip('bulk_edit_tags', 'Editar etiquetas de los artículos seleccionados');

grid_toolbar.attachEvent('onClick', function(id) {
  if (id === 'manage_tags') {
    openTagManager();
  } else if (id === 'bulk_edit_tags') {
    openBulkTagEditor();
  }
});

// Split into grid and sidebar
var grid_sidebar_split = grid_sidebar_layout.attachLayout('2U');

// Grid Cell
var grid_cell = grid_sidebar_split.cells('a');
grid_cell.hideHeader();

// Sidebar Cell
var sidebar_cell = grid_sidebar_split.cells('b');
sidebar_cell.setWidth(LAYOUT_CONFIG.SIDEBAR_WIDTH);
sidebar_cell.hideHeader();
sidebar_cell.fixSize(0, 0);
appState.sidebarCell = sidebar_cell;

// Show empty state initially
sidebar_cell.attachHTMLString(ArticleDetailUI.renderEmptyState());

// ============================================================================
// Other Tabs (Placeholder)
// ============================================================================

tabbar.addTab('files', 'Archivos');
var files = tabbar.cells('files');

tabbar.addTab('images', 'Imágenes');
var images = tabbar.cells('images');

// Store global reference to files tab for later initialization
appState.filesTab = files;
// Store global reference to images tab for later initialization
appState.imagesTab = images;
appState.imagesTabInitialized = false;

// ============================================================================
// Initialize Application
// ============================================================================

/**
 * Initialize the application on load
 */
function initializeApplication() {
  main_content.progressOn();
  
  appState.currentUser = UserService.getCurrentUser();
  
  // Derive companyCode from URL path
  var companyCodeFromUrl = CompanyRouting.getCompanyCodeFromUrl();
  
  if (companyCodeFromUrl) {
    appState.selectedCompanyCode = companyCodeFromUrl;
    initializeAppForCompany(companyCodeFromUrl);
  } else {
    // No companyCode in URL - check if admin with company picker
    if (typeof AdminCompanyPicker !== 'undefined') {
      initializeAdminCompanySelection();
    } else {
      main_content.progressOff();
      dhtmlx.alert({
        title: 'Error',
        text: 'No se encontró un identificador de empresa en la URL.'
      });
    }
  }
}

/**
 * Initialize admin company selection when no companyCode is in the URL.
 * Redirects to the first available company.
 */
function initializeAdminCompanySelection() {
  CompanyService.getAllCompanies()
    .then(function(companies) {
      if (companies.length === 0) {
        throw new Error('No companies found');
      }
      // Navigate to the first company's URL
      CompanyRouting.navigateToCompany(companies[0].companyCode);
    })
    .catch(function(error) {
      console.error('Error loading companies:', error);
      main_content.progressOff();
      dhtmlx.alert({
        title: 'Error',
        text: 'Error al cargar datos: ' + error.message
      });
    });
}

/**
 * Initialize the application for a specific company.
 * Handles both admin and regular user views based on injected admin components.
 * @param {string} companyCode - The company code derived from the URL
 */
function initializeAppForCompany(companyCode) {
  // Hide admin-only toolbar buttons if the admin components are not injected
  if (typeof AdminNewArticleButton === 'undefined') {
    header_toolbar.hideItem('new_article');
  }
  if (typeof AdminEditCompanyButton === 'undefined') {
    header_toolbar.hideItem('edit_company');
  }
  if (typeof AdminManageTagsButton === 'undefined') {
    grid_toolbar.hideItem('manage_tags');
  }
  if (typeof AdminBulkEditTagsButton === 'undefined') {
    grid_toolbar.hideItem('bulk_edit_tags');
    grid_toolbar.hideItem('sep_bulk');
  }
  
  // Fetch company to sync internal table
  CompanyService.getCompanyByCode(companyCode);
  
  // Build filter + header UI
  if (typeof AdminCompanyPicker !== 'undefined') {
    CompanyService.getAllCompanies()
      .then(function(companies) {
        createGridFilters(companies);
        var companyCombo = createCompanyComboOptions(companies);
        header_trailing.attachHTMLString(companyCombo);
        
        // Pre-select current company in the dropdown
        var companySelect = document.getElementById('filter-company');
        if (companySelect) {
          companySelect.value = companyCode;
        }
      })
      .catch(function(error) {
        console.error('Error loading companies for picker:', error);
      });
  } else {
    createFilterFormForRegularUser();
    CompanyService.getCompanyByCode(companyCode)
      .then(function(company) {
        if (company) {
          var companyTitleHtml = createCompanyTitleHtml(company.name);
          header_trailing.attachHTMLString(companyTitleHtml);
        }
      });
  }
  
  // Load articles
  loadArticlesForCompany(companyCode)
    .catch(function(error) {
      console.error('Error initializing app for company:', error);
      main_content.progressOff();
      dhtmlx.alert({
        title: 'Error',
        text: 'Error al cargar artículos: ' + error.message
      });
    });
}

/**
 * Create and configure the advanced filter controls
 * No admin company picker or admin-specific controls
 * @param {Array<Company>} companies - List of companies
 */
function createGridFilters(companies) {
  // Create HTML container for all filters
  const filterHtml = createFilterContainerHtml(companies);
  filters_container.attachHTMLString(filterHtml);
  
  // Initialize all filter controls after DOM is ready
  requestAnimationFrame(function() {
    initializeFilterControls(companies, typeof AdminCompanyPicker !== 'undefined');
  });
}

/**
 * Create filter form for regular users (no company picker)
 */
function createFilterFormForRegularUser() {
  // Create HTML container for filters (without company picker)
  var filterHtml = createFilterContainerHtml(null);
  filters_container.attachHTMLString(filterHtml);
  
  // Initialize filter controls after DOM is ready
  requestAnimationFrame(function() {
    initializeFilterControls(null, false);
  });
}

/**
 * Creates a default company select menu.
 * @param companies
 * @return {string} Complete HTML for the menu.
 */
function createCompanyComboOptions(companies) {
  var companyPickerHtml = '';
if (companies && companies.length > 0) {
    var optionsHtml = companies.map(function(company, index) {
      return '<option value="' + company.companyCode + '"' + (index === 0 ? ' selected' : '') + '>' + company.name + '</option>';
    }).join('');
    
    companyPickerHtml = '<div class="p-4 space-y-3">' +
      '<div class="flex items-center gap-2">' +
        '<label class="text-sm font-medium text-gray-700 whitespace-nowrap">Empresa:</label>' +
        '<select id="filter-company" class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[200px]">' +
          optionsHtml +
        '</select>' +
      '</div>' +
    '</div>';
  } else {
    companyPickerHtml = '<div class="p-4 space-y-3">' +
      '<div class="flex items-center gap-2">' +
        '<span class="text-sm text-gray-500 italic">Vista de usuario regular</span>' +
      '</div>' +
    '</div>';
  }
  return companyPickerHtml;
}

function createCompanyTitleHtml(companyName) {
  return '<div class="p-4 space-y-3">' +
    '<div class="flex items-center gap-2">' +
      '<span class="text-sm text-gray-700 font-medium">Empresa: ' + companyName + '</span>' +
    '</div>' +
  '</div>';
}

/**
 * Create the HTML for the filter container
 * @param {Array<Company>|null} companies - Companies array for admin, null for regular users
 * @returns {string} HTML string for filter container
 */
function createFilterContainerHtml(companies) {
  return '<div class="p-4 space-y-3">' +
    '<div class="flex flex-wrap items-center gap-4">' +
      '<div class="flex items-center gap-2">' +
        '<label class="text-sm font-medium text-gray-700 whitespace-nowrap">Buscar:</label>' +
        '<input type="text" id="filter-search" placeholder="Buscar en título, descripción, comentarios, etiquetas..." ' +
               'class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[320px]" />' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
        '<label class="text-sm font-medium text-gray-700 whitespace-nowrap">Estado:</label>' +
        '<select id="filter-status" class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">' +
          '<option value="">Todos</option>' +
          '<option value="Producción">Producción</option>' +
          '<option value="Borrador">Borrador</option>' +
          '<option value="Cerrado">Cerrado</option>' +
        '</select>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
        '<label class="text-sm font-medium text-gray-700 whitespace-nowrap">Etiquetas:</label>' +
        '<button id="filter-tags-btn" class="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm flex items-center gap-2">' +
          '<span id="filter-tags-count">Todas</span>' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
      '<button id="clear_filters" class="inline-block rounded bg-sky-500 text-neutral-50 shadow-blue-950 hover:bg-sky-600 hover:shadow-blue-950 focus:bg-sky-800 focus:shadow-blue-950 active:bg-sky-700 active:shadow-sky-950 px-6 pb-2 pt-2.5 text-xs font-medium uppercase leading-normal transition duration-150 ease-in-out focus:outline-none focus:ring-0" onclick="clearAllFilters()">Limpiar filtros</button>' +
      '</div>' +
      '<div id="filter-active-indicator" style="display: none;" class="text-sm text-blue-600 font-medium">' +
        '● Filtros activos' +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * Initialize filter controls and attach event listeners
 * @param {Array<Company>|null} companies - Companies array for admin
 * @param {boolean} showCompanyPicker - Whether to show the company picker control
 */
function initializeFilterControls(companies, showCompanyPicker) {
  // Company picker (admin only)
  if (showCompanyPicker && companies) {
    var companySelect = document.getElementById('filter-company');
    if (companySelect) {
      companySelect.addEventListener('change', function() {
        onCompanyChange(companySelect.value);
      });
    }
  }
  
  // Search input with debounce
  var searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      GridFilterService.setSearchQuery(searchInput.value, applyFiltersToGrid);
    });
  }
  
  // Status filter
  var statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', function() {
      GridFilterService.setStatusFilter(statusSelect.value || null);
      applyFiltersToGrid();
    });
  }
  
  // Date filters
  var startDateInput = document.getElementById('filter-date-start');
  var endDateInput = document.getElementById('filter-date-end');
  
  if (startDateInput) {
    startDateInput.addEventListener('change', function() {
      var endDate = endDateInput ? endDateInput.value : null;
      GridFilterService.setDateRangeFilter(startDateInput.value || null, endDate || null);
      applyFiltersToGrid();
    });
  }
  
  if (endDateInput) {
    endDateInput.addEventListener('change', function() {
      var startDate = startDateInput ? startDateInput.value : null;
      GridFilterService.setDateRangeFilter(startDate || null, endDateInput.value || null);
      applyFiltersToGrid();
    });
  }
  
  // Tag filter button
  var tagsBtn = document.getElementById('filter-tags-btn');
  if (tagsBtn) {
    tagsBtn.addEventListener('click', function() {
      openTagFilterPicker();
    });
  }
  
  // Initialize the filter active indicator to hidden state
  updateFilterActiveIndicator();
}

/**
 * Open the tag picker for filtering
 */
function openTagFilterPicker() {
  if (!appState.selectedCompanyCode) {
    return;
  }
  
  TagPickerUI.openTagPicker(
    appState.selectedCompanyCode,
    appState.selectedFilterTags.map(function(tag) { return tag.id; }),
    function(selectedTags) {
      appState.selectedFilterTags = selectedTags;
      
      // Update the button text
      var tagsCountSpan = document.getElementById('filter-tags-count');
      if (tagsCountSpan) {
        if (selectedTags.length === 0) {
          tagsCountSpan.textContent = 'Todas';
        } else {
          tagsCountSpan.textContent = selectedTags.length + ' seleccionada' + (selectedTags.length !== 1 ? 's' : '');
        }
      }
      
      // Update filter service and apply
      GridFilterService.setTagFilter(selectedTags.map(function(tag) { return tag.id; }));
      applyFiltersToGrid();
    }
  );
}

/**
 * Apply current filters to the grid
 */
function applyFiltersToGrid() {
  if (!appState.allArticles) {
    return;
  }
  
  // Filter articles
  appState.filteredArticles = GridFilterService.filterArticles(appState.allArticles);
  
  // Update filter active indicator
  updateFilterActiveIndicator();
  
  // Rebuild grid with filtered articles
  buildGridWithArticles(appState.filteredArticles);
}

/**
 * Update the filter active indicator visibility
 */
function updateFilterActiveIndicator() {
  var indicator = document.getElementById('filter-active-indicator');
  if (indicator) {
    if (GridFilterService.hasActiveFilters()) {
      indicator.style.display = 'block';
    } else {
      indicator.style.display = 'none';
    }
  }
}

/**
 * Rebuild the grid with a new set of articles
 * @param {Array<Object>} articles - Articles to display
 */
function buildGridWithArticles(articles) {
  // Destroy existing grid
  if (appState.articlesGrid) {
    appState.articlesGrid.destructor();
    appState.articlesGrid = null;
  }
  
  // Initialize new grid with articles
  appState.articlesGrid = initializeArticlesGrid(grid_cell, articles);
  
  // Attach row selection event
  appState.articlesGrid.attachEvent('onRowSelect', function(rowId) {
    onArticleSelect(rowId, appState.selectedCompanyCode);
  });
  
  // Clear sidebar if the selected article is no longer visible
  if (appState.selectedArticleId) {
    var stillVisible = articles.some(function(article) {
      return article.id === appState.selectedArticleId;
    });
    
    if (!stillVisible) {
      appState.selectedArticleId = null;
      appState.sidebarCell.attachHTMLString(ArticleDetailUI.renderEmptyState());
    }
  }
}

/**
 * Clear all filters and reset the grid
 */
function clearAllFilters() {
  // Clear filter service state
  GridFilterService.clearAllFilters();
  appState.selectedFilterTags = [];
  
  // Reset UI controls
  var searchInput = document.getElementById('filter-search');
  if (searchInput) searchInput.value = '';
  
  var statusSelect = document.getElementById('filter-status');
  if (statusSelect) statusSelect.value = '';
  
  var startDateInput = document.getElementById('filter-date-start');
  if (startDateInput) startDateInput.value = '';
  
  var endDateInput = document.getElementById('filter-date-end');
  if (endDateInput) endDateInput.value = '';
  
  var tagsCountSpan = document.getElementById('filter-tags-count');
  if (tagsCountSpan) tagsCountSpan.textContent = 'Todas';
  
  // Apply (which will show all articles)
  applyFiltersToGrid();
  
  dhtmlx.message({
    text: 'Filtros limpiados',
    type: 'info',
    expire: 2000
  });
}

/**
 * Handle company change event (admin only)
 * @param {string} companyCode - Selected company code
 */
function onCompanyChange(companyCode) {
  CompanyRouting.navigateToCompany(companyCode);
}

/**
 * Initialize the Files tab for the selected company
 * @param {string} companyCode - Company code
 */
function initializeFilesTab(companyCode) {
  if (!appState.filesTab) {
    console.error('Files tab not available');
    return;
  }
  
  // Initialize files tab only once
  if (!appState.filesTabInitialized) {
    FilesTabManager.initializeFilesTab(appState.filesTab, companyCode);
    appState.filesTabInitialized = true;
  } else {
    // Update company if already initialized
    FilesTabManager.updateCompany(companyCode);
  }
}

/**
 * Initialize the Images tab for the selected company
 * @param {string} companyCode - Company code
 */
function initializeImagesTab(companyCode) {
  if (!appState.imagesTab) {
    console.error('Images tab not available');
    return;
  }
  
  // Initialize images tab only once
  if (!appState.imagesTabInitialized) {
    ImagesTabManager.initializeImagesTab(appState.imagesTab, companyCode);
    appState.imagesTabInitialized = true;
  } else {
    // Update company if already initialized
    ImagesTabManager.updateCompany(companyCode);
  }
}

/**
 * Load articles for a specific company and populate the grid
 * @param {string} companyCode - Company code to load articles for
 * @returns {Promise} Promise that resolves when articles are loaded
 */
function loadArticlesForCompany(companyCode) {
  return ArticleService.getArticles({companyCode: companyCode})
    .then(function(articles) {
      // Precompute search index for O(n) filtering performance
      GridFilterService.precomputeSearchIndex(articles);
      
      // Store all articles for filtering
      appState.allArticles = articles;
      
      // Clear filters when changing company
      GridFilterService.clearAllFilters();
      appState.selectedFilterTags = [];
      
      // Reset filter UI if it exists
      var searchInput = document.getElementById('filter-search');
      if (searchInput) searchInput.value = '';
      
      var statusSelect = document.getElementById('filter-status');
      if (statusSelect) statusSelect.value = '';
      
      var startDateInput = document.getElementById('filter-date-start');
      if (startDateInput) startDateInput.value = '';
      
      var endDateInput = document.getElementById('filter-date-end');
      if (endDateInput) endDateInput.value = '';
      
      var tagsCountSpan = document.getElementById('filter-tags-count');
      if (tagsCountSpan) tagsCountSpan.textContent = 'Todas';
      
      updateFilterActiveIndicator();
      
      // Initially show all articles (no filters applied)
      appState.filteredArticles = articles;
      
      // Destroy existing grid if it exists
      // Note: destructor() handles cleanup including clearing data
      if (appState.articlesGrid) {
        appState.articlesGrid.destructor();
        appState.articlesGrid = null;
      }
      
      // Initialize new grid with articles
      appState.articlesGrid = initializeArticlesGrid(grid_cell, articles);
      
      // Attach row selection event
      appState.articlesGrid.attachEvent('onRowSelect', function(rowId) {
        onArticleSelect(rowId, companyCode);
      });
      
      // Initialize Files tab with current company
      initializeFilesTab(companyCode);
      
      // Initialize Images tab with current company
      initializeImagesTab(companyCode);
      
      main_content.progressOff();
      return articles;
    });
}

/**
 * Handle article selection in the grid
 * @param {string} articleId - Selected article ID
 */
function onArticleSelect(articleId) {
  appState.selectedArticleId = articleId;
  
  // Fetch article details and company info
  Promise.all([
    ArticleService.getArticleById(articleId, appState.selectedCompanyCode),
    CompanyService.getCompanyByCode(appState.selectedCompanyCode)
  ])
    .then(function(results) {
      var article = results[0];
      var company = results[1];
      
      if (!article) {
        throw new Error('Article not found');
      }
      
      var companyName = company ? company.name : 'Desconocida';
      
      // Render article details in sidebar
      var detailHtml = ArticleDetailUI.renderArticleDetailSidebar(article, companyName);
      appState.sidebarCell.attachHTMLString(detailHtml);
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      
      // Load attachments and attach edit button event after DOM is ready
      // Note: Using requestAnimationFrame to ensure DOM is ready after attachHTMLString
      // This is more efficient than setTimeout and executes on the next frame
      requestAnimationFrame(function() {
        // Load images and files for the attachments section
        ArticleDetailUI.loadAttachments(articleId);
        
        // Attach edit button event if the admin component injected it
        if (typeof AdminEditArticleButton !== 'undefined') {
          var editBtn = document.getElementById('edit-article-btn');
          if (editBtn) {
            editBtn.onclick = function() {
              openEditArticleForm(articleId, appState.selectedCompanyCode);
            };
          }
        }
      });
    })
    .catch(function(error) {
      console.error('Error loading article details:', error);
      appState.sidebarCell.attachHTMLString(
        '<div style="padding: 20px; color: #ff4d4f;">Error al cargar detalles del artículo</div>'
      );
    });
}

/**
 * Open the Tag Manager for the currently selected company (Admin only)
 */
function openTagManager() {
  // Check if a company is selected
  if (!appState.selectedCompanyCode) {
    dhtmlx.alert({
      title: 'Atención',
      text: 'Por favor seleccione una empresa primero.'
    });
    return;
  }
  
  // Check if user is admin
  if (typeof AdminManageTagsButton === 'undefined') {
    dhtmlx.alert({
      title: 'Acceso denegado',
      text: 'Solo los administradores pueden gestionar etiquetas.'
    });
    return;
  }
  
  // Open the tag manager
  TagManagerUI.openTagManager(appState.selectedCompanyCode, function() {
    // Callback when tags are changed - reload articles to reflect changes
    loadArticlesForCompany(appState.selectedCompanyCode)
      .catch(function(error) {
        console.error('Error reloading articles after tag changes:', error);
      });
  });
}

/**
 * Open the Bulk Tag Editor for selected articles (Admin only)
 */
function openBulkTagEditor() {
  // Check if user is admin
  if (typeof AdminBulkTagEditor === 'undefined') {
    dhtmlx.alert({
      title: 'Acceso denegado',
      text: 'Solo los administradores pueden realizar edición masiva de etiquetas.'
    });
    return;
  }
  
  // Check if a company is selected
  if (!appState.selectedCompanyCode) {
    dhtmlx.alert({
      title: 'Atención',
      text: 'Por favor seleccione una empresa primero.'
    });
    return;
  }
  
  // Get selected row IDs from the grid
  if (!appState.articlesGrid) {
    dhtmlx.alert({
      title: 'Atención',
      text: 'No hay artículos cargados.'
    });
    return;
  }
  
  var selectedIds = appState.articlesGrid.getCheckedRows(0);
  
  if (!selectedIds || selectedIds === '') {
    dhtmlx.alert({
      title: 'Atención',
      text: 'Por favor seleccione al menos un artículo para editar etiquetas.'
    });
    return;
  }
  
  // Convert to array (getSelectedRowId returns comma-separated string for multiselect)
  var selectedIdsArray = selectedIds.split(',').filter(function(id) {
    return id && id.trim() !== '';
  });
  
  // Fetch the full article objects for selected IDs using bulk fetch
  ArticleService.getArticlesByIds(selectedIdsArray, appState.selectedCompanyCode)
    .then(function(selectedArticles) {
      // Filter out any null results
      var validArticles = selectedArticles.filter(function(article) {
        return article !== null;
      });
      
      if (validArticles.length === 0) {
        dhtmlx.alert({
          title: 'Error',
          text: 'No se pudieron cargar los artículos seleccionados.'
        });
        return;
      }
      
      // Open the bulk tag editor
      BulkTagEditorUI.openBulkTagEditor(appState.selectedCompanyCode, validArticles, function() {
        // Callback when tags are updated - reload articles
        loadArticlesForCompany(appState.selectedCompanyCode)
          .then(function() {
            selectedIdsArray.forEach(function(articleId) {
              try {
                appState.articlesGrid.cells(articleId, 0).setValue(1);
              } catch (e) {
                // Row may no longer exist after refresh (e.g., concurrent deletion); ignore safely.
                console.debug('Skipped restoring selection for missing article row:', articleId);
              }
            });

            // If the currently selected article is one of the edited ones, refresh sidebar
            if (appState.selectedArticleId && selectedIdsArray.indexOf(appState.selectedArticleId) !== -1) {
              onArticleSelect(appState.selectedArticleId, appState.selectedCompanyCode);
            }
          })
          .catch(function(error) {
            console.error('Error reloading articles after bulk tag update:', error);
          });
      });
    })
    .catch(function(error) {
      console.error('Error fetching selected articles:', error);
      dhtmlx.alert({
        title: 'Error',
        text: 'Error al cargar los artículos seleccionados.'
      });
    });
}

// ============================================================================
// Company Settings Functions
// ============================================================================
function openCompanySettingsForm() {
  if (typeof AdminEditCompanyButton === 'undefined') return;
  
  if (!appState.selectedCompanyCode) {
    dhtmlx.alert({
      title: 'Atención',
      text: 'Por favor seleccione una empresa primero.'
    });
    return;
  }
  
  CompanyFormUI.openSettingsForm(appState.selectedCompanyCode, (newSettings) => {
    // Callback when settings are saved - refresh the current view to apply permission changes
    refreshAppStateForSettings(newSettings);
  });
}

/**
 * Refresh app state when company settings change
 * This ensures UI elements are shown/hidden based on new settings
 * @param {CompanySettings} newSettings - The updated settings
 */
function refreshAppStateForSettings(newSettings) {
  // Clear CompanyService cache to ensure fresh data
  CompanyService.clearCache();
  
  // Refresh upload button visibility for non-admin users
  if (typeof AdminUploadOverride === 'undefined') {
    updateUploadButtonVisibility('files-upload-btn', newSettings.allowUserUploads);
    updateUploadButtonVisibility('images-upload-btn', newSettings.allowUserUploads);
  }
}

/**
 * Update an upload button's visibility based on settings
 * @param {string} buttonId - The ID of the button element
 * @param {boolean} isVisible - Whether the button should be visible
 */
function updateUploadButtonVisibility(buttonId, isVisible) {
  const uploadBtn = document.getElementById(buttonId);
  if (uploadBtn) {
    uploadBtn.style.display = isVisible ? '' : 'none';
  }
}

// ============================================================================
// Article Form Functions
// ============================================================================

/**
 * Open the form for creating a new article
 * Navigates to the dedicated New Article page
 */
function openNewArticleForm() {
  if (typeof AdminNewArticlePage === 'undefined') return;
  // Check if a company is selected
  if (!appState.selectedCompanyCode) {
    dhtmlx.alert({
      title: 'Atención',
      text: 'Por favor seleccione una empresa primero.'
    });
    return;
  }
  
  // Get company name for display
  CompanyService.getCompanyByCode(appState.selectedCompanyCode)
    .then(function(company) {
      var companyName = company ? company.name : '';
      
      // Switch to new article page view
      showNewArticlePage(companyName);
    })
    .catch(function(error) {
      console.error('Error getting company name:', error);
      // Still show the page even if company name fails
      showNewArticlePage('');
    });
}

/**
 * Show the New Article page in the articles tab
 * @param {string} companyName - Name of the company for display
 */
function showNewArticlePage(companyName) {
  appState.currentArticlesView = 'new-article';
  
  // Hide header toolbar items
  header_toolbar.hideItem('new_article');
  header_toolbar.hideItem('edit_company');
  
  // Open the new article page in the articles tab cell
  // This will replace the content in the articles tab
  NewArticlePageUI.openPage(
    articles,  // Use the articles tab cell
    appState.selectedCompanyCode,
    companyName,
    onNavigateBackFromNewArticle
  );
}

/**
 * Navigate back from new article page to the grid view
 * @param {Object} [newArticleData] - Data of the newly created article (if any)
 */
function onNavigateBackFromNewArticle(newArticleData) {
  appState.currentArticlesView = 'grid';
  
  // Close the new article page
  NewArticlePageUI.closePage();
  
  // Show header toolbar items
  header_toolbar.showItem('new_article');
  header_toolbar.showItem('edit_company');
  
  // Rebuild the articles tab layout
  rebuildArticlesTabLayout();
  
  // Reload articles for the current company to refresh the grid
  loadArticlesForCompany(appState.selectedCompanyCode)
    .then(function() {
      // If a new article was created, select it in the grid
      if (newArticleData && newArticleData.id && appState.articlesGrid) {
        appState.articlesGrid.selectRowById(newArticleData.id, false, true, true);
        onArticleSelect(newArticleData.id, appState.selectedCompanyCode);
      }
    })
    .catch(function(error) {
      console.error('Error refreshing grid after creating article:', error);
    });
}

/**
 * Rebuild the articles tab layout after returning from New Article page
 * Re-creates the filters section, grid, toolbar, and sidebar
 */
function rebuildArticlesTabLayout() {
  // Clear the grid reference before rebuilding
  appState.articlesGrid = null;
  
  // Re-attach the articles layout to the articles tab
  articles_layout = articles.attachLayout('2E');
  
  // Filters Section (Top)
  filters_container = articles_layout.cells('a');
  filters_container.hideHeader();
  filters_container.fixSize(0, 1);
  filters_container.setHeight(90);
  
  // Grid Section (Center) and Sidebar (Right)
  grid_sidebar_layout = articles_layout.cells('b');
  grid_sidebar_layout.hideHeader();
  
  // Grid Toolbar Area (various actions)
  grid_toolbar = grid_sidebar_layout.attachToolbar();
  grid_toolbar.setIconsPath('./Dhtmlx/codebase/imgs/');
  grid_toolbar.addSeparator('sep_bulk', 1);
  grid_toolbar.addButton('bulk_edit_tags', 2, 'Editar Etiquetas (Selección)');
  grid_toolbar.addSeparator('sep_clear', 3);
  grid_toolbar.addButton('manage_tags', 4, 'Administrar Etiquetas');
  
  grid_toolbar.setItemToolTip('manage_tags', 'Administrar las etiquetas de la empresa');
  grid_toolbar.setItemToolTip('bulk_edit_tags', 'Editar etiquetas de los artículos seleccionados');
  
  grid_toolbar.attachEvent('onClick', function(id) {
    if (id === 'manage_tags') {
      openTagManager();
    } else if (id === 'bulk_edit_tags') {
      openBulkTagEditor();
    }
  });
  
  // Hide toolbar items for non-admin users
  if (typeof AdminBulkEditTagsButton === 'undefined') {
    grid_toolbar.hideItem('manage_tags');
    grid_toolbar.hideItem('bulk_edit_tags');
    grid_toolbar.hideItem('sep_bulk');
  }
  
  // Split into grid and sidebar
  grid_sidebar_split = grid_sidebar_layout.attachLayout('2U');
  
  // Grid Cell
  grid_cell = grid_sidebar_split.cells('a');
  grid_cell.hideHeader();
  
  // Sidebar Cell
  sidebar_cell = grid_sidebar_split.cells('b');
  sidebar_cell.setWidth(LAYOUT_CONFIG.SIDEBAR_WIDTH);
  sidebar_cell.hideHeader();
  sidebar_cell.fixSize(0, 0);
  appState.sidebarCell = sidebar_cell;
  
  // Show empty state initially
  sidebar_cell.attachHTMLString(ArticleDetailUI.renderEmptyState());
  
  // Recreate filters
  if (typeof AdminCompanyPicker !== 'undefined') {
    CompanyService.getAllCompanies().then(function(companies) {
      createGridFilters(companies);
    });
  } else {
    createFilterFormForRegularUser();
  }
}

/**
 * Open the form for editing an existing article
 * @param {string} articleId - ID of the article to edit
 * @param {string} companyCode - Code of the company the article belongs to
 */
function openEditArticleForm(articleId, companyCode) {
  ArticleService.getArticleById(articleId, companyCode)
    .then(function(article) {
      if (!article) {
        dhtmlx.alert({
          title: 'Error',
          text: 'Artículo no encontrado'
        });
        return;
      }
      
      ArticleFormUI.openEditForm(article, onArticleFormSaved);
    })
    .catch(function(error) {
      console.error('Error loading article for edit:', error);
      dhtmlx.alert({
        title: 'Error',
        text: 'Error al cargar el artículo: ' + error.message
      });
    });
}

/**
 * Callback function after an article is saved (created or updated)
 * @param {Object} articleData - The saved article data
 * @param {string} mode - 'create' or 'edit'
 */
function onArticleFormSaved(articleData, mode) {
  // Reload articles for the current company to refresh the grid
  ArticleService.clearCache(); // Clear cache to ensure fresh data is loaded
  loadArticlesForCompany(appState.selectedCompanyCode)
    .then(function() {
      if (mode === 'create') {
        // Select the newly created row in the grid
        if (appState.articlesGrid && articleData.id) {
          appState.articlesGrid.selectRowById(articleData.id, false, true, true);
          onArticleSelect(articleData.id);
        }
      } else if (mode === 'edit') {
        // Refresh the detail sidebar to show the updated data
        if (appState.selectedArticleId === articleData.id) {
          onArticleSelect(articleData.id);
        }
      } else if (mode === 'delete') {
        // Clear sidebar after article deletion
        appState.sidebarCell.attachHTMLString(ArticleDetailUI.renderEmptyState());
        appState.selectedArticleId = null;
      }
    })
    .catch(function(error) {
      console.error('Error refreshing grid after save:', error);
    });
}

// ============================================================================
// Application Entry Point
// ============================================================================

// Initialize application when DOM is ready
initializeApplication();

main_layout.setSizes();
