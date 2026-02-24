/**
 * Auth Context Module
 * Captures the encrypted auth-context value from the URL, persists it in
 * sessionStorage, and strips it from the address bar.
 *
 * Depends on: AuthConfig
 * @namespace AuthContext
 */
var AuthContext = (function () {
  'use strict';

  /**
   * Read the auth-context value from the current URL query string.
   * @returns {string|null} The raw (opaque) encrypted string, or null.
   */
  function getAuthContextFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var value = params.get(AuthConfig.AUTH_CONTEXT_PARAM_NAME);
    if (!value) return null;
    return encodeURIComponent(value) || null;
  }

  /**
   * Persist the auth-context value in sessionStorage.
   * @param {string} value — opaque encrypted string.
   */
  function persistAuthContext(value) {
    if (value) {
      sessionStorage.setItem(AuthConfig.AUTH_CONTEXT_STORAGE_KEY, value);
    }
  }

  /**
   * Retrieve the persisted auth-context value.
   * @returns {string|null}
   */
  function getPersistedAuthContext() {
    // Undo form encoding / URL encoding and restore '+'
    const raw = sessionStorage.getItem(AuthConfig.AUTH_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const value = decodeURIComponent(raw).replace(/ /g, '+');
    return value;
  }

  /**
   * Remove the auth-context value from sessionStorage.
   */
  function clearAuthContext() {
    sessionStorage.removeItem(AuthConfig.AUTH_CONTEXT_STORAGE_KEY);
  }

  /**
   * Remove the auth-context parameter from the browser URL without causing a
   * page reload (uses history.replaceState).
   */
  function stripAuthContextFromUrl() {
    var url = new URL(window.location.href);
    url.searchParams.delete(AuthConfig.AUTH_CONTEXT_PARAM_NAME);
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  /**
   * Convenience: returns true when a company-scoped context is available
   * (either freshly read from the URL or previously persisted).
   * @returns {boolean}
   */
  function isCompanyScoped() {
    return !!getPersistedAuthContext();
  }

  // Public API
  return {
    getAuthContextFromUrl: getAuthContextFromUrl,
    persistAuthContext: persistAuthContext,
    getPersistedAuthContext: getPersistedAuthContext,
    clearAuthContext: clearAuthContext,
    stripAuthContextFromUrl: stripAuthContextFromUrl,
    isCompanyScoped: isCompanyScoped
  };
})();
