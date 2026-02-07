/**
 * Company Service Module
 * Provides Promise-based data fetching methods for company settings
 * Designed to be easily integrated with a backend server in the future
 */

const CompanyService = (function() {
  'use strict';

  // Cache for company settings to avoid multiple lookups
  let companySettingsCache = {};

  /**
   * Clear the settings cache (useful for development/testing)
   */
  function clearCache() {
    companySettingsCache = {};
  }

  /**
   * Get company settings by company ID
   * @param {string} companyId - The company ID
   * @returns {Promise<CompanySettings>} Promise resolving to company settings
   */
  function getCompanySettings(companyId) {
    // Check cache first
    if (companySettingsCache[companyId]) {
      return Promise.resolve(companySettingsCache[companyId]);
    }

    // Load from ArticleService (which manages mock data)
    return ArticleService.getCompanyById(companyId)
      .then(function(company) {
        if (!company) {
          throw new Error('Company not found: ' + companyId);
        }

        // Get settings or use defaults
        const settings = company.settings || getDefaultCompanySettings();
        
        // Cache the settings
        companySettingsCache[companyId] = settings;
        
        return settings;
      });
  }

  /**
   * Update company settings
   * This is a Promise-based method designed for future backend integration.
   * 
   * NOTE: In mock mode, settings are only stored in memory via the ArticleService cache.
   * Changes will be lost on page reload. In production, this will be a PUT request
   * to the backend that persists the settings to a database.
   * 
   * @param {string} companyId - The company ID
   * @param {CompanySettings} newSettings - The new settings object
   * @returns {Promise<{status: string, data: CompanySettings}>} Promise resolving to the update result
   */
  function updateCompanySettings(companyId, newSettings) {
    return new Promise(function(resolve, reject) {
      if (!companyId) {
        reject(new Error('Company ID is required'));
        return;
      }

      if (!newSettings) {
        reject(new Error('Settings object is required'));
        return;
      }

      console.log('Updating company settings for ' + companyId, newSettings);

      // In mock mode, update the data via fetch and modify in memory
      // This simulates what would be a PUT request to the backend
      fetch('./data/articles-mock-data.json')
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          // Find the company and update settings
          const companies = data.companies || [];
          const companyIndex = companies.findIndex(function(c) {
            return c.id === companyId;
          });

          if (companyIndex === -1) {
            throw new Error('Company not found: ' + companyId);
          }

          // Update settings in the company object
          // Note: In production, this would be a backend call
          // For mock data, we update the in-memory ArticleService cache
          ArticleService.getCompanyById(companyId)
            .then(function(company) {
              if (company) {
                company.settings = newSettings;
              }
            });

          // Clear the settings cache to force refresh
          delete companySettingsCache[companyId];

          // Update cache with new settings
          companySettingsCache[companyId] = newSettings;

          resolve({ 
            status: 'success', 
            data: newSettings 
          });
        })
        .catch(function(error) {
          console.error('Error updating company settings:', error);
          reject(error);
        });
    });
  }

  /**
   * Check if a specific setting is enabled for a company
   * This is a convenience method for checking individual settings
   * @param {string} companyId - The company ID
   * @param {string} settingKey - The setting key to check
   * @returns {Promise<boolean>} Promise resolving to the setting value
   */
  function isSettingEnabled(companyId, settingKey) {
    return getCompanySettings(companyId)
      .then(function(settings) {
        return settings[settingKey] === true;
      })
      .catch(function() {
        // Default to false if there's an error
        return false;
      });
  }

  /**
   * Check if regular users can upload files/images
   * @param {string} companyId - The company ID
   * @returns {Promise<boolean>} Promise resolving to true if uploads are allowed
   */
  function canUsersUpload(companyId) {
    return isSettingEnabled(companyId, 'allow_user_uploads');
  }

  /**
   * Check if regular users can create tags
   * @param {string} companyId - The company ID
   * @returns {Promise<boolean>} Promise resolving to true if tag creation is allowed
   */
  function canUsersCreateTags(companyId) {
    return isSettingEnabled(companyId, 'allow_user_tag_creation');
  }

  /**
   * Check if client comments are required when closing tickets
   * @param {string} companyId - The company ID
   * @returns {Promise<boolean>} Promise resolving to true if comments are required
   */
  function areClientCommentsRequired(companyId) {
    return isSettingEnabled(companyId, 'require_client_comments');
  }

  // Public API
  return {
    getCompanySettings: getCompanySettings,
    updateCompanySettings: updateCompanySettings,
    isSettingEnabled: isSettingEnabled,
    canUsersUpload: canUsersUpload,
    canUsersCreateTags: canUsersCreateTags,
    areClientCommentsRequired: areClientCommentsRequired,
    clearCache: clearCache
  };
})();
