'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TensorGridClient } = require('../src/tensorgrid-client.cjs');

function response(status, payload) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(payload)
    };
}

test('listResponsesModels joins legacy catalog IDs to exact authorized IDs', async () => {
    const client = new TensorGridClient({
        fetchImpl: async (url, options) => {
            assert.equal(options.method, 'GET');
            if (url.includes('catalog')) {
                return response(200, {
                    results: [
                        { id: 'tg-go:auto:gpt-5-5', name: 'GPT 5.5', endpoints: ['responses'] },
                        { id: 'tg-go:chat-only', name: 'Chat only', endpoints: ['chat.completions'] }
                    ]
                });
            }
            assert.equal(options.headers.Authorization, 'Bearer user-token');
            return response(200, { object: 'list', data: [{ id: 'auto:gpt-5-5', object: 'model' }] });
        }
    });

    const models = await client.listResponsesModels('user-token');
    assert.deepEqual(models.map(model => model.id), ['auto:gpt-5-5']);
});

test('listAuthorizedModels maps 401 to a safe user-facing error', async () => {
    const client = new TensorGridClient({
        fetchImpl: async () => response(401, { error: { message: 'do not expose this body' } })
    });
    await assert.rejects(client.listAuthorizedModels('bad-token'), error => {
        assert.equal(error.code, 'TOKEN_UNAUTHORIZED');
        assert.equal(error.message.includes('do not expose'), false);
        return true;
    });
});

test('token validation rejects newlines', async () => {
    const client = new TensorGridClient({ fetchImpl: async () => response(200, { data: [] }) });
    await assert.rejects(client.listAuthorizedModels('bad\ntoken'), error => error.code === 'TOKEN_INVALID');
});
