'use strict';

const { spawnSync } = require('node:child_process');
const { SetupError } = require('./errors.cjs');

function restrictToCurrentWindowsUser(filePath, {
    platform = process.platform,
    environment = process.env,
    spawnFile = spawnSync
} = {}) {
    if (platform !== 'win32') {
        return;
    }

    const username = String(environment.USERNAME || '').trim();
    const domain = String(environment.USERDOMAIN || '').trim();
    if (!username) {
        throw new SetupError('WINDOWS_USER_MISSING', 'نام کاربر Windows پیدا نشد.');
    }

    const account = domain ? `${domain}\\${username}` : username;
    const result = spawnFile('icacls.exe', [
        filePath,
        '/inheritance:r',
        '/grant:r', `${account}:(R,W)`,
        '/grant:r', '*S-1-5-18:(R,W)',
        '/grant:r', '*S-1-5-32-544:(R,W)'
    ], { windowsHide: true, encoding: 'utf8' });

    if (result.error || result.status !== 0) {
        throw new SetupError('ACL_FAILED', 'دسترسی امن فایل توکن تنظیم نشد؛ فایل اصلی بدون تغییر باقی ماند.', { cause: result.error });
    }
}

module.exports = { restrictToCurrentWindowsUser };
