'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { restrictToCurrentWindowsUser } = require('../src/windows-security.cjs');

test('restrictToCurrentWindowsUser invokes icacls with current-user and system ACLs', () => {
    let invocation;
    restrictToCurrentWindowsUser('C:\\Users\\tester\\.codex\\.env.tmp', {
        platform: 'win32',
        environment: { USERNAME: 'tester', USERDOMAIN: 'WORKSTATION' },
        spawnFile: (file, args, options) => {
            invocation = { file, args, options };
            return { status: 0 };
        }
    });

    assert.equal(invocation.file, 'icacls.exe');
    assert.deepEqual(invocation.args, [
        'C:\\Users\\tester\\.codex\\.env.tmp',
        '/inheritance:r',
        '/grant:r', 'WORKSTATION\\tester:(R,W)',
        '/grant:r', '*S-1-5-18:(R,W)',
        '/grant:r', '*S-1-5-32-544:(R,W)'
    ]);
    assert.equal(invocation.options.windowsHide, true);
});

test('restrictToCurrentWindowsUser reports ACL failures safely', () => {
    assert.throws(() => restrictToCurrentWindowsUser('C:\\temp\\.env', {
        platform: 'win32',
        environment: { USERNAME: 'tester' },
        spawnFile: () => ({ status: 5 })
    }), error => error.code === 'ACL_FAILED');
});
