// Admin Panel JavaScript
// Handles authentication, data fetching, UI updates, and auto-refresh

(function() {
    'use strict';

    // ============================================
    // Constants
    // ============================================
    const API_KEY_STORAGE_KEY = 'admin_api_key';
    const REFRESH_INTERVAL_MS = 5000;

    // ============================================
    // DOM Elements
    // ============================================
    const elements = {
        // Login section
        loginSection: document.getElementById('login-section'),
        dashboardSection: document.getElementById('dashboard-section'),
        loginForm: document.getElementById('login-form'),
        apiKeyInput: document.getElementById('api-key-input'),
        loginError: document.getElementById('login-error'),
        loginBtn: document.getElementById('login-btn'),
        
        // Dashboard
        logoutBtn: document.getElementById('logout-btn'),
        loadingOverlay: document.getElementById('loading-overlay'),
        errorBanner: document.getElementById('error-banner'),
        errorBannerText: document.getElementById('error-banner-text'),
        
        // Stats
        statTotalOnline: document.getElementById('stat-total-online'),
        statTextMode: document.getElementById('stat-text-mode'),
        statVideoMode: document.getElementById('stat-video-mode'),
        statWaiting: document.getElementById('stat-waiting'),
        statRealChat: document.getElementById('stat-real-chat'),
        statBotChat: document.getElementById('stat-bot-chat'),
        statTextQueue: document.getElementById('stat-text-queue'),
        statVideoQueue: document.getElementById('stat-video-queue'),
        statVisitors: document.getElementById('stat-visitors'),
        statConnections: document.getElementById('stat-connections'),
        statMessages: document.getElementById('stat-messages'),
        statUptime: document.getElementById('stat-uptime'),
        
        // Users table
        usersTableBody: document.getElementById('users-table-body'),
        
        // Footer
        lastUpdated: document.getElementById('last-updated'),
        refreshIndicator: document.getElementById('refresh-indicator'),
        autoRefreshStatus: document.getElementById('auto-refresh-status')
    };

    // ============================================
    // State
    // ============================================
    let refreshIntervalId = null;


    // ============================================
    // Authentication Functions (Task 4.1)
    // ============================================

    /**
     * Validates the API key by testing it against the admin API
     * @param {string} key - The API key to validate
     * @returns {Promise<boolean>} - True if valid, false otherwise
     */
    async function validateApiKey(key) {
        try {
            const response = await fetch('/api/admin/stats', {
                method: 'GET',
                headers: {
                    'X-Admin-Key': key
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Error validating API key:', error);
            return false;
        }
    }

    /**
     * Stores the API key in sessionStorage
     * @param {string} key - The API key to store
     */
    function storeApiKey(key) {
        sessionStorage.setItem(API_KEY_STORAGE_KEY, key);
    }

    /**
     * Retrieves the stored API key from sessionStorage
     * @returns {string|null} - The stored API key or null
     */
    function getStoredApiKey() {
        return sessionStorage.getItem(API_KEY_STORAGE_KEY);
    }

    /**
     * Logs out the user by clearing the session and showing login form
     */
    function logout() {
        // Clear stored API key
        sessionStorage.removeItem(API_KEY_STORAGE_KEY);
        
        // Stop auto-refresh
        stopAutoRefresh();
        
        // Hide dashboard, show login
        elements.dashboardSection.classList.add('hidden');
        elements.loginSection.classList.remove('hidden');
        
        // Clear the input field
        elements.apiKeyInput.value = '';
        
        // Hide any error messages
        elements.loginError.classList.add('hidden');
    }

    /**
     * Shows the dashboard after successful login
     */
    function showDashboard() {
        elements.loginSection.classList.add('hidden');
        elements.dashboardSection.classList.remove('hidden');
        elements.loadingOverlay.classList.remove('hidden');
    }

    /**
     * Handles the login form submission
     * @param {Event} event - The form submit event
     */
    async function handleLogin(event) {
        event.preventDefault();
        
        const apiKey = elements.apiKeyInput.value.trim();
        
        if (!apiKey) {
            showLoginError('Please enter an API key.');
            return;
        }
        
        // Disable button during validation
        elements.loginBtn.disabled = true;
        elements.loginBtn.querySelector('span').textContent = 'Validating...';
        
        const isValid = await validateApiKey(apiKey);
        
        if (isValid) {
            // Store the key and show dashboard
            storeApiKey(apiKey);
            elements.loginError.classList.add('hidden');
            showDashboard();
            
            // Fetch initial data and start auto-refresh
            await fetchAndUpdateDashboard();
            startAutoRefresh();
        } else {
            showLoginError('Invalid API key. Please try again.');
        }
        
        // Re-enable button
        elements.loginBtn.disabled = false;
        elements.loginBtn.querySelector('span').textContent = 'Access Dashboard';
    }

    /**
     * Shows a login error message
     * @param {string} message - The error message to display
     */
    function showLoginError(message) {
        elements.loginError.querySelector('.error-text').textContent = message;
        elements.loginError.classList.remove('hidden');
    }


    // ============================================
    // Dashboard Data Fetching (Task 4.2)
    // ============================================

    /**
     * Fetches stats from the admin API
     * @returns {Promise<Object|null>} - The stats data or null on error
     */
    async function fetchStats() {
        const apiKey = getStoredApiKey();
        
        if (!apiKey) {
            logout();
            return null;
        }
        
        try {
            const response = await fetch('/api/admin/stats', {
                method: 'GET',
                headers: {
                    'X-Admin-Key': apiKey
                }
            });
            
            if (response.status === 401) {
                // Unauthorized - invalid or expired key
                showErrorBanner('Session expired. Please log in again.');
                logout();
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            hideErrorBanner();
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            showErrorBanner('Connection error. Retrying...');
            return null;
        }
    }

    /**
     * Shows the error banner with a message
     * @param {string} message - The error message to display
     */
    function showErrorBanner(message) {
        elements.errorBannerText.textContent = message;
        elements.errorBanner.classList.remove('hidden');
    }

    /**
     * Hides the error banner
     */
    function hideErrorBanner() {
        elements.errorBanner.classList.add('hidden');
    }


    // ============================================
    // UI Update Functions (Task 4.3)
    // ============================================

    /**
     * Formats a number with commas for thousands
     * @param {number} num - The number to format
     * @returns {string} - Formatted number string
     */
    function formatNumber(num) {
        return num.toLocaleString();
    }

    /**
     * Formats uptime seconds into a readable string
     * @param {number} seconds - Total seconds of uptime
     * @returns {string} - Formatted uptime string (e.g., "1h 30m 45s")
     */
    function formatUptime(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        let result = '';
        if (hours > 0) {
            result += `${hours}h `;
        }
        if (minutes > 0 || hours > 0) {
            result += `${minutes}m `;
        }
        result += `${secs}s`;
        
        return result.trim();
    }

    /**
     * Updates all dashboard stat cards with new data
     * @param {Object} data - The stats data from the API
     */
    function updateDashboard(data) {
        if (!data) return;
        
        // Online users stats
        if (data.online) {
            elements.statTotalOnline.textContent = formatNumber(data.online.total || 0);
            elements.statTextMode.textContent = formatNumber(data.online.text_mode || 0);
            elements.statVideoMode.textContent = formatNumber(data.online.video_mode || 0);
            elements.statWaiting.textContent = formatNumber(data.online.waiting_for_partner || 0);
            elements.statRealChat.textContent = formatNumber(data.online.chatting_with_real_user || 0);
            elements.statBotChat.textContent = formatNumber(data.online.chatting_with_bot || 0);
        }
        
        // Queue stats
        if (data.queues) {
            elements.statTextQueue.textContent = formatNumber(data.queues.text_queue || 0);
            elements.statVideoQueue.textContent = formatNumber(data.queues.video_queue || 0);
        }
        
        // Lifetime stats
        if (data.lifetime) {
            elements.statVisitors.textContent = formatNumber(data.lifetime.total_visitors || 0);
            elements.statConnections.textContent = formatNumber(data.lifetime.total_connections || 0);
            elements.statMessages.textContent = formatNumber(data.lifetime.total_messages || 0);
            elements.statUptime.textContent = formatUptime(data.lifetime.uptime_seconds || 0);
        }
        
        // Update users table
        if (data.users) {
            updateUsersTable(data.users);
        }
        
        // Update timestamp
        updateLastUpdated();
        
        // Hide loading overlay after first successful load
        elements.loadingOverlay.classList.add('hidden');
    }

    /**
     * Updates the active users table with new data
     * @param {Array} users - Array of user objects
     */
    function updateUsersTable(users) {
        if (!users || users.length === 0) {
            elements.usersTableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4">No active users</td>
                </tr>
            `;
            return;
        }
        
        const rows = users.map(user => {
            const modeIcon = user.mode === 'video' ? '📹' : '📝';
            const partnerStatus = user.has_partner ? '✅ Yes' : '⏳ Waiting';
            const botChat = user.has_partner 
                ? (user.partner_is_bot ? '🤖 Yes' : '❌ No')
                : '-';
            
            return `
                <tr>
                    <td>${escapeHtml(user.nickname || 'Anonymous')}</td>
                    <td>${modeIcon} ${user.mode || 'text'}</td>
                    <td>${partnerStatus}</td>
                    <td>${botChat}</td>
                </tr>
            `;
        }).join('');
        
        elements.usersTableBody.innerHTML = rows;
    }

    /**
     * Escapes HTML special characters to prevent XSS
     * @param {string} text - The text to escape
     * @returns {string} - Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Updates the last updated timestamp
     */
    function updateLastUpdated() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        elements.lastUpdated.textContent = timeStr;
        
        // Flash the refresh indicator
        elements.refreshIndicator.classList.add('active');
        setTimeout(() => {
            elements.refreshIndicator.classList.remove('active');
        }, 500);
    }


    // ============================================
    // Auto-Refresh Functions (Task 4.4)
    // ============================================

    /**
     * Fetches stats and updates the dashboard
     */
    async function fetchAndUpdateDashboard() {
        const data = await fetchStats();
        if (data) {
            updateDashboard(data);
        }
    }

    /**
     * Starts the auto-refresh polling interval
     */
    function startAutoRefresh() {
        // Clear any existing interval
        stopAutoRefresh();
        
        // Set up new interval
        refreshIntervalId = setInterval(fetchAndUpdateDashboard, REFRESH_INTERVAL_MS);
        
        // Update status indicator
        elements.autoRefreshStatus.textContent = 'ON';
    }

    /**
     * Stops the auto-refresh polling interval
     */
    function stopAutoRefresh() {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
        }
        elements.autoRefreshStatus.textContent = 'OFF';
    }

    // ============================================
    // Initialization
    // ============================================

    /**
     * Initializes the admin panel
     */
    function init() {
        // Set up event listeners
        elements.loginForm.addEventListener('submit', handleLogin);
        elements.logoutBtn.addEventListener('click', logout);
        
        // Check for existing session
        const storedKey = getStoredApiKey();
        if (storedKey) {
            // Validate stored key and auto-login if valid
            validateApiKey(storedKey).then(isValid => {
                if (isValid) {
                    showDashboard();
                    fetchAndUpdateDashboard();
                    startAutoRefresh();
                } else {
                    // Clear invalid stored key
                    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
