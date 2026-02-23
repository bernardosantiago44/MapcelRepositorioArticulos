/**
 * API Client Module
 * Wrapper around fetch() that automatically attaches the correct auth header
 * depending on the current application mode (company-scoped or admin).
 *
 * Depends on: AuthConfig, AuthContext, AdminAuth
 * @namespace ApiClient
 */
var ApiClient = (function () {
  'use strict';

  /**
   * Build the auth headers for the current session.
   * @returns {Object} Headers object to merge into fetch options.
   * @throws {Error} If neither auth mode is active.
   */
  function _getAuthHeaders() {
    var ctx = AuthContext.getPersistedAuthContext();
    if (ctx) {
      var h = {};
      h[AuthConfig.AUTH_CONTEXT_HEADER_NAME] = ctx;
      return h;
    }
    if (AdminAuth.isAdminLoggedIn()) {
      var h = {};
      h[AuthConfig.ADMIN_HEADER_NAME] = '1';
      return h;
    }
    throw new Error('No active auth session');
  }

  /**
   * Perform an authenticated fetch request.
   *
   * @param {string} url
   * @param {Object} [options]  — standard fetch options (method, body, etc.)
   * @returns {Promise<Response>}
   */
  function request(url, options) {
    options = options || {};

    var authHeaders;
    try {
      authHeaders = _getAuthHeaders();
    } catch (e) {
      return Promise.reject(e);
    }

    // Merge caller-provided headers with auth headers
    var merged = Object.assign({}, options.headers || {}, authHeaders);
    options.headers = merged;

    return fetch(url, options);
  }

  /**
   * Convenience: GET JSON
   * @param {string} url
   * @returns {Promise<any>}
   */
  function getJSON(url) {
    return request(url, {
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.json();
    });
  }

  /**
   * Convenience: POST JSON
   * @param {string} url
   * @param {any} body
   * @returns {Promise<any>}
   */
  function postJSON(url, body) {
    return request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.json();
    });
  }

  // Public API
  return {
    request: request,
    getJSON: getJSON,
    postJSON: postJSON
  };
})();
