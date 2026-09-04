'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'i18n.js'), 'utf8');

function createRuntime(initialLocale) {
    const values = new Map(initialLocale ? [['tg.installer.locale', initialLocale]] : []);
    const document = {
        documentElement: { lang: '', dir: '' },
        querySelectorAll: () => [],
        dispatchEvent: () => true
    };
    const window = {
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, String(value))
        }
    };
    const context = vm.createContext({
        window,
        document,
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
        Intl
    });
    vm.runInContext(source, context, { filename: 'i18n.js' });
    return { api: window.tensorgridI18n, document, values };
}

test('i18n defaults to English and exposes a complete shared key set', () => {
    const { api } = createRuntime();
    assert.equal(api.getLocale(), 'en');
    assert.deepEqual([...api.SUPPORTED_LOCALES], ['en', 'fa', 'ar']);
    const englishKeys = [...api.getTranslationKeys('en')].sort();
    assert.ok(englishKeys.length > 50);

    for (const locale of api.SUPPORTED_LOCALES) {
        assert.deepEqual([...api.getTranslationKeys(locale)].sort(), englishKeys, `${locale} key set differs`);
        api.setLocale(locale);
        for (const key of englishKeys) {
            assert.notEqual(api.translate(key), key, `${locale} is missing ${key}`);
        }
    }
});

test('i18n persists locale and switches document direction', () => {
    const { api, document, values } = createRuntime();
    api.setLocale('fa');
    assert.equal(api.getLocale(), 'fa');
    assert.equal(document.documentElement.lang, 'fa');
    assert.equal(document.documentElement.dir, 'rtl');
    assert.equal(values.get('tg.installer.locale'), 'fa');

    api.setLocale('ar');
    assert.equal(document.documentElement.dir, 'rtl');
    api.setLocale('en');
    assert.equal(document.documentElement.dir, 'ltr');
});
