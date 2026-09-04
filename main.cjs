'use strict';

const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { TensorGridClient } = require('./src/tensorgrid-client.cjs');
const { InstallService } = require('./src/install-service.cjs');
const { publicError, SetupError } = require('./src/errors.cjs');

const APP_ID = 'com.tensorgrid.codex-setup';

let mainWindow;
let service;
let stateTimer;
let stateRefreshInFlight;
let lastStateSignature;
let lastConnectionCheckAt = 0;
let previousProcessState;

const CONNECTION_CHECK_INTERVAL_MS = 30_000;
const STATE_POLL_INTERVAL_MS = 1_000;

function createService() {
    return new InstallService({ client: new TensorGridClient() });
}

function ok(data) {
    return { ok: true, data };
}

function fail(error) {
    return { ok: false, error: publicError(error) };
}

function publicStateSignature(state) {
    return JSON.stringify({
        provider: state.provider,
        connection: state.connection,
        connectionCode: state.connectionCode,
        configuredModel: state.configuredModel,
        hasTensorGridKey: state.hasTensorGridKey,
        chatgptProcess: state.chatgptProcess,
        canMutate: state.canMutate,
        blockReason: state.blockReason,
        revertAvailable: state.revertAvailable,
        revertBlockedReason: state.revertBlockedReason,
        manuallyRestored: state.manuallyRestored,
        authorizedModelCount: state.authorizedModelCount
    });
}

function publishState(state, { force = false } = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    const signature = publicStateSignature(state);
    if (!force && signature === lastStateSignature) {
        return;
    }

    lastStateSignature = signature;
    mainWindow.webContents.send('setup:state-changed', state);
}

async function refreshState({ verify = false, force = false } = {}) {
    const localState = service.getState();
    publishState(localState, { force });

    const shouldVerify = verify
        && localState.chatgptProcess === 'closed'
        && localState.provider === 'tensorgrid'
        && localState.tensorgridConfigured
        && localState.hasTensorGridKey
        && (force || Date.now() - lastConnectionCheckAt >= CONNECTION_CHECK_INTERVAL_MS);

    if (!shouldVerify || stateRefreshInFlight) {
        return localState;
    }

    lastConnectionCheckAt = Date.now();
    stateRefreshInFlight = service.verifyConnection()
        .then(state => {
            publishState(state, { force: true });
            return state;
        })
        .finally(() => {
            stateRefreshInFlight = undefined;
        });

    return stateRefreshInFlight;
}

function startStateWatcher() {
    clearInterval(stateTimer);
    stateTimer = setInterval(() => {
        void (async () => {
            const state = service.getState();
            const processChanged = state.chatgptProcess !== previousProcessState;
            previousProcessState = state.chatgptProcess;
            publishState(state);
            if (processChanged && state.chatgptProcess === 'closed') {
                lastConnectionCheckAt = 0;
            }
            await refreshState({ verify: true });
        })().catch(() => undefined);
    }, STATE_POLL_INTERVAL_MS);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 720,
        height: 720,
        minWidth: 620,
        minHeight: 620,
        resizable: true,
        show: false,
        autoHideMenuBar: true,
        title: 'TensorGrid Codex Setup',
        icon: path.join(__dirname, 'renderer', 'assets', 'tensorgrid-mark-512.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file:')) {
            event.preventDefault();
        }
    });
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

function registerIpc() {
    ipcMain.handle('setup:get-state', async () => {
        try {
            return ok(await refreshState({ verify: true, force: true }));
        } catch (error) {
            return fail(error);
        }
    });

    ipcMain.handle('setup:list-models', async (_event, token) => {
        try {
            return ok(await service.listModels(token));
        } catch (error) {
            return fail(error);
        }
    });

    ipcMain.handle('setup:apply', async (_event, payload) => {
        try {
            if (!payload || typeof payload !== 'object') {
                throw new SetupError('REQUEST_INVALID', 'درخواست نصب معتبر نیست.');
            }
            const result = await service.apply({ token: payload.token, modelId: payload.modelId });
            lastConnectionCheckAt = 0;
            await refreshState({ verify: true, force: true });
            return ok(result);
        } catch (error) {
            return fail(error);
        }
    });

    ipcMain.handle('setup:revert', async () => {
        try {
            const result = await service.revert();
            lastConnectionCheckAt = 0;
            await refreshState({ verify: true, force: true });
            return ok(result);
        } catch (error) {
            return fail(error);
        }
    });
}

app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    if (process.platform !== 'win32') {
        dialog.showErrorBox('TensorGrid Codex Setup', 'این نسخه فقط برای Windows native ساخته شده است.');
        app.quit();
        return;
    }

    service = createService();
    registerIpc();
    createWindow();
    startStateWatcher();
});

app.on('before-quit', () => clearInterval(stateTimer));
app.on('window-all-closed', () => app.quit());
