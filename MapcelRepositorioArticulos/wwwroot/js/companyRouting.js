/**
 * Company Routing Module
 * Extracts the companyCode from the URL path and provides navigation helpers.
 *
 * URL Pattern: /{companyCode}
 * Example: https://example.com/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  →  companyCode = "xxxxxxxx-..."
 *
 * The first non-empty path segment at position 3 is treated as the companyCode.
 */

const CompanyRouting = (function () {
  'use strict';

  /**
   * Extract the companyCode from the current URL path.
   * Treats the segment at position 3 as the companyCode.
   *
   * @returns {string|null} The companyCode (UUID) or null when none is present or invalid.
   */
  function getCompanyCodeFromUrl() {
    const positionalLocationOfCompanyCode = 3; // `/nuevos/repositorioarticulos/produccion/companyCode`
    var segments = window.location.pathname.split('/').filter(Boolean);
    var value = segments.length > positionalLocationOfCompanyCode ? decodeURIComponent(segments[positionalLocationOfCompanyCode]) : null;
    if (value && !Utils.isValidUUID(value)) return null;
    return value;
  }

  /**
   * Navigate the browser to a new companyCode URL.
   * Replaces the first path segment while preserving query / hash.
   *
   * @param {string} companyCode - The new company code (UUID) to navigate to.
   */
  function navigateToCompany(companyCode) {
    if (!companyCode || !Utils.isValidUUID(companyCode)) return;
    var newPath = '/nuevos/repositorioarticulos/produccion/' + encodeURIComponent(companyCode);
    window.location.href = newPath + window.location.search + window.location.hash;
  }

  return {
    getCompanyCodeFromUrl: getCompanyCodeFromUrl,
    navigateToCompany: navigateToCompany
  };
})();
