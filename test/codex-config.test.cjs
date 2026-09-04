'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeConfigToml, upsertEnv, readEnvValue, inspectConfig } = require('../src/codex-config.cjs');

test('mergeConfigToml preserves unrelated semantic settings and updates TensorGrid provider', () => {
    const original = [
        '# existing Codex settings',
        'approval_policy = "on-request"',
        'model = "old-model"',
        '',
        '[profiles.work]',
        'model = "work-model"',
        '',
        '[model_providers.other]',
        'name = "Other"',
        'base_url = "https://example.test/v1"',
        ''
    ].join('\n');

    const updated = mergeConfigToml(original, 'tg-go:auto:gpt-5-5');
    assert.match(updated, /approval_policy = "on-request"/);
    assert.match(updated, /model_provider = "tensorgrid"/);
    assert.match(updated, /\[model_providers\.tensorgrid\]/);
    assert.match(updated, /base_url = "https:\/\/api\.tensorgrid\.space\/v1"/);
    assert.match(updated, /\[model_providers\.other\]/);
    assert.match(updated, /\[profiles\.work\]/);
});

test('mergeConfigToml rejects invalid TOML before producing output', () => {
    assert.throws(() => mergeConfigToml('model = [', 'model'), error => error.code === 'CONFIG_INVALID');
});

test('mergeConfigToml rejects a malformed provider table instead of replacing it', () => {
    assert.throws(() => mergeConfigToml('model_providers = ["not-a-table"]\n', 'model'), error => error.code === 'CONFIG_INVALID');
});

test('upsertEnv preserves comments and unrelated variables while collapsing duplicate keys', () => {
    const original = [
        '# keep this comment',
        'OPENAI_API_KEY=untouched',
        'TENSORGRID_API_KEY=old',
        'export TENSORGRID_API_KEY=duplicate',
        ''
    ].join('\r\n');
    const updated = upsertEnv(original, 'tg_test_token');
    assert.match(updated, /# keep this comment/);
    assert.match(updated, /OPENAI_API_KEY=untouched/);
    assert.equal((updated.match(/TENSORGRID_API_KEY=/g) || []).length, 1);
    assert.match(updated, /TENSORGRID_API_KEY=tg_test_token/);
    assert.match(updated, /\r\n/);
});

test('upsertEnv quotes tokens containing dotenv-sensitive characters', () => {
    const updated = upsertEnv('', 'token with "quotes"');
    assert.equal(updated, 'TENSORGRID_API_KEY="token with \\"quotes\\""\n');
});

test('inspectConfig classifies default ChatGPT and custom OpenAI endpoints', () => {
    assert.equal(inspectConfig('').provider, 'chatgpt');
    assert.equal(inspectConfig('model = "gpt-5.6-luna"\n').provider, 'chatgpt');
    assert.equal(inspectConfig('openai_base_url = "https://proxy.example/v1"\n').provider, 'custom');
});

test('inspectConfig recognizes the exact TensorGrid provider shape', () => {
    const config = [
        'model = "auto:gpt-5-5"',
        'model_provider = "tensorgrid"',
        '',
        '[model_providers.tensorgrid]',
        'name = "TensorGrid"',
        'base_url = "https://api.tensorgrid.space/v1"',
        'wire_api = "responses"',
        'env_key = "TENSORGRID_API_KEY"',
        ''
    ].join('\n');
    const result = inspectConfig(config);
    assert.equal(result.provider, 'tensorgrid');
    assert.equal(result.configured, true);
    assert.equal(result.configuredModel, 'auto:gpt-5-5');
});

test('readEnvValue reads dotenv quoting without exposing unrelated values', () => {
    const content = [
        '# keep',
        'OTHER_SECRET=do-not-return',
        'export TENSORGRID_API_KEY="token with \\\"quotes\\\""',
        ''
    ].join('\n');
    assert.equal(readEnvValue(content), 'token with "quotes"');
});
