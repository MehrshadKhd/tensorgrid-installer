'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

module.exports = async context => {
    if (context.electronPlatformName !== 'win32') {
        return;
    }

    const executablePath = path.join(
        context.appOutDir,
        `${context.packager.appInfo.productFilename}.exe`
    );
    const iconPath = path.join(context.packager.info.buildResourcesDir, 'icon.ico');
    const rceditPath = path.join(
        path.dirname(require.resolve('electron-winstaller/package.json')),
        'vendor',
        'rcedit.exe'
    );
    if (!fs.existsSync(rceditPath)) {
        throw new Error(`rcedit.exe was not found at ${rceditPath}`);
    }
    const result = spawnSync(rceditPath, [executablePath, '--set-icon', iconPath], { stdio: 'inherit' });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`rcedit failed with exit code ${result.status}`);
    }
};
