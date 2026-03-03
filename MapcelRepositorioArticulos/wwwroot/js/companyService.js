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
    return fetch(`${API_BASE_URL}/companies`)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to fetch companies');
        }
        console.log(response);
        return response.json();
      })
      .then(function(companies) {
        if (Array.isArray(companies)) {
          companies.forEach(function(company) {
            if (company && company.companyCode) {
              companiesCache.set(company.companyCode, company);
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

  function getCompanyByCode(companyCode) {
    if (!Utils.isValidUUID(companyCode)) return Promise.reject(new Error('Invalid company code'));

    if (companiesCache.has(companyCode)) {
      return Promise.resolve(companiesCache.get(companyCode));
    }

    return fetch(`${API_BASE_URL}/companies/${companyCode}`)
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
        if (company && company.companyCode) {
          companiesCache.set(company.companyCode, company);
        }
        return company;
      })
      .catch(function(error) {
        console.error('Error fetching company by code:', error);
        return null;
      });
  }

  /**
   * Get company settings by company code
   * @param {string} companyCode - The company code (UUID)
   * @returns {Promise<CompanySettings>} Promise resolving to company settings
   */
  function getCompanySettings(companyCode) {
    // Check cache first
    if (companySettingsCache[companyCode]) {
      return Promise.resolve(companySettingsCache[companyCode]);
    }

    // Load from CompanyService and cache the result
    return getCompanyByCode(companyCode)
      .then(function(company) {
        if (!company) {
          throw new Error('Company not found: ' + companyCode);
        }

        // Get settings or use defaults (API returns camelCase keys)
        var settings = company.settings || getDefaultCompanySettings();
        
        // Cache the settings
        companySettingsCache[companyCode] = settings;
        
        return settings;
      });
  }

  /**
   * Update company settings
   * This is a Promise-based method designed for future backend integration.
   * 
   * Settings are persisted to the backend via a PUT request to the API.
   * 
   * @param {string} companyCode - The company code (UUID)
   * @param {CompanySettings} newSettings - The new settings object
   * @returns {Promise<{status: string, data: CompanySettings}>} Promise resolving to the update result
   */
  function updateCompanySettings(companyCode, newSettings) {
    return new Promise(function(resolve, reject) {
      if (!companyCode) {
        reject(new Error('Company code is required'));
        return;
      }

      if (!Utils.isValidUUID(companyCode)) {
        reject(new Error('Invalid company code'));
        return;
      }

      if (!newSettings) {
        reject(new Error('Settings object is required'));
        return;
      }

      const headers = new Headers();
      headers.append("Content-Type", "application/json");

      const rawSettings = JSON.stringify({
        allowUserUploads: newSettings.allowUserUploads,
        allowUserTagCreation: newSettings.allowUserTagCreation,
        requireClientComments: newSettings.requireClientComments
      });
      const requestOptions = {
        method: "PUT",
        headers: headers,
        body: rawSettings,
        redirect: "follow"
      };

      fetch(`${API_BASE_URL}/companies/${companyCode}`, requestOptions)
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

          // Clear caches to force refresh
          delete companySettingsCache[companyCode];
          companiesCache.delete(companyCode);

          // Update cache with new settings
          companySettingsCache[companyCode] = data.settings || newSettings;

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
   * @param {string} companyCode - The company code (UUID)
   * @param {string} settingKey - The setting key to check
   * @returns {Promise<boolean>} Promise resolving to the setting value
   */
  function isSettingEnabled(companyCode, settingKey) {
    return getCompanySettings(companyCode)
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
   * @param {string} companyCode - The company code (UUID)
   * @returns {Promise<boolean>} Promise resolving to true if uploads are allowed
   */
  function canUsersUpload(companyCode) {
    return isSettingEnabled(companyCode, 'allowUserUploads');
  }

  /**
   * Check if regular users can create tags
   * @param {string} companyCode - The company code (UUID)
   * @returns {Promise<boolean>} Promise resolving to true if tag creation is allowed
   */
  function canUsersCreateTags(companyCode) {
    return isSettingEnabled(companyCode, 'allowUserTagCreation');
  }

  /**
   * Check if client comments are required when closing tickets
   * @param {string} companyCode - The company code (UUID)
   * @returns {Promise<boolean>} Promise resolving to true if comments are required
   */
  function areClientCommentsRequired(companyCode) {
    return isSettingEnabled(companyCode, 'requireClientComments');
  }

  // Public API
  return {
    getAllCompanies: getAllCompanies,
    getCompanyByCode: getCompanyByCode,
    getCompanySettings: getCompanySettings,
    updateCompanySettings: updateCompanySettings,
    isSettingEnabled: isSettingEnabled,
    canUsersUpload: canUsersUpload,
    canUsersCreateTags: canUsersCreateTags,
    areClientCommentsRequired: areClientCommentsRequired,
    clearCache: clearCache
  };
})();
