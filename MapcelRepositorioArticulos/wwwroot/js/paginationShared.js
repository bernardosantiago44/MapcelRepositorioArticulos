/**
 * Shared pagination utilities for tabs that need URL-driven state.
 * Provides helpers to normalize values, read/write query params,
 * and render a consistent pagination UI.
 */
(function(global) {
  'use strict';

  var DEFAULT_PAGE_SIZE = 10;

  function normalizePageNumber(pageNumber, totalPages) {
    var safePage = isNaN(pageNumber) || pageNumber <= 0 ? 1 : pageNumber;
    if (!totalPages || totalPages <= 0) return safePage;
    return Math.min(Math.max(safePage, 1), totalPages);
  }

  function getPageFromUrl(defaultPage) {
    var params = new URLSearchParams(window.location.search);
    var pageParam = parseInt(params.get('page'), 10);
    if (isNaN(pageParam) || pageParam <= 0) {
      return defaultPage || 1;
    }
    return pageParam;
  }

  function getPageSizeFromUrl(defaultSize) {
    var params = new URLSearchParams(window.location.search);
    var pageSizeParam = parseInt(params.get('pageSize'), 10);
    if (isNaN(pageSizeParam) || pageSizeParam <= 0) {
      return defaultSize || DEFAULT_PAGE_SIZE;
    }
    return pageSizeParam;
  }

  /** Extracts the selected tab from the url. 
   * @return {string}
   */
  function getTabFromUrl(defaultTab, allowedTabs) {
    var params = new URLSearchParams(window.location.search);
    var tabParam = (params.get('tab') || '').toLowerCase();
    if (allowedTabs && allowedTabs.indexOf(tabParam) === -1) {
      return defaultTab;
    }
    return tabParam || defaultTab;
  }

  function updateUrlState(state) {
    var url = new URL(window.location.href);
    if (state.tab) {
      url.searchParams.set('tab', state.tab);
    }
    if (state.page) {
      url.searchParams.set('page', state.page);
    }
    if (state.pageSize) {
      url.searchParams.set('pageSize', state.pageSize);
    }
    window.history.pushState({}, '', url.toString());
  }

  function renderPagination(containerIdOrElement, meta, onPageChange) {
    var container = typeof containerIdOrElement === 'string'
      ? document.getElementById(containerIdOrElement)
      : containerIdOrElement;
    if (!container) return;

    var currentPage = Number(meta.currentPage || meta.page || 1);
    var totalPages = Number(meta.totalPages || 1);
    var total = Number(meta.total || 0);
    var pageSize = Number(meta.pageSize || DEFAULT_PAGE_SIZE);
    var start = total === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
    var end = Math.min(total, currentPage * pageSize);

    container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.className = 'flex h-full w-full items-center justify-between px-3 py-2 text-sm';

    var infoText = document.createElement('div');
    infoText.className = 'text-gray-700';
    infoText.textContent = total === 0
      ? 'Sin resultados'
      : 'Mostrando ' + start + ' - ' + end + ' de ' + total;

    var controls = document.createElement('div');
    controls.className = 'flex items-center gap-2';

    function createButton(label, action, disabled) {
      var btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.action = action;
      btn.className = 'px-2 py-1 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50';
      btn.disabled = disabled;
      return btn;
    }

    var firstBtn = createButton('«', 'first', currentPage <= 1);
    var prevBtn = createButton('Anterior', 'prev', currentPage <= 1);
    var pageLabel = document.createElement('div');
    pageLabel.className = 'px-3 py-1 rounded bg-gray-100 text-gray-700 font-medium';
    pageLabel.textContent = 'Página ' + currentPage + ' de ' + totalPages;
    var nextBtn = createButton('Siguiente', 'next', currentPage >= totalPages);
    var lastBtn = createButton('»', 'last', currentPage >= totalPages);

    controls.appendChild(firstBtn);
    controls.appendChild(prevBtn);
    controls.appendChild(pageLabel);
    controls.appendChild(nextBtn);
    controls.appendChild(lastBtn);

    wrapper.appendChild(infoText);
    wrapper.appendChild(controls);
    container.appendChild(wrapper);

    var actionButtons = container.querySelectorAll('button[data-action]');
    actionButtons.forEach(function(btn) {
      btn.onclick = function() {
        var action = btn.getAttribute('data-action');
        if (!onPageChange) return;
        if (action === 'prev') {
          onPageChange(currentPage - 1);
        } else if (action === 'next') {
          onPageChange(currentPage + 1);
        } else if (action === 'first') {
          onPageChange(1);
        } else if (action === 'last') {
          onPageChange(totalPages);
        }
      };
    });
  }

  global.PaginationShared = {
    DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
    normalizePageNumber: normalizePageNumber,
    getPageFromUrl: getPageFromUrl,
    getPageSizeFromUrl: getPageSizeFromUrl,
    getTabFromUrl: getTabFromUrl,
    updateUrlState: updateUrlState,
    renderPagination: renderPagination
  };
})(window);
