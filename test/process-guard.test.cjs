'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isChatGPTRunning, readChatGPTProcessState } = require('../src/process-guard.cjs');

function fakeTasklist(stdout, status = 0) {
    return () => ({ stdout, status });
}

test('process guard detects the official ChatGPT executable', () => {
    assert.equal(isChatGPTRunning({
        platform: 'win32',
        spawnFile: fakeTasklist('"ChatGPT.exe","4312","Console","1","120,000 K"\r\n')
    }), true);
});

test('process guard does not match an unrelated executable', () => {
    assert.equal(isChatGPTRunning({
        platform: 'win32',
        spawnFile: fakeTasklist('INFO: No tasks are running which match the specified criteria.')
    }), false);
});

test('process guard treats an empty filtered task list as closed', () => {
    assert.equal(isChatGPTRunning({
        platform: 'win32',
        spawnFile: fakeTasklist('INFO: No tasks are running which match the specified criteria.', 1)
    }), false);
});

test('process guard falls back to PowerShell when tasklist is unavailable', () => {
    const calls = [];
    const spawnFile = (file, args) => {
        calls.push(file);
        if (file === 'tasklist.exe') {
            return { status: 1, stderr: 'ERROR: Access denied' };
        }
        return { status: 0, stdout: 'closed\r\n' };
    };

    assert.equal(isChatGPTRunning({ platform: 'win32', spawnFile }), false);
    assert.deepEqual(calls, ['tasklist.exe', 'powershell.exe']);
});

test('process guard fails closed when tasklist cannot run', () => {
    assert.equal(readChatGPTProcessState({
        platform: 'win32',
        spawnFile: file => file === 'tasklist.exe'
            ? { status: 5, stderr: 'access denied' }
            : { status: 5, stderr: 'powershell unavailable' }
    }), 'unknown');
    assert.throws(() => isChatGPTRunning({
        platform: 'win32',
        spawnFile: file => file === 'tasklist.exe'
            ? { status: 5 }
            : { status: 5 }
    }), error => error.code === 'PROCESS_CHECK_FAILED');
});
