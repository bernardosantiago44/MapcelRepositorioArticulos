/**
 * Utility Functions Module
 * Shared utility functions used across the application
 */

const Utils = (function() {
  'use strict';
  
  /**
   * HTML escape a string to prevent XSS attacks
   * @param {string} str - String to escape
   * @returns {string} Escaped string safe for HTML insertion
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) {
      return '';
    }
    
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
  
  /**
   * Format date for display
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {string} Formatted date
   */
  function formatDate(dateString) {
    if (!dateString) return '—';
    
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const parts = dateString.split('-');
    
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const month = months[parseInt(parts[1], 10) - 1];
      const year = parts[0];
      
      return day + ' ' + month + ' ' + year;
    }
    
    return dateString;
  }
  
  /**
   * Get file extension from filename
   * @param {string} filename - File name
   * @returns {string} File extension in lowercase
   */
  function getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }
  
  /**
   * Debounce function to limit execution rate
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Render markdown to safe HTML (falls back to escaped text)
   * @param {string} markdownText - Raw markdown text
   * @returns {string} Safe HTML string
   */
  function renderMarkdown(markdownText) {
    const rawText = markdownText || '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      const html = marked.parse(rawText, { breaks: true });
      if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
        return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
      }
      return html;
    }
    return escapeHtml(rawText).replace(/\n/g, '<br>');
  }

    /**
   * Apply markdown action to description textarea
   * @param {string} textAreaId - Textarea element ID
   * @param {string} action - Action name
   */
  function applyMarkdownActionToTextArea(textAreaId, action) {
    var textarea = document.getElementById(textAreaId);
    if (!textarea) return;

    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || 0;
    var selectedText = textarea.value.substring(start, end);

    var before = textarea.value.substring(0, start);
    var after = textarea.value.substring(end);
    var newText = '';
    var cursorStart = start;
    var cursorEnd = end;

    if (action === 'bold') {
      newText = '**' + (selectedText || 'texto en negrita') + '**';
      cursorStart = start + 2;
      cursorEnd = start + newText.length - 2;
    } else if (action === 'italic') {
      newText = '_' + (selectedText || 'texto en cursiva') + '_';
      cursorStart = start + 1;
      cursorEnd = start + newText.length - 1;
    } else if (action === 'heading') {
      newText = '# ' + (selectedText || 'Titulo');
      cursorStart = start + 2;
      cursorEnd = start + newText.length;
    } else if (action === 'list') {
      newText = '- ' + (selectedText || 'Elemento de lista');
      cursorStart = start + 2;
      cursorEnd = start + newText.length;
    } else if (action === 'link') {
      newText = '[' + (selectedText || 'Texto del enlace') + '](https://)';
      cursorStart = start + 1;
      cursorEnd = start + (selectedText ? selectedText.length + 1 : 17);
    } else if (action === 'code') {
      newText = '`' + (selectedText || 'codigo') + '`';
      cursorStart = start + 1;
      cursorEnd = start + newText.length - 1;
    } 
    else if (action === 'image') {
      newText = '![' + (selectedText || 'Texto alternativo') + '](https://)';
      cursorStart = start + 2;
      cursorEnd = start + (selectedText ? selectedText.length + 2 : 19);
    } 
    else {
      return;
    }

    textarea.value = before + newText + after;
    textarea.focus();
    textarea.setSelectionRange(cursorStart, cursorEnd);

    if (formState.descriptionTab === 'preview') {
      updateDescriptionPreview();
    }
  }
  
  // Public API
  return {
    escapeHtml,
    formatDate,
    getFileExtension,
    debounce,
    applyMarkdownActionToTextArea,
    renderMarkdown
  };
})();
