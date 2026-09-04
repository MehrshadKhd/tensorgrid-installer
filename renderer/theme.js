'use strict';

(function initializeTheme() {
    const THEME_MODES = ['system', 'light', 'dark'];
    const STORAGE_KEY = 'tg.installer.theme';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let mode = readStoredMode() || 'system';
    const listeners = new Set();

    function readStoredMode() {
        try {
            const value = window.localStorage.getItem(STORAGE_KEY);
            return THEME_MODES.includes(value) ? value : null;
        } catch (_error) {
            return null;
        }
    }

    function getThemeMode() {
        return mode;
    }

    function getResolvedTheme() {
        return mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
    }

    function applyTheme() {
        const resolved = getResolvedTheme();
        document.documentElement.classList.toggle('tg-dark', resolved === 'dark');
        document.documentElement.classList.toggle('tg-light', resolved === 'light');
        document.documentElement.style.colorScheme = resolved;
        listeners.forEach(listener => listener({ mode, resolved }));
        document.dispatchEvent(new CustomEvent('tg:theme-changed', { detail: { mode, resolved } }));
    }

    function setThemeMode(nextMode) {
        if (!THEME_MODES.includes(nextMode)) {
            return;
        }
        mode = nextMode;
        try {
            window.localStorage.setItem(STORAGE_KEY, mode);
        } catch (_error) {
            // Keep the choice in memory if storage is unavailable.
        }
        applyTheme();
    }

    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    const onSystemThemeChange = () => {
        if (mode === 'system') {
            applyTheme();
        }
    };
    if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onSystemThemeChange);
    } else if (typeof media.addListener === 'function') {
        media.addListener(onSystemThemeChange);
    }

    window.tensorgridTheme = {
        THEME_MODES,
        getThemeMode,
        getResolvedTheme,
        setThemeMode,
        onChange,
        applyTheme
    };
    applyTheme();
})();
