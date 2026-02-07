/**
 * Grid Filter Service Module
 * Handles filtering logic for the articles grid
 * 
 * Supports:
 * - Global text search across Title, Description, Client Comments, and Tag Names
 * - Status filtering
 * - Date range filtering (created_at)
 * - Tag filtering (AND logic - articles must have ALL selected tags)
 * 
 * All filters are combined using AND logic.
 * 
 * Dependencies:
 * - articleService.js (for fetching articles)
 */

var GridFilterService = (function() {
  'use strict';
  
  // Filter state
  var filterState = {
    searchQuery: '',
    statusFilter: null,
    dateRangeStart: null,
    dateRangeEnd: null,
    selectedTagIds: []
  };
  
  // Debounce timer for search
  var searchDebounceTimer = null;
  var SEARCH_DEBOUNCE_DELAY = 300; // milliseconds
  
  /**
   * Set the search query with debouncing
   * @param {string} query - Search text
   * @param {Function} onFilterChange - Callback when filter changes
   */
  function setSearchQuery(query, onFilterChange) {
    // Clear any existing debounce timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Set a new debounce timer
    searchDebounceTimer = setTimeout(function() {
      filterState.searchQuery = (query || '').toLowerCase().trim();
      if (onFilterChange) {
        onFilterChange();
      }
    }, SEARCH_DEBOUNCE_DELAY);
  }
  
  /**
   * Set the search query immediately without debouncing
   * @param {string} query - Search text
   */
  function setSearchQueryImmediate(query) {
    filterState.searchQuery = (query || '').toLowerCase().trim();
  }
  
  /**
   * Set the status filter
   * @param {string|null} status - Status value or null to clear
   */
  function setStatusFilter(status) {
    filterState.statusFilter = status || null;
  }
  
  /**
   * Set the date range filter
   * @param {string|null} startDate - Start date (YYYY-MM-DD) or null
   * @param {string|null} endDate - End date (YYYY-MM-DD) or null
   */
  function setDateRangeFilter(startDate, endDate) {
    filterState.dateRangeStart = startDate || null;
    filterState.dateRangeEnd = endDate || null;
  }
  
  /**
   * Set the selected tags for filtering
   * @param {Array<string>} tagIds - Array of tag IDs
   */
  function setTagFilter(tagIds) {
    filterState.selectedTagIds = tagIds || [];
  }
  
  /**
   * Clear all filters
   */
  function clearAllFilters() {
    filterState.searchQuery = '';
    filterState.statusFilter = null;
    filterState.dateRangeStart = null;
    filterState.dateRangeEnd = null;
    filterState.selectedTagIds = [];
    
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
  }
  
  /**
   * Get current filter state
   * @returns {Object} Current filter state
   */
  function getFilterState() {
    return {
      searchQuery: filterState.searchQuery,
      statusFilter: filterState.statusFilter,
      dateRangeStart: filterState.dateRangeStart,
      dateRangeEnd: filterState.dateRangeEnd,
      selectedTagIds: filterState.selectedTagIds.slice() // Return a copy
    };
  }
  
  /**
   * Check if any filters are active
   * @returns {boolean} True if any filter is active
   */
  function hasActiveFilters() {
    return filterState.searchQuery !== '' ||
           filterState.statusFilter !== null ||
           filterState.dateRangeStart !== null ||
           filterState.dateRangeEnd !== null ||
           filterState.selectedTagIds.length > 0;
  }
  
  /**
   * Precompute normalized search strings for all articles
   * Creates _tagSearchString (e.g., "|taga|tagb|") and _searchableText for O(n) filtering
   * @param {Array<Object>} articles - Array of article objects with resolved tags
   */
  function precomputeSearchIndex(articles) {
    if (!articles || !Array.isArray(articles)) return;
    
    articles.forEach(function(article) {
      // Build normalized tag search string: "|tag1|tag2|tag3|"
      var tagNames = [];
      if (article.tags && Array.isArray(article.tags)) {
        tagNames = article.tags.map(function(tag) {
          return (tag && tag.name) ? tag.name.toLowerCase() : '';
        }).filter(function(name) { return name !== ''; });
      }
      article._tagSearchString = '|' + tagNames.join('|') + '|';
      
      // Build combined searchable text for single indexOf check
      var parts = [
        (article.title || '').toLowerCase(),
        (article.description || '').toLowerCase(),
        (article.clientComments || '').toLowerCase(),
        article._tagSearchString
      ];
      article._searchableText = parts.join(' ');
    });
  }
  
  /**
   * Check if an article matches the text search query
   * Uses precomputed _searchableText for O(n) filtering
   * @param {Object} article - Article object with resolved tags
   * @param {string} query - Search query (lowercase)
   * @returns {boolean} True if article matches
   */
  function matchesSearchQuery(article, query) {
    if (!query) return true;
    
    // Use precomputed searchable text if available (O(1) lookup)
    if (article._searchableText) {
      return article._searchableText.indexOf(query) !== -1;
    }
    
    // Fallback to individual field search if index not built
    // Search in title
    if (article.title && article.title.toLowerCase().indexOf(query) !== -1) {
      return true;
    }
    
    // Search in description
    if (article.description && article.description.toLowerCase().indexOf(query) !== -1) {
      return true;
    }
    
    // Search in client comments
    if (article.clientComments && article.clientComments.toLowerCase().indexOf(query) !== -1) {
      return true;
    }
    
    // Search in tag names using precomputed string if available, otherwise iterate
    if (article._tagSearchString) {
      return article._tagSearchString.indexOf(query) !== -1;
    }
    
    // Fallback: iterate tags (slower)
    if (article.tags && Array.isArray(article.tags)) {
      for (var i = 0; i < article.tags.length; i++) {
        var tag = article.tags[i];
        if (tag && tag.name && tag.name.toLowerCase().indexOf(query) !== -1) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if an article matches the status filter
   * @param {Object} article - Article object
   * @param {string|null} status - Status filter value
   * @returns {boolean} True if article matches
   */
  function matchesStatusFilter(article, status) {
    if (!status) return true;
    return article.status === status;
  }
  
  /**
   * Check if an article matches the date range filter
   * @param {Object} article - Article object
   * @param {string|null} startDate - Start date (YYYY-MM-DD)
   * @param {string|null} endDate - End date (YYYY-MM-DD)
   * @returns {boolean} True if article matches
   */
  function matchesDateRange(article, startDate, endDate) {
    if (!startDate && !endDate) return true;
    
    var articleDate = article.createdAt;
    if (!articleDate) return false;
    
    // Parse dates for comparison (using YYYY-MM-DD format allows string comparison)
    if (startDate && articleDate < startDate) {
      return false;
    }
    
    if (endDate && articleDate > endDate) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if an article matches the tag filter
   * Articles must have ALL selected tags (AND logic)
   * @param {Object} article - Article object with resolved tags
   * @param {Array<string>} selectedTagIds - Selected tag IDs
   * @returns {boolean} True if article has all selected tags
   */
  function matchesTagFilter(article, selectedTagIds) {
    if (!selectedTagIds || selectedTagIds.length === 0) return true;
    
    if (!article.tags || !Array.isArray(article.tags)) {
      return false;
    }
    
    // Get the tag IDs from the article (tags are resolved objects)
    var articleTagIds = article.tags.map(function(tag) {
      return tag.id;
    });
    
    // Check if all selected tags are present in the article
    for (var i = 0; i < selectedTagIds.length; i++) {
      if (articleTagIds.indexOf(selectedTagIds[i]) === -1) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Filter an array of articles based on current filter state
   * @param {Array<Object>} articles - Array of article objects with resolved tags
   * @returns {Array<Object>} Filtered array of articles
   */
  function filterArticles(articles) {
    if (!articles || !Array.isArray(articles)) {
      return [];
    }
    
    return articles.filter(function(article) {
      // All filters must pass (AND logic)
      return matchesSearchQuery(article, filterState.searchQuery) &&
             matchesStatusFilter(article, filterState.statusFilter) &&
             matchesDateRange(article, filterState.dateRangeStart, filterState.dateRangeEnd) &&
             matchesTagFilter(article, filterState.selectedTagIds);
    });
  }
  
  /**
   * Set the debounce delay for search (useful for configuration)
   * @param {number} delayMs - Delay in milliseconds
   */
  function setSearchDebounceDelay(delayMs) {
    if (typeof delayMs === 'number' && delayMs >= 0) {
      SEARCH_DEBOUNCE_DELAY = delayMs;
    }
  }
  
  // Public API
  return {
    setSearchQuery: setSearchQuery,
    setSearchQueryImmediate: setSearchQueryImmediate,
    setStatusFilter: setStatusFilter,
    setDateRangeFilter: setDateRangeFilter,
    setTagFilter: setTagFilter,
    clearAllFilters: clearAllFilters,
    getFilterState: getFilterState,
    hasActiveFilters: hasActiveFilters,
    filterArticles: filterArticles,
    setSearchDebounceDelay: setSearchDebounceDelay,
    precomputeSearchIndex: precomputeSearchIndex
  };
})();
