/**
 * Company Routing Module
 * Extracts the companyId from the URL path and provides navigation helpers.
 *
 * URL Pattern: /{companyId}
 * Example: https://example.com/co-01  →  companyId = "co-01"
 *
 * The first non-empty path segment is treated as the companyId.
 */

const CompanyRouting = (function () {
  'use strict';

  /**
   * Extract the companyId from the current URL path.
   * Treats the first non-empty segment as the companyId.
   *
   * @returns {string|null} The companyId or null when none is present.
   */
  function getCompanyIdFromUrl() {
    var segments = window.location.pathname.split('/').filter(Boolean);
    return segments.length > 0 ? decodeURIComponent(segments[0]) : null;
  }

  /**
   * Navigate the browser to a new companyId URL.
   * Replaces the first path segment while preserving query / hash.
   *
   * @param {string} companyId - The new company ID to navigate to.
   */
  function navigateToCompany(companyId) {
    if (!companyId) return;
    var newPath = '/' + encodeURIComponent(companyId);
    window.location.href = newPath + window.location.search + window.location.hash;
  }

  return {
    getCompanyIdFromUrl: getCompanyIdFromUrl,
    navigateToCompany: navigateToCompany
  };
})();
