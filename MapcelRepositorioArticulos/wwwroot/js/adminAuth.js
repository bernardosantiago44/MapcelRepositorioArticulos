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
   * Log out the admin (clear session flag).
   */
  function logout() {
    sessionStorage.removeItem(AuthConfig.ADMIN_SESSION_KEY);
  }

  // Public API
  return {
    isAdminLoggedIn: isAdminLoggedIn,
    login: login,
    logout: logout
  };
})();
