'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexSetup', {
    getState: () => ipcRenderer.invoke('setup:get-state'),
    listModels: token => ipcRenderer.invoke('setup:list-models', token),
    apply: payload => ipcRenderer.invoke('setup:apply', payload),
    revert: () => ipcRenderer.invoke('setup:revert'),
    onStateChanged: callback => {
        const listener = (_event, state) => callback(state);
        ipcRenderer.on('setup:state-changed', listener);
        return () => ipcRenderer.removeListener('setup:state-changed', listener);
    }
});
