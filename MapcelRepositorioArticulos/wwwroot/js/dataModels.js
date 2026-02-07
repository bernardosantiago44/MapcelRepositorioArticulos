/**
 * Data Models for Articles Repository Application
 * Defines the structure for Companies and Articles
 */

/**
 * Company Settings Data Model
 * Defines toggleable settings for company-level feature control
 * @typedef {Object} CompanySettings
 * @property {boolean} allow_user_uploads - If true, regular users can upload images and files
 * @property {boolean} allow_user_tag_creation - If true, regular users can create new tags
 * @property {boolean} require_client_comments - If true, client comments are required when closing tickets
 */

/**
 * Company Data Model
 * @typedef {Object} Company
 * @property {string} id - Unique identifier for the company
 * @property {string} name - Company name
 * @property {CompanySettings} settings - Company-level settings for feature control
 */

/**
 * Default company settings
 * Used when a company doesn't have settings defined
 * @returns {CompanySettings}
 */
function getDefaultCompanySettings() {
  return {
    allow_user_uploads: true,
    allow_user_tag_creation: true,
    require_client_comments: false
  };
}

/**
 * Article Data Model
 * @typedef {Object} Article
 * @property {string} id - Unique identifier (e.g., "issue-0001")
 * @property {string} title - Article title
 * @property {string} description - Detailed description of the article
 * @property {string} externalLink - External tracker link
 * @property {string} clientComments - Comments from the client
 * @property {('Producción'|'Borrador'|'Cerrado')} status - Current status
 * @property {string} companyId - Foreign key to Company
 * @property {Array<string>} tags - Array of tag IDs (company-scoped)
 * @property {Array<string>} attachedImages - Array of image IDs attached to the article
 * @property {Array<string>} attachedFiles - Array of file IDs attached to the article
 * @property {string} createdAt - Creation date (YYYY-MM-DD)
 * @property {string} updatedAt - Last update date (YYYY-MM-DD)
 */

/**
 * Status Configuration
 * Defines available statuses with their display properties
 */
const articleStatusConfiguration = {
  'Producción': {
    label: 'Producción',
    color: '#52c41a',
    bulletColor: '#52c41a'
  },
  'Borrador': {
    label: 'Borrador',
    color: '#1890ff',
    bulletColor: '#1890ff'
  },
  'Cerrado': {
    label: 'Cerrado',
    color: '#8c8c8c',
    bulletColor: '#8c8c8c'
  }
};

/**
 * Get status configuration for a given status value
 * @param {string} statusValue - The status value
 * @returns {Object} Status configuration object
 */
function getStatusConfiguration(statusValue) {
  return articleStatusConfiguration[statusValue] || {
    label: statusValue,
    color: '#000000',
    bulletColor: '#000000'
  };
}
