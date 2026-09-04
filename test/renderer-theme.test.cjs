'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'theme.js'), 'utf8');

function createRuntime(initialMode, systemIsDark = false) {
    const values = new Map(initialMode ? [['tg.installer.theme', initialMode]] : []);
    const classNames = new Set();
    const mediaListeners = new Set();
    const media = {
        matches: systemIsDark,
        addEventListener: (_type, listener) => mediaListeners.add(listener),
        removeEventListener: (_type, listener) => mediaListeners.delete(listener)
    };
    const document = {
        documentElement: {
            style: {},
            classList: {
                toggle: (name, enabled) => enabled ? classNames.add(name) : classNames.delete(name)
            }
        },
        dispatchEvent: () => true
    };
    const window = {
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, String(value))
        },
        matchMedia: () => media
    };
    const context = vm.createContext({
        window,
        document,
        CustomEvent: class CustomEvent {},
        Set
    });
    vm.runInContext(source, context, { filename: 'theme.js' });
    return { api: window.tensorgridTheme, document, values, classNames, media, mediaListeners };
}

test('theme defaults to System and resolves against the OS preference', () => {
    const { api, document, classNames } = createRuntime(undefined, true);
    assert.equal(api.getThemeMode(), 'system');
    assert.equal(api.getResolvedTheme(), 'dark');
    assert.equal(document.documentElement.style.colorScheme, 'dark');
    assert.ok(classNames.has('tg-dark'));
    assert.ok(!classNames.has('tg-light'));
});

test('theme persists explicit mode and maintains tg-light/tg-dark classes', () => {
    const { api, document, values, classNames } = createRuntime();
    api.setThemeMode('dark');
    assert.equal(api.getThemeMode(), 'dark');
    assert.equal(api.getResolvedTheme(), 'dark');
    assert.equal(values.get('tg.installer.theme'), 'dark');
    assert.ok(classNames.has('tg-dark'));

    api.setThemeMode('light');
    assert.equal(document.documentElement.style.colorScheme, 'light');
    assert.ok(classNames.has('tg-light'));
    assert.ok(!classNames.has('tg-dark'));
});

test('System theme follows a changed prefers-color-scheme value', () => {
    const { api, document, media, mediaListeners } = createRuntime(undefined, false);
    assert.equal(api.getResolvedTheme(), 'light');
    media.matches = true;
    mediaListeners.forEach(listener => listener());
    assert.equal(api.getResolvedTheme(), 'dark');
    assert.equal(document.documentElement.style.colorScheme, 'dark');
});
