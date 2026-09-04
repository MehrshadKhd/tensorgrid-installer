'use strict';

const fs = require('node:fs');
const { parse, stringify } = require('smol-toml');
const { CODEX_ENV_KEY, CODEX_PROVIDER_NAME, PROVIDER_CONFIG } = require('./constants.cjs');
const { SetupError } = require('./errors.cjs');

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseConfig(content) {
    if (!content.trim()) {
        return {};
    }

    try {
        const parsed = parse(content);
        if (!isRecord(parsed)) {
            throw new Error('TOML root is not a table.');
        }
        return parsed;
    } catch (error) {
        throw new SetupError('CONFIG_INVALID', 'فایل config.toml معتبر نیست و برای جلوگیری از آسیب، تغییری ندادیم.', { cause: error });
    }
}

function serializeConfig(config) {
    try {
        return `${stringify(config).trimEnd()}\n`;
    } catch (error) {
        throw new SetupError('CONFIG_SERIALIZE_FAILED', 'config.toml قابل ذخیره‌سازی نیست.', { cause: error });
    }
}

function mergeConfigToml(content, modelId) {
    if (typeof modelId !== 'string' || !modelId.trim() || /[\r\n]/.test(modelId)) {
        throw new SetupError('MODEL_INVALID', 'شناسه مدل انتخاب‌شده معتبر نیست.');
    }

    const config = parseConfig(content);
    if (config.model_providers !== undefined && !isRecord(config.model_providers)) {
        throw new SetupError('CONFIG_INVALID', 'ساختار model_providers در config.toml معتبر نیست؛ تغییری ندادیم.');
    }
    const providers = isRecord(config.model_providers) ? config.model_providers : {};
    if (providers[CODEX_PROVIDER_NAME] !== undefined && !isRecord(providers[CODEX_PROVIDER_NAME])) {
        throw new SetupError('CONFIG_INVALID', 'ساختار provider فعلی TensorGrid در config.toml معتبر نیست؛ تغییری ندادیم.');
    }
    const currentTensorGrid = isRecord(providers[CODEX_PROVIDER_NAME])
        ? providers[CODEX_PROVIDER_NAME]
        : {};

    config.model = modelId.trim();
    config.model_provider = CODEX_PROVIDER_NAME;
    config.model_providers = {
        ...providers,
        [CODEX_PROVIDER_NAME]: {
            ...currentTensorGrid,
            ...PROVIDER_CONFIG
        }
    };

    return serializeConfig(config);
}

function quoteEnvValue(value) {
    if (/^[A-Za-z0-9._~+/=-]+$/.test(value)) {
        return value;
    }
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function upsertEnv(content, token) {
    if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) {
        throw new SetupError('TOKEN_INVALID', 'توکن برای ذخیره‌سازی معتبر نیست.');
    }

    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    const hasTrailingNewline = /(?:\r\n|\n)$/.test(content);
    const lines = content ? content.split(/\r?\n/) : [];
    if (hasTrailingNewline) {
        lines.pop();
    }

    const replacement = `${CODEX_ENV_KEY}=${quoteEnvValue(token.trim())}`;
    let replaced = false;
    const nextLines = [];
    for (const line of lines) {
        if (/^\s*(?:export\s+)?TENSORGRID_API_KEY\s*=/.test(line)) {
            if (!replaced) {
                nextLines.push(replacement);
                replaced = true;
            }
            continue;
        }
        nextLines.push(line);
    }

    if (!replaced) {
        nextLines.push(replacement);
    }

    return `${nextLines.join(newline)}${newline}`;
}

function decodeEnvValue(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        const inner = trimmed.slice(1, -1);
        try {
            return JSON.parse(`"${inner.replace(/"/g, '\\"')}"`);
        } catch (_error) {
            return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    }

    if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
        return trimmed.slice(1, -1).replace(/''/g, "'");
    }

    return trimmed.replace(/\s+#.*$/, '').trim();
}

function readEnvValue(content, key = CODEX_ENV_KEY) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${escapedKey}\\s*=\\s*(.*?)\\s*$`);
    for (const line of String(content || '').split(/\r?\n/)) {
        const match = line.match(pattern);
        if (!match) {
            continue;
        }
        const value = decodeEnvValue(match[1]);
        if (value) {
            return value.trim();
        }
    }
    return undefined;
}

function inspectConfig(content) {
    const config = parseConfig(content);
    const modelProvider = typeof config.model_provider === 'string'
        ? config.model_provider.trim()
        : '';
    const openAiBaseUrl = typeof config.openai_base_url === 'string'
        ? config.openai_base_url.trim()
        : '';
    const provider = isRecord(config.model_providers?.[CODEX_PROVIDER_NAME])
        ? config.model_providers[CODEX_PROVIDER_NAME]
        : undefined;

    if (modelProvider === CODEX_PROVIDER_NAME) {
        const configured = Boolean(provider)
            && provider.name === 'TensorGrid'
            && provider.base_url === PROVIDER_CONFIG.base_url
            && provider.wire_api === PROVIDER_CONFIG.wire_api
            && provider.env_key === PROVIDER_CONFIG.env_key;

        return {
            provider: CODEX_PROVIDER_NAME,
            configured,
            configuredModel: typeof config.model === 'string' ? config.model : undefined,
            config
        };
    }

    if ((!modelProvider || modelProvider === 'openai') && !openAiBaseUrl) {
        return {
            provider: 'chatgpt',
            configured: true,
            configuredModel: typeof config.model === 'string' ? config.model : undefined,
            config
        };
    }

    return {
        provider: 'custom',
        configured: true,
        configuredModel: typeof config.model === 'string' ? config.model : undefined,
        config
    };
}

function readTextIfExists(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

module.exports = {
    CODEX_ENV_KEY,
    isRecord,
    parseConfig,
    mergeConfigToml,
    serializeConfig,
    upsertEnv,
    readEnvValue,
    inspectConfig,
    readTextIfExists
};
