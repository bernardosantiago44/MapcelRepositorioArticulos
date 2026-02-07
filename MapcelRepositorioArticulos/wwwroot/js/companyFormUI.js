/**
 * Company Form UI Module
 * Provides a unified component for configuring the company's settings.
 * 
 * Features:
 * - Toggle settings for user permissions
 * - Toggle settings for workflow validation
 * - Scalable structure for adding new settings
 * 
 * Dependencies: 
 * - dataModels.js
 * - companyService.js
 * - Uses inline styles for DHTMLX compatibility
 */

const CompanyFormUI = (function() {
    'use strict';
    
    // MARK - State and constants
    let formState = {
        companyId: null,
        companyName: null,
        settingsWindow: null,
        currentSettings: null,
        onSaveCallback: null,
    };

    const FORM_WINDOW_WIDTH = 900;
    const FORM_WINDOW_HEIGHT = 850;
    
    /**
     * Settings configuration
     * This array defines all available settings with their metadata
     * To add a new setting, simply add a new object to this array
     */
    const SETTINGS_CONFIG = [
        {
            category: 'Permisos de Usuario',
            categoryDescription: 'Controla qué acciones pueden realizar los usuarios no-administradores',
            settings: [
                {
                    key: 'allow_user_uploads',
                    label: 'Permitir a usuarios no-admin subir imágenes y archivos',
                    description: 'Cuando está activo, los usuarios regulares pueden subir nuevos archivos e imágenes a la biblioteca.',
                    defaultValue: true
                },
                {
                    key: 'allow_user_tag_creation',
                    label: 'Permitir a usuarios no-admin crear nuevas etiquetas',
                    description: 'Cuando está activo, los usuarios regulares pueden crear nuevas etiquetas en el sistema.',
                    defaultValue: true
                }
            ]
        },
        {
            category: 'Validación de Flujo',
            categoryDescription: 'Configura las reglas de validación para los flujos de trabajo',
            settings: [
                {
                    key: 'require_client_comments',
                    label: 'Hacer obligatorios los comentarios del cliente al cerrar el ticket',
                    description: 'Cuando está activo, se requerirá que el campo de comentarios del cliente tenga contenido antes de poder cerrar un ticket.',
                    defaultValue: false
                }
            ]
        }
    ];
    
    // MARK - Functions
    
    /**
     * Reset form state
     */
    function resetFormState() {
        formState.companyId = null;
        formState.companyName = null;
        formState.settingsWindow = null;
        formState.currentSettings = null;
        formState.onSaveCallback = null;
    }
    
    /**
     * Create the DHTMLX window for the settings form
     * @returns {Object} DHTMLX window instance
     */
    function createCompanyFormWindow() {
        const dhxWindows = new dhtmlXWindows();
        
        const formWindow = dhxWindows.createWindow(
            'company_settings_window', 
            0, 0, 
            FORM_WINDOW_WIDTH, 
            FORM_WINDOW_HEIGHT
        );
        formWindow.setText('Configuración de la Compañía');
        formWindow.centerOnScreen();
        formWindow.setModal(true);
        formWindow.button('park').hide();
        formWindow.button('minmax').hide();
        
        return formWindow;
    }
    
    /**
     * Render the settings form HTML with inline styles (for DHTMLX compatibility)
     * @returns {string} HTML string for the settings form
     */
    function renderSettingsForm() {
        const settings = formState.currentSettings || getDefaultCompanySettings();
        
        let categoriesHtml = '';
        
        SETTINGS_CONFIG.forEach(function(category, categoryIndex) {
            let settingsHtml = '';
            
            category.settings.forEach(function(setting, settingIndex) {
                const isChecked = settings[setting.key] === true;
                const checkboxId = 'setting-' + setting.key;
                const hasBorder = categoryIndex > 0 || settingIndex > 0;
                
                settingsHtml += `
                    <div style="display: flex; align-items: flex-start; padding: 1rem 0; ${hasBorder ? 'border-top: 1px solid #f3f4f6;' : ''}">
                        <div style="flex: 1; padding-right: 1rem;">
                            <label for="${checkboxId}" style="display: block; font-size: 0.875rem; font-weight: 500; color: #111827; cursor: pointer; margin: 0;">
                                ${escapeHtml(setting.label)}
                            </label>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #6b7280;">
                                ${escapeHtml(setting.description)}
                            </p>
                        </div>
                        <div style="flex-shrink: 0;">
                            <button 
                                type="button"
                                id="${checkboxId}"
                                data-setting-key="${setting.key}"
                                role="switch"
                                aria-checked="${isChecked}"
                                class="setting-toggle"
                                style="position: relative; display: inline-flex; height: 24px; width: 44px; flex-shrink: 0; cursor: pointer; border-radius: 9999px; border: 2px solid transparent; transition: background-color 0.2s ease-in-out; background-color: ${isChecked ? '#2563eb' : '#d1d5db'};"
                            >
                                <span 
                                    aria-hidden="true" 
                                    style="pointer-events: none; display: inline-block; height: 20px; width: 20px; transform: translateX(${isChecked ? '20px' : '0px'}); border-radius: 9999px; background-color: white; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1); transition: transform 0.2s ease-in-out;"
                                ></span>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            categoriesHtml += `
                <div style="margin-bottom: 1.5rem;">
                    <div style="margin-bottom: 0.75rem;">
                        <h3 style="font-size: 0.75rem; font-weight: 600; color: #111827; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
                            ${escapeHtml(category.category)}
                        </h3>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #6b7280;">
                            ${escapeHtml(category.categoryDescription)}
                        </p>
                    </div>
                    <div style="background-color: white; border-radius: 0.5rem; border: 1px solid #e5e7eb; padding: 0 1rem;">
                        ${settingsHtml}
                    </div>
                </div>
            `;
        });
        
        return `
            <div style="height: 100%; display: flex; flex-direction: column; background-color: #f9fafb;">
                <!-- Header with company name -->
                <div style="padding: 1rem 1.5rem; background-color: white; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="flex-shrink: 0; width: 40px; height: 40px; background-color: #dbeafe; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                        </div>
                        <div>
                            <h2 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin: 0;">${escapeHtml(formState.companyName || 'Compañía')}</h2>
                            <p style="font-size: 0.875rem; color: #6b7280; margin: 0.25rem 0 0 0;">Configuración de permisos y flujos</p>
                        </div>
                    </div>
                </div>
                
                <!-- Settings Content -->
                <div style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                    ${categoriesHtml}
                </div>
                
                <!-- Footer with action buttons -->
                <div style="padding: 1rem 1.5rem; background-color: white; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button 
                        id="company-settings-cancel-btn"
                        style="padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; color: #374151; background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; cursor: pointer;"
                        onmouseover="this.style.backgroundColor='#f9fafb'"
                        onmouseout="this.style.backgroundColor='white'"
                    >
                        Cancelar
                    </button>
                    <button 
                        id="company-settings-save-btn"
                        style="padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; color: white; background-color: #2563eb; border: 1px solid transparent; border-radius: 0.375rem; cursor: pointer;"
                        onmouseover="this.style.backgroundColor='#1d4ed8'"
                        onmouseout="this.style.backgroundColor='#2563eb'"
                    >
                        Guardar cambios
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup event handlers for the settings form
     */
    function setupEventHandlers() {
        // Cancel button
        const cancelBtn = document.getElementById('company-settings-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                closeSettingsForm();
            });
        }
        
        // Save button
        const saveBtn = document.getElementById('company-settings-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                saveSettings();
            });
        }
        
        // Toggle buttons
        const toggleButtons = document.querySelectorAll('.setting-toggle');
        toggleButtons.forEach(function(toggle) {
            toggle.addEventListener('click', function() {
                handleToggleClick(toggle);
            });
        });
    }
    
    /**
     * Handle toggle button click
     * @param {HTMLElement} toggle - The toggle button element
     */
    function handleToggleClick(toggle) {
        const settingKey = toggle.getAttribute('data-setting-key');
        const isCurrentlyChecked = toggle.getAttribute('aria-checked') === 'true';
        const newValue = !isCurrentlyChecked;
        
        // Update visual state
        toggle.setAttribute('aria-checked', newValue);
        
        // Update toggle background color
        toggle.style.backgroundColor = newValue ? '#2563eb' : '#d1d5db';
        
        // Update toggle knob position
        const knob = toggle.querySelector('span');
        if (knob) {
            knob.style.transform = newValue ? 'translateX(20px)' : 'translateX(0px)';
        }
        
        // Update internal state
        if (formState.currentSettings) {
            formState.currentSettings[settingKey] = newValue;
        }
    }
    
    /**
     * Save the settings
     */
    function saveSettings() {
        if (!formState.companyId || !formState.currentSettings) {
            dhtmlx.alert({
                title: 'Error',
                text: 'No se pudo guardar la configuración. Datos incompletos.'
            });
            return;
        }
        
        // Show loading state on save button
        const saveBtn = document.getElementById('company-settings-save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';
        }
        
        // Collect current settings from toggles
        const newSettings = {};
        const toggleButtons = document.querySelectorAll('.setting-toggle');
        toggleButtons.forEach(function(toggle) {
            const settingKey = toggle.getAttribute('data-setting-key');
            const isChecked = toggle.getAttribute('aria-checked') === 'true';
            newSettings[settingKey] = isChecked;
        });
        
        // Save via CompanyService
        CompanyService.updateCompanySettings(formState.companyId, newSettings)
            .then(function(response) {
                if (response.status === 'success') {
                    dhtmlx.message({
                        text: 'Configuración guardada exitosamente',
                        type: 'success',
                        expire: 3000
                    });
                    
                    // Call the save callback if provided and is a function
                    if (formState.onSaveCallback && typeof formState.onSaveCallback === 'function') {
                        formState.onSaveCallback(newSettings);
                    }
                    
                    closeSettingsForm();
                }
            })
            .catch(function(error) {
                console.error('Error saving settings:', error);
                dhtmlx.alert({
                    title: 'Error',
                    text: 'No se pudo guardar la configuración. Por favor, inténtelo de nuevo.'
                });
                
                // Reset save button state
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Guardar cambios';
                }
            });
    }
    
    /**
     * Close the settings form
     */
    function closeSettingsForm() {
        if (formState.settingsWindow) {
            formState.settingsWindow.close();
        }
        resetFormState();
    }
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Open the company settings form
     * @param {string} companyId - The company ID
     * @param {Function} onSaveCallback - Callback function after settings are saved
     */
    function openSettingsForm(companyId, onSaveCallback) {
        resetFormState();
        
        formState.companyId = companyId;
        formState.onSaveCallback = onSaveCallback;
        
        // Load company data and settings
        Promise.all([
            ArticleService.getCompanyById(companyId),
            CompanyService.getCompanySettings(companyId)
        ])
        .then(function(results) {
            const company = results[0];
            const settings = results[1];
            
            if (!company) {
                throw new Error('Company not found');
            }
            
            formState.companyName = company.name;
            formState.currentSettings = Object.assign({}, settings); // Clone to avoid modifying original
            
            // Create and show the window
            formState.settingsWindow = createCompanyFormWindow();
            formState.settingsWindow.attachHTMLString(renderSettingsForm());
            
            // Setup event handlers after DOM is ready
            setTimeout(function() {
                setupEventHandlers();
            }, 100);
        })
        .catch(function(error) {
            console.error('Error loading company settings:', error);
            dhtmlx.alert({
                title: 'Error',
                text: 'No se pudo cargar la configuración de la compañía.'
            });
        });
    }
    
    return {
        openSettingsForm: openSettingsForm,
        closeSettingsForm: closeSettingsForm
    };
})();