/**
 * Company Service Module
 * Provides Promise-based data fetching methods for company settings
 * Designed to be easily integrated with a backend server in the future
 */

const CompanyService = (function() {
  'use strict';

  // Cache for company settings to avoid multiple lookups
  let companySettingsCache = {};
  let companiesCache = new Map();

  /**
   * Clear the settings cache (useful for development/testing)
   */
  function clearCache() {
    companySettingsCache = {};
    companiesCache.clear();
  }
  function getAllCompanies() {
    return fetch(`/api/companies`)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to fetch companies');
        }
        return response.json();
      })
      .then(function(companies) {
        if (Array.isArray(companies)) {
          companies.forEach(function(company) {
            if (company && company.id) {
              companiesCache.set(company.id, company);
            }
          });
        }
        return companies || [];
      })
      .catch(function(error) {
        console.error('Error fetching companies:', error);
        return [];
      });
  }

  function getCompanyById(companyId) {
    if (companiesCache.has(companyId)) {
      return Promise.resolve(companiesCache.get(companyId));
    }

    return fetch(`/api/companies/${companyId}`)
      .then(function(response) {
        if (response.status === 404) {
          return null; // Company not found
        }
        if (!response.ok) {
          throw new Error('Failed to fetch company: ' + response.statusText);
        }
        return response.json();
      })
      .then(function(company) {
        if (company && company.id) {
          companiesCache.set(company.id, company);
        }
        return company;
      })
      .catch(function(error) {
        console.error('Error fetching company by ID:', error);
        return null;
      });
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

    // Load from CompanyService and cache the result
    return getCompanyById(companyId)
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
   * Settings are persisted to the backend via a PUT request to the API.
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

      const headers = new Headers();
      headers.append("Content-Type", "application/json");

      const rawSettings = JSON.stringify(newSettings);
      const requestOptions = {
        method: "PUT",
        headers: headers,
        body: rawSettings,
        redirect: "follow"
      };

      fetch(`/api/companies/${companyId}`, requestOptions)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Failed to update company settings: ' + response.status);
          }
          var contentType = response.headers.get('content-type');
          if (contentType && contentType.indexOf('application/json') !== -1) {
            return response.json();
          }
          return { settings: newSettings };
        })
        .then(function(data) {

          // Clear the settings cache to force refresh
          delete companySettingsCache[companyId];

          // Update cache with new settings
          companySettingsCache[companyId] = data.settings || newSettings;

          resolve({ 
            status: 'success', 
            data: data.settings || newSettings
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
    getAllCompanies: getAllCompanies,
    getCompanyById: getCompanyById,
    getCompanySettings: getCompanySettings,
    updateCompanySettings: updateCompanySettings,
    isSettingEnabled: isSettingEnabled,
    canUsersUpload: canUsersUpload,
    canUsersCreateTags: canUsersCreateTags,
    areClientCommentsRequired: areClientCommentsRequired,
    clearCache: clearCache
  };
})();
