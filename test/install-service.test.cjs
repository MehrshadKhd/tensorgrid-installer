'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { InstallService } = require('../src/install-service.cjs');

function tempHome() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tensorgrid-codex-'));
}

function fakeClient() {
    return {
        listResponsesModels: async () => [{ id: 'auto:gpt-5-5', name: 'GPT 5.5' }]
    };
}

test('apply creates Codex files, preserves auth.json, and returns backup metadata', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const configPath = path.join(codexHome, 'config.toml');
    const envPath = path.join(codexHome, '.env');
    const authPath = path.join(codexHome, 'auth.json');
    fs.writeFileSync(configPath, 'approval_policy = "on-request"\n');
    fs.writeFileSync(envPath, '# keep\nOTHER=value\n');
    fs.writeFileSync(authPath, '{"auth":"untouched"}\n');
    const authBefore = fs.readFileSync(authPath);
    const authMtimeBefore = fs.statSync(authPath).mtimeMs;

    const service = new InstallService({
        client: fakeClient(),
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });
    const result = await service.apply({ token: 'tg_test_token', modelId: 'auto:gpt-5-5' });

    assert.equal(result.provider, 'tensorgrid');
    assert.equal(fs.readFileSync(authPath).equals(authBefore), true);
    assert.equal(fs.statSync(authPath).mtimeMs, authMtimeBefore);
    assert.match(fs.readFileSync(configPath, 'utf8'), /model_provider = "tensorgrid"/);
    assert.match(fs.readFileSync(envPath, 'utf8'), /OTHER=value/);
    assert.match(fs.readFileSync(envPath, 'utf8'), /TENSORGRID_API_KEY=tg_test_token/);
    assert.ok(result.backupDir);
    assert.ok(fs.existsSync(path.join(result.backupDir, 'config.toml')));
    assert.ok(fs.existsSync(path.join(result.backupDir, '.env')));
    assert.equal(service.getState().revertAvailable, true);
});

test('apply refuses a model that was not returned by the authorized catalog', async () => {
    const home = tempHome();
    const service = new InstallService({
        client: { listResponsesModels: async () => [{ id: 'different-model', name: 'Other' }] },
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });
    await assert.rejects(
        service.apply({ token: 'tg_test_token', modelId: 'auto:gpt-5-5' }),
        error => error.code === 'MODEL_NOT_AUTHORIZED'
    );
    assert.equal(fs.existsSync(path.join(home, '.codex', 'config.toml')), false);
});

test('an atomic failure rolls back the config and env files', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const configPath = path.join(codexHome, 'config.toml');
    const envPath = path.join(codexHome, '.env');
    fs.writeFileSync(configPath, 'model = "old"\n');
    fs.writeFileSync(envPath, 'OTHER=value\n');

    const service = new InstallService({
        client: fakeClient(),
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async filePath => {
            if (filePath.endsWith('.env.' + process.pid + '.tmp') || filePath.includes('.env.')) {
                throw new Error('simulated ACL failure');
            }
        },
        processProbe: () => 'closed'
    });
    await assert.rejects(service.apply({ token: 'tg_test_token', modelId: 'auto:gpt-5-5' }));
    assert.equal(fs.readFileSync(configPath, 'utf8'), 'model = "old"\n');
    assert.equal(fs.readFileSync(envPath, 'utf8'), 'OTHER=value\n');
});

test('getState identifies the default ChatGPT provider without exposing secrets', () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'config.toml'), 'model = "gpt-5.6-luna"\n');
    fs.writeFileSync(path.join(codexHome, '.env'), 'OTHER=value\n');

    const service = new InstallService({
        client: fakeClient(),
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });
    const state = service.getState();

    assert.equal(state.provider, 'chatgpt');
    assert.equal(state.connection, 'chatgpt-configured');
    assert.equal(state.canMutate, true);
    assert.equal(Object.prototype.hasOwnProperty.call(state, 'token'), false);
    assert.equal(JSON.stringify(state).includes('OTHER=value'), false);
});

test('verifyConnection uses the stored key and returns only connection metadata', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'config.toml'), [
        'model = "auto:gpt-5-5"',
        'model_provider = "tensorgrid"',
        '',
        '[model_providers.tensorgrid]',
        'name = "TensorGrid"',
        'base_url = "https://api.tensorgrid.space/v1"',
        'wire_api = "responses"',
        'env_key = "TENSORGRID_API_KEY"',
        ''
    ].join('\n'));
    fs.writeFileSync(path.join(codexHome, '.env'), 'TENSORGRID_API_KEY=tg_secret_for_test\n');

    let observedToken;
    const service = new InstallService({
        client: {
            listAuthorizedModels: async token => {
                observedToken = token;
                return [{ id: 'auto:gpt-5-5' }];
            }
        },
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });
    const state = await service.verifyConnection();

    assert.equal(state.connection, 'tensorgrid-verified');
    assert.equal(state.authorizedModelCount, 1);
    assert.equal(state.hasTensorGridKey, true);
    assert.equal(state.token, undefined);
    assert.equal(service.getState().connection, 'tensorgrid-verified');
    assert.equal(JSON.stringify(state).includes('tg_secret_for_test'), false);
    assert.equal(observedToken, 'tg_secret_for_test');
});

test('apply is blocked before network access while ChatGPT is running', async () => {
    const home = tempHome();
    let called = false;
    const service = new InstallService({
        client: {
            listResponsesModels: async () => {
                called = true;
                return [{ id: 'model' }];
            }
        },
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'running'
    });

    await assert.rejects(
        service.apply({ token: 'tg_test_token', modelId: 'model' }),
        error => error.code === 'CHATGPT_RUNNING'
    );
    assert.equal(called, false);
    assert.equal(fs.existsSync(path.join(home, '.codex')), false);
});

