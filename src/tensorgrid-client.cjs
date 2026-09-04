'use strict';

const { CATALOG_URL, MODELS_URL } = require('./constants.cjs');
const { SetupError } = require('./errors.cjs');

function validateToken(token) {
    if (typeof token !== 'string' || token.trim().length === 0) {
        throw new SetupError('TOKEN_REQUIRED', 'توکن TensorGrid را وارد کنید.');
    }

    if (/\r|\n/.test(token)) {
        throw new SetupError('TOKEN_INVALID', 'توکن نمی‌تواند شامل خط جدید باشد.');
    }

    return token.trim();
}

function asArray(payload, keys) {
    if (Array.isArray(payload)) {
        return payload;
    }

    for (const key of keys) {
        if (payload && Array.isArray(payload[key])) {
            return payload[key];
        }
    }

    return [];
}

function normalizeEndpoints(model) {
    const endpoints = model?.endpoints || model?.supported_endpoints || model?.capabilities?.endpoints || [];
    if (Array.isArray(endpoints)) {
        return endpoints.filter(endpoint => typeof endpoint === 'string');
    }

    if (endpoints && typeof endpoints === 'object') {
        return Object.entries(endpoints)
            .filter(([, enabled]) => enabled)
            .map(([endpoint]) => endpoint);
    }

    return [];
}

function normalizeCatalogModel(model) {
    const id = [model?.id, model?.model_id, model?.modelId]
        .find(value => typeof value === 'string' && value.trim().length > 0);

    if (!id) {
        return undefined;
    }

    return {
        id: id.trim(),
        name: typeof model.name === 'string' && model.name.trim() ? model.name.trim() : id.trim(),
        description: typeof model.description === 'string' ? model.description : '',
        endpoints: normalizeEndpoints(model)
    };
}

function normalizeAuthorizedModel(model) {
    const id = typeof model?.id === 'string' ? model.id.trim() : '';
    return id ? { id, name: typeof model.name === 'string' ? model.name : id } : undefined;
}

function canonicalModelId(id) {
    return id.replace(/^tg-go:/, '');
}

function uniqueIndex(models, key) {
    const index = new Map();
    for (const model of models) {
        const value = key(model);
        if (!value) {
            continue;
        }
        if (index.has(value)) {
            index.set(value, undefined);
        } else {
            index.set(value, model);
        }
    }
    return index;
}

class TensorGridClient {
    constructor({ fetchImpl = globalThis.fetch, catalogUrl = CATALOG_URL, modelsUrl = MODELS_URL, timeoutMs = 15000 } = {}) {
        if (typeof fetchImpl !== 'function') {
            throw new Error('A fetch implementation is required.');
        }
        this.fetchImpl = fetchImpl;
        this.catalogUrl = catalogUrl;
        this.modelsUrl = modelsUrl;
        this.timeoutMs = timeoutMs;
    }

    async requestJson(url, { token } = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const headers = { Accept: 'application/json' };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const response = await this.fetchImpl(url, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            const bodyText = await response.text();

            if (!response.ok) {
                const code = response.status === 401 ? 'TOKEN_UNAUTHORIZED'
                    : response.status === 402 ? 'CREDIT_REQUIRED'
                        : response.status === 404 ? 'MODELS_ENDPOINT_NOT_FOUND'
                            : 'REMOTE_HTTP_ERROR';
                const message = response.status === 401
                    ? 'توکن TensorGrid نامعتبر، منقضی یا revoke شده است.'
                    : response.status === 402
                        ? 'برای استفاده از Model Hub اعتبار کافی وجود ندارد.'
                        : response.status === 404
                            ? 'endpoint مدل‌های TensorGrid پیدا نشد.'
                            : 'ارتباط با سرویس TensorGrid با خطا مواجه شد.';
                throw new SetupError(code, message, { status: response.status });
            }

            try {
                return bodyText ? JSON.parse(bodyText) : {};
            } catch (error) {
                throw new SetupError('REMOTE_INVALID_JSON', 'پاسخ سرویس TensorGrid قابل خواندن نیست.', { cause: error });
            }
        } catch (error) {
            if (error instanceof SetupError) {
                throw error;
            }
            if (error?.name === 'AbortError') {
                throw new SetupError('NETWORK_TIMEOUT', 'ارتباط با TensorGrid بیش از حد طول کشید.', { cause: error });
            }
            throw new SetupError('NETWORK_ERROR', 'به TensorGrid وصل نشدیم. اتصال اینترنت و firewall را بررسی کنید.', { cause: error });
        } finally {
            clearTimeout(timeout);
        }
    }

    async listCatalog() {
        const payload = await this.requestJson(this.catalogUrl);
        return asArray(payload, ['results', 'models'])
            .map(normalizeCatalogModel)
            .filter(Boolean);
    }

    async listAuthorizedModels(token) {
        const validToken = validateToken(token);
        const payload = await this.requestJson(this.modelsUrl, { token: validToken });
        return asArray(payload, ['data', 'models'])
            .map(normalizeAuthorizedModel)
            .filter(Boolean);
    }

    async listResponsesModels(token) {
        const [catalog, authorized] = await Promise.all([
            this.listCatalog(),
            this.listAuthorizedModels(token)
        ]);
        const exact = uniqueIndex(authorized, model => model.id);
        const canonical = uniqueIndex(authorized, model => canonicalModelId(model.id));

        const models = catalog
            .filter(model => model.endpoints.includes('responses'))
            .map(model => {
                const match = exact.get(model.id) || canonical.get(canonicalModelId(model.id));
                if (!match) {
                    return undefined;
                }
                return {
                    id: match.id,
                    name: model.name || match.name || match.id,
                    description: model.description,
                    endpoints: model.endpoints,
                    catalogId: model.id
                };
            })
            .filter(Boolean)
            .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

        if (models.length === 0) {
            throw new SetupError('NO_RESPONSES_MODELS', 'هیچ مدل قابل استفاده برای Responses با این توکن پیدا نشد.');
        }

        return models;
    }
}

module.exports = {
    TensorGridClient,
    validateToken,
    normalizeCatalogModel,
    canonicalModelId
};
