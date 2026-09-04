'use strict';

const CATALOG_URL = 'https://tensorgrid.space/api/model-hub/catalog/';
const MODELS_URL = 'https://api.tensorgrid.space/v1/models';
const CODEX_PROVIDER_NAME = 'tensorgrid';
const CODEX_ENV_KEY = 'TENSORGRID_API_KEY';
const CODEX_BASE_URL = 'https://api.tensorgrid.space/v1';
const CHATGPT_PROCESS_NAMES = Object.freeze(['ChatGPT.exe']);
const STATE_MANIFEST_NAME = 'tensorgrid-state.json';

const PROVIDER_CONFIG = Object.freeze({
    name: 'TensorGrid',
    base_url: CODEX_BASE_URL,
    wire_api: 'responses',
    env_key: CODEX_ENV_KEY
});

module.exports = {
    CATALOG_URL,
    MODELS_URL,
    CODEX_PROVIDER_NAME,
    CODEX_ENV_KEY,
    CODEX_BASE_URL,
    CHATGPT_PROCESS_NAMES,
    STATE_MANIFEST_NAME,
    PROVIDER_CONFIG
};
