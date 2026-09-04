'use strict';

class SetupError extends Error {
    constructor(code, message, options = {}) {
        super(message);
        this.name = 'SetupError';
        this.code = code;
        this.params = options.params && typeof options.params === 'object' ? options.params : {};
        this.status = options.status;
        this.cause = options.cause;
    }
}

function publicError(error) {
    if (error instanceof SetupError) {
        return { code: error.code, params: error.params, message: error.message };
    }

    return {
        code: 'UNKNOWN_ERROR',
        params: {},
        message: 'راه‌اندازی انجام نشد. لطفاً دوباره تلاش کنید.'
    };
}

module.exports = { SetupError, publicError };
