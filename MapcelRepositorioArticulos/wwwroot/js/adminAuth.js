/**
 * Admin Auth Module
 * Handles admin login / logout using static credentials defined in AuthConfig.
 *
 * Depends on: AuthConfig
 * @namespace AdminAuth
 */
var AdminAuth = (function () {
  'use strict';

  /**
   * Check whether the admin session flag is set.
   * @returns {boolean}
   */
  function isAdminLoggedIn() {
    return sessionStorage.getItem(AuthConfig.ADMIN_SESSION_KEY) === '1';
  }

  /**
   * Attempt to log in with the given credentials.
   * @param {string} username
   * @param {string} password
   * @returns {boolean} true if credentials match, false otherwise.
   */
  function login(username, password) {
    var creds = AuthConfig.ADMIN_CREDENTIALS;
    if (username === creds.username && password === creds.password) {
      sessionStorage.setItem(AuthConfig.ADMIN_SESSION_KEY, '1');
      return true;
    }
    return false;
  }

  /**
   * Log out the admin (clear session flag and company token).
   */
  function logout() {
    sessionStorage.removeItem(AuthConfig.ADMIN_SESSION_KEY);
    clearCompanyToken();
  }

  /**
   * Request a company context token from the server for the given company.
   * The returned encrypted token is cached in sessionStorage.
   * @param {string} companyCode — identifier of the company to select.
   * @returns {Promise<string>} Resolves to the encrypted token string.
   */
  function selectCompany(companyCode) {
    return ApiClient.postJSON(AuthConfig.SELECT_COMPANY_ENDPOINT, { companyCode: companyCode })
      .then(function (data) {
        var token = typeof data === 'string' ? data : data.encryptedContext;
        if (!token) throw new Error('No company context token received');
        sessionStorage.setItem(AuthConfig.ADMIN_COMPANY_TOKEN_KEY, token);
        return token;
      });
  }

  /**
   * Retrieve the cached admin company context token.
   * @returns {string|null}
   */
  function getCompanyToken() {
    return sessionStorage.getItem(AuthConfig.ADMIN_COMPANY_TOKEN_KEY) || null;
  }

  /**
   * Remove the cached admin company context token.
   */
  function clearCompanyToken() {
    sessionStorage.removeItem(AuthConfig.ADMIN_COMPANY_TOKEN_KEY);
  }

  // Public API
  return {
    isAdminLoggedIn: isAdminLoggedIn,
    login: login,
    logout: logout,
    selectCompany: selectCompany,
    getCompanyToken: getCompanyToken,
    clearCompanyToken: clearCompanyToken
  };
})();
