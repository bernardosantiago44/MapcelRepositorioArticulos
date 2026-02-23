/**
 * Admin Login UI Module
 * Renders a full-screen login overlay and validates credentials through
 * AdminAuth.  On success it invokes a caller-supplied callback so the main
 * application can continue booting.
 *
 * Depends on: AdminAuth
 * @namespace AdminLoginUI
 */
var AdminLoginUI = (function () {
  'use strict';

  var OVERLAY_ID   = 'admin-login-overlay';
  var FORM_ID      = 'admin-login-form';
  var USER_ID      = 'admin-login-user';
  var PASS_ID      = 'admin-login-pass';
  var ERROR_ID     = 'admin-login-error';
  var SUBMIT_ID    = 'admin-login-submit';

  /**
   * Show the admin login screen.
   * @param {Function} onSuccess — called (with no args) after a successful login.
   */
  function show(onSuccess) {
    // Prevent duplicates
    if (document.getElementById(OVERLAY_ID)) return;

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'admin-login-overlay';
    overlay.innerHTML =
      '<div class="admin-login-card">' +
        '<h2 class="admin-login-title">Inicio de Sesión — Administrador</h2>' +
        '<form id="' + FORM_ID + '" autocomplete="off">' +
          '<label class="admin-login-label" for="' + USER_ID + '">Usuario</label>' +
          '<input class="admin-login-input" id="' + USER_ID + '" type="text" autocomplete="username" />' +
          '<label class="admin-login-label" for="' + PASS_ID + '">Contraseña</label>' +
          '<input class="admin-login-input" id="' + PASS_ID + '" type="password" autocomplete="current-password" />' +
          '<div id="' + ERROR_ID + '" class="admin-login-error" style="display:none;">Credenciales inválidas</div>' +
          '<button id="' + SUBMIT_ID + '" class="admin-login-btn" type="submit">Ingresar</button>' +
        '</form>' +
      '</div>';

    document.body.appendChild(overlay);

    // Focus username field
    var userInput = document.getElementById(USER_ID);
    if (userInput) userInput.focus();

    // Handle form submit
    var form = document.getElementById(FORM_ID);
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var username = document.getElementById(USER_ID).value.trim();
      var password = document.getElementById(PASS_ID).value;
      var errorEl  = document.getElementById(ERROR_ID);

      if (AdminAuth.login(username, password)) {
        hide();
        if (typeof onSuccess === 'function') onSuccess();
      } else {
        errorEl.style.display = 'block';
      }
    });
  }

  /**
   * Remove the login overlay from the DOM.
   */
  function hide() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) el.parentNode.removeChild(el);
  }

  // Public API
  return {
    show: show,
    hide: hide
  };
})();
