/**
 * Auth Configuration Module
 * Single source of truth for authentication-related constants.
 *
 * Change the values here to adjust:
 *  - The URL query parameter that carries the encrypted context.
 *  - The HTTP headers used for company-scoped and admin requests.
 *  - The static admin credentials.
 *
 * @namespace AuthConfig
 */
var AuthConfig = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Auth-context schema contract (NFR-1)
  // The frontend never decrypts the value; this object documents the expected
  // shape so future field additions are organised in one place.
  // ---------------------------------------------------------------------------
  var AUTH_CONTEXT_SPEC = {
    version: 1,
    paramName: 'ctx',            // URL query key (FR-1)
    storageKey: 'APP_AUTH_CONTEXT', // sessionStorage key
    futureFields: [
      // Add field names here as they are introduced on the backend.
      // e.g. 'companyId', 'userId', 'locale'
    ]
  };

  // ---------------------------------------------------------------------------
  // HTTP header names
  // ---------------------------------------------------------------------------
  /** Header sent when the app is in company-scoped mode. */
  var AUTH_CONTEXT_HEADER_NAME = 'X-App-Context';

  /** Header sent when the app is in admin mode. */
  var ADMIN_HEADER_NAME = 'X-Admin-Session';

  // ---------------------------------------------------------------------------
  // Static admin credentials (FR-4) — centralised, easy to change
  // ---------------------------------------------------------------------------
  var ADMIN_CREDENTIALS = Object.freeze({
    username: 'admin',
    password: 'changeMe'
  });

  /** sessionStorage key that tracks whether admin has logged in. */
  var ADMIN_SESSION_KEY = 'ADMIN_LOGGED_IN';

  // Public API
  return {
    AUTH_CONTEXT_SPEC: AUTH_CONTEXT_SPEC,
    AUTH_CONTEXT_PARAM_NAME: AUTH_CONTEXT_SPEC.paramName,
    AUTH_CONTEXT_STORAGE_KEY: AUTH_CONTEXT_SPEC.storageKey,
    AUTH_CONTEXT_HEADER_NAME: AUTH_CONTEXT_HEADER_NAME,
    ADMIN_HEADER_NAME: ADMIN_HEADER_NAME,
    ADMIN_CREDENTIALS: ADMIN_CREDENTIALS,
    ADMIN_SESSION_KEY: ADMIN_SESSION_KEY
  };
})();
