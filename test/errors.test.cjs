'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { SetupError, publicError } = require('../src/errors.cjs');

test('public setup errors expose stable code and safe params without causes', () => {
    const result = publicError(new SetupError('TOKEN_UNAUTHORIZED', 'safe message', {
        params: { endpoint: '/v1/models' },
        cause: new Error('private cause')
    }));
    assert.deepEqual(result, {
        code: 'TOKEN_UNAUTHORIZED',
        params: { endpoint: '/v1/models' },
        message: 'safe message'
    });
    assert.doesNotMatch(JSON.stringify(result), /private cause/);
});
