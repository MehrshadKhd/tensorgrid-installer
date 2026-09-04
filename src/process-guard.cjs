'use strict';

const { spawnSync } = require('node:child_process');
const { CHATGPT_PROCESS_NAMES } = require('./constants.cjs');
const { SetupError } = require('./errors.cjs');

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapePowerShellString(value) {
    return value.replace(/'/g, "''");
}

function noMatchingTasks(result) {
    return /no tasks are running which match|no tasks are running/i.test(
        `${String(result?.stdout || '')}\n${String(result?.stderr || '')}`
    );
}

function readPowerShellProcessState(processName, spawnFile) {
    const nameWithoutExtension = processName.replace(/\.exe$/i, '');
    const escapedName = escapePowerShellString(nameWithoutExtension);
    const result = spawnFile('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$process = Get-Process -Name '${escapedName}' -ErrorAction SilentlyContinue; if ($null -eq $process) { Write-Output 'closed' } else { Write-Output 'running' }`
    ], {
        windowsHide: true,
        encoding: 'utf8'
    });

    if (result?.error || result?.status !== 0) {
        throw new SetupError('PROCESS_CHECK_FAILED', 'وضعیت ChatGPT Desktop قابل بررسی نیست؛ برای امنیت تغییرات قفل شد.', {
            cause: result?.error
        });
    }

    const state = String(result.stdout || '').trim().toLowerCase();
    if (state === 'running') {
        return true;
    }
    if (state === 'closed') {
        return false;
    }
    throw new SetupError('PROCESS_CHECK_FAILED', 'وضعیت ChatGPT Desktop قابل بررسی نیست؛ برای امنیت تغییرات قفل شد.');
}

function isChatGPTRunning({
    platform = process.platform,
    processNames = CHATGPT_PROCESS_NAMES,
    spawnFile = spawnSync
} = {}) {
    if (platform !== 'win32') {
        throw new SetupError('UNSUPPORTED_PLATFORM', 'این installer فقط برای Windows native ساخته شده است.');
    }

    for (const processName of processNames) {
        const result = spawnFile('tasklist.exe', [
            '/FI', `IMAGENAME eq ${processName}`,
            '/FO', 'CSV',
            '/NH'
        ], {
            windowsHide: true,
            encoding: 'utf8'
        });

        if (result?.error) {
            if (readPowerShellProcessState(processName, spawnFile)) {
                return true;
            }
            continue;
        }

        // Some Windows environments return a non-zero exit code when the
        // filtered process list is empty. That is a successful "closed"
        // result, not a detector failure.
        if (result?.status !== 0 && !noMatchingTasks(result)) {
            if (readPowerShellProcessState(processName, spawnFile)) {
                return true;
            }
            continue;
        }

        if (new RegExp(`"${escapeRegExp(processName)}"`, 'i').test(String(result.stdout || ''))) {
            return true;
        }
    }

    return false;
}

function readChatGPTProcessState(options = {}) {
    try {
        return isChatGPTRunning(options) ? 'running' : 'closed';
    } catch (_error) {
        return 'unknown';
    }
}

module.exports = { isChatGPTRunning, readChatGPTProcessState };
