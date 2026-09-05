'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '..');

test('standalone renderer uses local brand assets and fonts', () => {
    const css = fs.readFileSync(path.join(appRoot, 'renderer', 'styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(appRoot, 'renderer', 'index.html'), 'utf8');
    const syncScript = fs.readFileSync(path.join(appRoot, 'scripts', 'sync-design-assets.cjs'), 'utf8');
    assert.match(html, /assets\/tensorgrid-mark\.svg/);
    assert.match(html, /font-src 'self'/);
    assert.doesNotMatch(css, /fonts\.(googleapis|gstatic)\.com/);
    assert.match(css, /Instrument Sans/);
    assert.match(css, /Martian Mono/);
    assert.match(css, /Vazirmatn/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(syncScript, /launchericon-512x512\.png/);
    assert.match(syncScript, /create-windows-icon\.ps1/);
    assert.doesNotMatch(syncScript, /frontend['\"]?,?\s*['\"]public['\"]?,?\s*['\"]favicon\.ico/);
});

test('packaging and native window use the TensorGrid icon', () => {
    const builder = fs.readFileSync(path.join(appRoot, 'electron-builder.yml'), 'utf8');
    const afterPack = fs.readFileSync(path.join(appRoot, 'scripts', 'after-pack.cjs'), 'utf8');
    const main = fs.readFileSync(path.join(appRoot, 'main.cjs'), 'utf8');
    const app = fs.readFileSync(path.join(appRoot, 'renderer', 'app.js'), 'utf8');
    const preload = fs.readFileSync(path.join(appRoot, 'preload.cjs'), 'utf8');
    assert.match(builder, /icon: resources\/icon\.ico/);
    assert.match(builder, /extraResources:/);
    assert.match(builder, /to: icon\.ico/);
    assert.match(builder, /include: scripts\/nsis-installer\.nsh/);
    assert.match(builder, /- resources\/icon\.ico/);
    assert.match(builder, /installerIcon: resources\/icon\.ico/);
    assert.match(builder, /uninstallerIcon: resources\/icon\.ico/);
    assert.match(builder, /afterPack: scripts\/after-pack\.cjs/);
    assert.match(builder, /signAndEditExecutable: false/);
    assert.match(afterPack, /electron-winstaller\/package\.json/);
    assert.match(afterPack, /'--set-icon'/);
    const nsisInclude = fs.readFileSync(path.join(appRoot, 'scripts', 'nsis-installer.nsh'), 'utf8');
    assert.match(nsisInclude, /customInstall/);
    assert.match(nsisInclude, /resources\\icon\.ico/);
    assert.match(nsisInclude, /CreateShortCut/);
    assert.match(builder, /createDesktopShortcut: always/);
    assert.match(main, /const APP_ID = ['"]com\.tensorgrid\.codex-setup['"]/);
    assert.match(main, /app\.setAppUserModelId\(APP_ID\)/);
    assert.match(main, /icon: path\.join\(__dirname, 'resources', 'icon\.ico'\)/);
    assert.match(app, /const latest = await window\.codexSetup\.getState\(\)/);
    assert.match(app, /state\.chatgptProcess === 'running' \? 'CHATGPT_RUNNING'/);
    assert.match(app, /state\.revertBlockedReason !== 'CONFIG_DRIFT'/);
    assert.match(app, /const allowDrift = state\?\.revertBlockedReason === 'CONFIG_DRIFT'/);
    assert.match(app, /window\.codexSetup\.revert\(\{ allowDrift \}\)/);
    assert.match(preload, /revert: options => ipcRenderer\.invoke\('setup:revert', options\)/);
    assert.match(main, /allowDrift: Boolean\(options\?\.allowDrift\)/);
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
