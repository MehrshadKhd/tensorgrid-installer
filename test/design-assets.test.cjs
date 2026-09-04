'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '..');

test('standalone renderer uses local brand assets and fonts', () => {
    const css = fs.readFileSync(path.join(appRoot, 'renderer', 'styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(appRoot, 'renderer', 'index.html'), 'utf8');
    assert.match(html, /assets\/tensorgrid-mark\.svg/);
    assert.match(html, /font-src 'self'/);
    assert.doesNotMatch(css, /fonts\.(googleapis|gstatic)\.com/);
    assert.match(css, /Instrument Sans/);
    assert.match(css, /Martian Mono/);
    assert.match(css, /Vazirmatn/);
    assert.match(css, /prefers-reduced-motion/);
});

test('packaging and native window use the TensorGrid icon', () => {
    const builder = fs.readFileSync(path.join(appRoot, 'electron-builder.yml'), 'utf8');
    const main = fs.readFileSync(path.join(appRoot, 'main.cjs'), 'utf8');
    assert.match(builder, /icon: resources\/icon\.ico/);
    assert.match(builder, /installerIcon: resources\/icon\.ico/);
    assert.match(builder, /uninstallerIcon: resources\/icon\.ico/);
    assert.match(builder, /createDesktopShortcut: always/);
    assert.match(main, /const APP_ID = ['"]com\.tensorgrid\.codex-setup['"]/);
    assert.match(main, /app\.setAppUserModelId\(APP_ID\)/);
    assert.match(main, /icon: path\.join\(__dirname, 'renderer', 'assets', 'tensorgrid-mark-512\.png'\)/);
});

test('bundled font source contains all configured families and weights', () => {
    const expected = [
        'instrument-sans-400.ttf', 'instrument-sans-500.ttf', 'instrument-sans-600.ttf', 'instrument-sans-700.ttf',
        'martian-mono-400.ttf', 'martian-mono-500.ttf', 'martian-mono-600.ttf', 'martian-mono-700.ttf',
        'vazirmatn-400.ttf', 'vazirmatn-500.ttf', 'vazirmatn-600.ttf', 'vazirmatn-700.ttf', 'vazirmatn-800.ttf'
    ];
    const fontRoot = path.join(appRoot, 'source-assets', 'fonts');
    for (const fileName of expected) {
        assert.ok(fs.statSync(path.join(fontRoot, fileName)).size > 1000, fileName);
    }
});
