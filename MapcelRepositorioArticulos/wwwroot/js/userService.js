/**
 * User Service Module
 * Manages user authentication and role-based access control
 */

const UserService = (function() {
  'use strict';
  
  /**
   * User Model
   * @typedef {Object} User
   * @property {string} id - Unique user identifier
   * @property {string} name - User's display name
   * @property {('admin'|'regular')} role - User's role in the system
   * @property {string|null} companyCode - Assigned company code (null for admins, required for regular users)
   */
  
  // Mock users for testing
  const mockUsers = {
    admin: {
      id: 'user-admin-01',
      name: 'Admin Usuario',
      role: 'admin',
      companyCode: null
    },
    regular: {
      id: 'user-regular-01',
      name: 'Usuario Regular',
      role: 'regular',
      companyCode: null
    }
  };
  
  // Current logged-in user
  let currentUser = mockUsers.admin; // Default to admin for testing
  
  /**
   * Get the current logged-in user
   * @returns {User} Current user object
   */
  function getCurrentUser() {
    return currentUser;
  }
  
  /**
   * Check if current user is an administrator
   * @returns {boolean} True if user is admin
   */
  function isAdministrator() {
    return currentUser && currentUser.role === 'admin';
  }
  
  /**
   * Check if current user is a regular user
   * @returns {boolean} True if user is regular
   */
  function isRegularUser() {
    return currentUser && currentUser.role === 'regular';
  }
  
  /**
   * Get the company code for the current user
   * For admins, this can be set/changed via setCurrentCompanyForAdmin
   * For regular users, this is their assigned companyCode
   * @returns {string|null} Company code or null
   */
  function getCurrentUserCompanyCode() {
    return currentUser ? currentUser.companyCode : null;
  }
  
  /**
   * Set the current company for admin users
   * This allows admins to switch between companies
   * @param {string} companyCode - The company code to set
   * @returns {boolean} True if company was set, false if user is not admin
   */
  function setCurrentCompanyForAdmin(companyCode) {
    if (isAdministrator()) {
      currentUser.companyCode = companyCode;
      return true;
    } else {
      console.warn('Only administrators can switch companies');
      return false;
    }
  }
  
  /**
   * Toggle between admin and regular user for testing purposes
   * @returns {User} The new current user
   */
  function toggleUserRole() {
    if (currentUser.role === 'admin') {
      currentUser = mockUsers.regular;
    } else {
      currentUser = mockUsers.admin;
    }
    return currentUser;
  }
  
  /**
   * Set current user (for testing)
   * @param {('admin'|'regular')} roleType - Role type to set
   */
  function setCurrentUser(roleType) {
    if (mockUsers[roleType]) {
      currentUser = mockUsers[roleType];
    }
  }
  
  // Public API
  return {
    getCurrentUser: getCurrentUser,
    isAdministrator: isAdministrator,
    isRegularUser: isRegularUser,
    getCurrentUserCompanyCode: getCurrentUserCompanyCode,
    setCurrentCompanyForAdmin: setCurrentCompanyForAdmin,
    toggleUserRole: toggleUserRole,
    setCurrentUser: setCurrentUser
  };
})();
