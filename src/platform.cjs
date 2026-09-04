'use strict';

const path = require('node:path');
const { SetupError } = require('./errors.cjs');

function isWsl(environment = process.env) {
    return Boolean(environment.WSL_DISTRO_NAME || environment.WSL_INTEROP);
}

function resolveCodexHome({ environment = process.env, platform = process.platform } = {}) {
    if (platform !== 'win32') {
        throw new SetupError('UNSUPPORTED_PLATFORM', 'این installer فقط برای Windows native است.');
    }

    if (isWsl(environment)) {
        throw new SetupError('WSL_NOT_SUPPORTED', 'WSL در این نسخه پشتیبانی نمی‌شود. لطفاً installer را از Windows native اجرا کنید.');
    }

    const userProfile = String(environment.USERPROFILE || '').trim();
    if (!userProfile) {
        throw new SetupError('USER_PROFILE_MISSING', 'مسیر پروفایل کاربر Windows پیدا نشد.');
    }

    const configuredHome = String(environment.CODEX_HOME || '').trim();
    return path.resolve(configuredHome || path.join(userProfile, '.codex'));
}

module.exports = { isWsl, resolveCodexHome };
