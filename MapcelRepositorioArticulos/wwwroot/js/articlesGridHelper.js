/**
 * Articles Grid Helper Module
 * Provides utility functions and templates for rendering the articles grid
 * Dependencies:
 * - tagBadge.js (must be loaded before this module for renderTagBadges function)
 */

const ARTICLES_PAGINATION_FOOTER_HEIGHT = '42px';

/**
 * Generate HTML template for status column with colored bullet
 * @param {string} statusValue - The status value
 * @param {Object} statusConfig - Status configuration object
 * @returns {string} HTML string for status cell
 */
function renderStatusCellTemplate(statusValue, statusConfig) {
  const bulletColor = statusConfig.bulletColor || '#000000';
  const label = statusConfig.label || statusValue;
  
  return `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${bulletColor}; display: inline-block;"></span>
      <span style="font-size: 13px;">${label}</span>
    </div>
  `;
}

/**
 * Generate HTML template for title column with title and description
 * @param {string} title - Article title
 * @param {string} description - Article description
 * @returns {string} HTML string for title cell
 */
function renderTitleCellTemplate(title, description) {
  return `
    <div style="padding: 4px 0;">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${title}</div>
      <div style="font-size: 12px; color: #8c8c8c; line-height: 1.4;">${description}</div>
    </div>
  `;
}

function htmlToPreviewText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';

  // Remove elements you definitely don't want in the preview
  div.querySelectorAll('table, img, video, iframe, script, style').forEach(el => el.remove());

  // Get only readable text
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Initialize and configure the articles grid
 * @param {Object} gridCell - DHTMLX layout cell where grid will be attached
 * @param {Array<Article>} articlesData - Array of article objects
 * @returns {Object} Configured DHTMLX grid instance
 */
function initializeArticlesGrid(gridCell, articlesData) {
  const articlesGrid = gridCell.attachGrid();
  
  // Configure grid appearance
  articlesGrid.setIconsPath('./Dhtmlx/codebase/imgs/');
  articlesGrid.setImagePath('./Dhtmlx/codebase/imgs/');
  articlesGrid.enableMultiselect(true);
  
  // Define column headers
  articlesGrid.setHeader([
    "",
    "Estatus",
    "Título",
    "Tags",
    "Modificado",
    "Creado"
  ]);
  
  // Define column types (ch=checkbox, ro=read-only)
  articlesGrid.setColTypes("ch,ro,ro,ro,ro,ro");
  
  // Configure column resizing (checkbox and status not resizable)
  articlesGrid.enableResizing('false,false,true,true,false,false');
  
  // Configure column sorting
  articlesGrid.setColSorting('bool,str,str,na,str,str');
  
  // Set initial column widths
  articlesGrid.setInitWidths('40,120,*,200,120,120');
  
  // Initialize the grid
  articlesGrid.init();
  
  // Enable smart rendering to reduce DOM thrashing during filtering
  articlesGrid.enableSmartRendering(true);
  
  // Add footer container for custom pagination controls
  articlesGrid.attachFooter([
    "<div id='articles_grid_pagination' style='width:100%;height:100%'></div>",
    "#cspan",
    "#cspan",
    "#cspan",
    "#cspan",
    "#cspan"
  ], ['height:' + ARTICLES_PAGINATION_FOOTER_HEIGHT + ';text-align:left;background:transparent;border-color:white;padding:0px;']);
  
  // Populate grid with article data
  articlesData.forEach(article => {
    const statusConfig = getStatusConfiguration(article.status);
    const rowId = article.id;
    
    const previewableDescription = htmlToPreviewText(htmlToPreviewText(article.description));
    
    // Add row with initial data (necessary for DHTMLX grid structure)
    articlesGrid.addRow(rowId, ['', '', '', '', '', '']);
    
    // Set custom HTML content for each cell
    articlesGrid.cells(rowId, 1).setValue(renderStatusCellTemplate(article.status, statusConfig));
    articlesGrid.cells(rowId, 2).setValue(renderTitleCellTemplate(article.title, previewableDescription));
    articlesGrid.cells(rowId, 3).setValue(renderTagBadges(article.tags));
    articlesGrid.cells(rowId, 4).setValue(article.updatedAt);
    articlesGrid.cells(rowId, 5).setValue(article.createdAt);
  });
  
  return articlesGrid;
}