test('apply can change model using the stored TensorGrid key', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'config.toml'), [
        'model = "old-model"',
        'model_provider = "tensorgrid"',
        '',
        '[model_providers.tensorgrid]',
        'name = "TensorGrid"',
        'base_url = "https://api.tensorgrid.space/v1"',
        'wire_api = "responses"',
        'env_key = "TENSORGRID_API_KEY"',
        ''
    ].join('\n'));
    fs.writeFileSync(path.join(codexHome, '.env'), 'TENSORGRID_API_KEY=tg_stored_token\n');
    let observedToken;
    const service = new InstallService({
        client: {
            listResponsesModels: async token => {
                observedToken = token;
                return [{ id: 'new-model', name: 'New model' }];
            }
        },
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });

    const result = await service.apply({ modelId: 'new-model' });
    assert.equal(result.modelId, 'new-model');
    assert.equal(observedToken, 'tg_stored_token');
});

test('revert restores the exact pre-TensorGrid config and env', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const configPath = path.join(codexHome, 'config.toml');
    const envPath = path.join(codexHome, '.env');
    const authPath = path.join(codexHome, 'auth.json');
    const originalConfig = '# preserve\nmodel = "gpt-5.6-luna"\napproval_policy = "on-request"\n';
    const originalEnv = '# preserve\nOTHER=value\n';
    fs.writeFileSync(configPath, originalConfig);
    fs.writeFileSync(envPath, originalEnv);
    fs.writeFileSync(authPath, '{"auth":"untouched"}\n');
    const authBefore = fs.readFileSync(authPath);
    const authMtimeBefore = fs.statSync(authPath).mtimeMs;

    const service = new InstallService({
        client: { listResponsesModels: async () => [{ id: 'model', name: 'Model' }] },
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });

    await service.apply({ token: 'tg_test_token', modelId: 'model' });
    const reverted = await service.revert();

    assert.equal(reverted.provider, 'chatgpt');
    assert.equal(fs.readFileSync(configPath, 'utf8'), originalConfig);
    assert.equal(fs.readFileSync(envPath, 'utf8'), originalEnv);
    assert.equal(fs.readFileSync(authPath).equals(authBefore), true);
    assert.equal(fs.statSync(authPath).mtimeMs, authMtimeBefore);
    assert.equal(service.getState().provider, 'chatgpt');
    assert.equal(service.getState().revertAvailable, false);
});

test('revert refuses to overwrite files changed after activation', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const configPath = path.join(codexHome, 'config.toml');
    fs.writeFileSync(configPath, 'model = "gpt-5.6-luna"\n');

    const service = new InstallService({
        client: { listResponsesModels: async () => [{ id: 'model', name: 'Model' }] },
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });

    await service.apply({ token: 'tg_test_token', modelId: 'model' });
    fs.appendFileSync(configPath, '# user changed this\n');
    await assert.rejects(service.revert(), error => error.code === 'CONFIG_DRIFT');
    assert.match(fs.readFileSync(configPath, 'utf8'), /user changed this/);
});

test('manual restoration to the pre-TensorGrid snapshot clears drift and allows re-apply', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const configPath = path.join(codexHome, 'config.toml');
    const originalConfig = 'model = "gpt-5.6-luna"\n';
    fs.writeFileSync(configPath, originalConfig);

    const service = new InstallService({
        client: fakeClient(),
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });

    await service.apply({ token: 'tg_test_token', modelId: 'auto:gpt-5-5' });
    fs.writeFileSync(configPath, originalConfig);
    fs.unlinkSync(path.join(codexHome, '.env'));

    const restoredState = service.getState();
    assert.equal(restoredState.provider, 'chatgpt');
    assert.equal(restoredState.revertAvailable, false);
    assert.equal(restoredState.revertBlockedReason, null);
    assert.equal(restoredState.manuallyRestored, true);

    const result = await service.apply({ token: 'tg_test_token', modelId: 'auto:gpt-5-5' });
    assert.equal(result.provider, 'tensorgrid');
    assert.equal(service.getState().revertAvailable, true);
});

test('manual restoration with harmless formatting changes creates a fresh origin snapshot', async () => {
    const home = tempHome();
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const configPath = path.join(codexHome, 'config.toml');
    const originalConfig = 'model = "gpt-5.6-luna"\n';
    const manuallyRestoredConfig = `${originalConfig}# restored by user\n`;
    fs.writeFileSync(configPath, originalConfig);

    const service = new InstallService({
        client: fakeClient(),
        platform: 'win32',
        environment: { USERPROFILE: home, USERNAME: 'tester', CODEX_HOME: '' },
        secureFile: async () => undefined,
        processProbe: () => 'closed'
    });

    await service.apply({ token: 'tg_test_token', modelId: 'auto:gpt-5-5' });
    fs.writeFileSync(configPath, manuallyRestoredConfig);
    fs.unlinkSync(path.join(codexHome, '.env'));

    const restoredState = service.getState();
    assert.equal(restoredState.provider, 'chatgpt');
    assert.equal(restoredState.revertBlockedReason, null);

    await service.apply({ token: 'tg_test_token', modelId: 'auto:gpt-5-5' });
    await service.revert();
    assert.equal(fs.readFileSync(configPath, 'utf8'), manuallyRestoredConfig);
    assert.equal(fs.existsSync(path.join(codexHome, '.env')), false);
});
