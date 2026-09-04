'use strict';

const i18n = window.tensorgridI18n;
const theme = window.tensorgridTheme;

const statusCard = document.querySelector('#status-card');
const statusIcon = document.querySelector('#status-icon');
const statusKicker = document.querySelector('#status-kicker');
const statusTitle = document.querySelector('#status-title');
const statusDescription = document.querySelector('#status-description');
const statusModel = document.querySelector('#status-model');
const statusHome = document.querySelector('#status-home');
const statusChecked = document.querySelector('#status-checked');
const lockBanner = document.querySelector('#lock-banner');
const lockIcon = document.querySelector('#lock-icon');
const lockTitle = document.querySelector('#lock-title');
const lockDescription = document.querySelector('#lock-description');
const setupPanel = document.querySelector('#setup-panel');
const setupHeading = document.querySelector('#setup-heading');
const tokenInput = document.querySelector('#token');
const toggleToken = document.querySelector('#toggle-token');
const loadModelsButton = document.querySelector('#load-models');
const activePanel = document.querySelector('#active-panel');
const activeNote = document.querySelector('#active-note');
const changeModelButton = document.querySelector('#change-model');
const revertButton = document.querySelector('#revert');
const refreshStatusButton = document.querySelector('#refresh-status');
const modelPanel = document.querySelector('#model-panel');
const modelPanelHeading = document.querySelector('#model-panel-heading');
const refreshModelsButton = document.querySelector('#refresh-models');
const applyButton = document.querySelector('#apply');
const modelSelect = document.querySelector('#model');
const tokenStatus = document.querySelector('#token-status');
const applyStatus = document.querySelector('#apply-status');
const errorBox = document.querySelector('#error-box');
const preview = document.querySelector('#preview');
const resultNotice = document.querySelector('#result-notice');
const closeButton = document.querySelector('#close');
const localeSelect = document.querySelector('#locale');
const themeSelect = document.querySelector('#theme');

const mutationControls = [
    tokenInput,
    toggleToken,
    loadModelsButton,
    changeModelButton,
    revertButton,
    refreshModelsButton,
    applyButton,
    modelSelect
];

const ICONS = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>',
    chatgpt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5A8.5 8.5 0 0 0 12 3.5Z"/><path d="M8.5 12h7M12 8.5v7"/></svg>',
    tensorgrid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 7.5v9L12 20.5 5 16.5v-9l7-4Z"/><path d="m8 9.8 4 2.3 4-2.3M12 12.1v5.1"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10" width="13" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 8 15H4L12 4Z"/><path d="M12 9v4M12 16.5h.01"/></svg>',
    custom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="8.5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.7-4L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14.7 4L20 15"/><path d="M20 20v-5h-5"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z"/><path d="m18.5 16 .5 2 .5-2 2-.5-2-.5-.5-2-.5 2-2 .5 2 .5Z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z"/><circle cx="12" cy="12" r="2"/></svg>'
};

let models = [];
let state;
let modelContext = 'setup';
let busy = false;

function translate(key, params) {
    return i18n.translate(key, params);
}

function setIcon(element, icon) {
    if (element) {
        element.innerHTML = ICONS[icon] || ICONS.warning;
    }
}

function renderButtonIcons() {
    document.querySelectorAll('[data-icon]').forEach(element => setIcon(element, element.dataset.icon));
}

function buttonLabel(button) {
    return [...button.children].reverse().find(element => !element.classList.contains('button-icon')) || button;
}

function setBusy(value, button, busyKey) {
    busy = value;
    if (value) {
        if (!button.dataset.originalLabel) {
            button.dataset.originalLabel = buttonLabel(button).textContent;
        }
        buttonLabel(button).textContent = translate(busyKey);
    } else if (button.dataset.originalLabel) {
        buttonLabel(button).textContent = button.dataset.originalLabel;
        delete button.dataset.originalLabel;
    }
    renderControls();
}

function setError(error) {
    const code = error?.code;
    const localized = code ? translate(`error.${code}`) : '';
    errorBox.textContent = localized && localized !== `error.${code}`
        ? localized
        : error?.message || translate('error.generic');
    errorBox.hidden = false;
}

function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
}

function setResult(key, kind = 'success') {
    resultNotice.textContent = translate(key);
    resultNotice.className = `notice ${kind}`;
    resultNotice.hidden = false;
}

function formatCheckedAt(value) {
    if (!value) {
        return '—';
    }
    try {
        return i18n.formatDateTime(value);
    } catch (_error) {
        return '—';
    }
}

function errorForConnection(code) {
    const key = `error.${code || 'CONNECTION_FAILED'}`;
    const result = translate(key);
    return result === key ? translate('error.CONNECTION_FAILED') : result;
}

function renderStatus() {
    const processState = state?.chatgptProcess;
    const locked = processState !== 'closed';
    let statusClass = 'status-chatgpt';
    let icon = 'chatgpt';
    let kicker = translate('status.chatgpt.kicker');
    let title = translate('status.chatgpt.title');
    let description = translate('status.chatgpt.description');

    if (processState === 'running') {
        statusClass = 'status-locked';
        icon = 'lock';
        kicker = translate('status.locked.kicker');
        title = translate('status.locked.title');
        description = translate('status.locked.description');
    } else if (processState === 'unknown') {
        statusClass = 'status-locked';
        icon = 'warning';
        kicker = translate('status.unknown.kicker');
        title = translate('status.unknown.title');
        description = translate('status.unknown.description');
    } else if (state?.provider === 'tensorgrid' && state.connection === 'tensorgrid-verified') {
        statusClass = 'status-tensorgrid';
        icon = 'tensorgrid';
        kicker = translate('status.tensorgrid.kicker');
        title = translate('status.tensorgrid.title');
        description = state.authorizedModelCount === null
            ? translate('status.tensorgrid.descriptionNoCount')
            : translate('status.tensorgrid.description', { count: i18n.formatNumber(state.authorizedModelCount) });
    } else if (state?.provider === 'tensorgrid') {
        statusClass = 'status-warning';
        icon = 'warning';
        kicker = translate('status.tensorgridConfigured.kicker');
        title = translate('status.tensorgridConfigured.title');
        description = errorForConnection(state.connectionCode);
    } else if (state?.provider === 'custom') {
        statusClass = 'status-custom';
        icon = 'custom';
        kicker = translate('status.custom.kicker');
        title = translate('status.custom.title');
        description = translate('status.custom.description');
    } else if (state?.provider === 'invalid') {
        statusClass = 'status-error';
        icon = 'warning';
        kicker = translate('status.invalid.kicker');
        title = translate('status.invalid.title');
        description = translate('status.invalid.description');
    } else if (!state) {
        kicker = translate('status.kicker');
        title = translate('status.checking');
        description = translate('status.checkingDescription');
    }

    statusCard.className = `status-card ${statusClass}`;
    setIcon(statusIcon, icon);
    setIcon(lockIcon, processState === 'unknown' ? 'warning' : 'lock');
    statusKicker.textContent = kicker;
    statusTitle.textContent = title;
    statusDescription.textContent = description;
    statusModel.textContent = state?.configuredModel
        ? translate('status.model', { value: state.configuredModel })
        : translate('status.modelDefault');
    statusHome.textContent = state?.codexHome
        ? translate('status.home', { value: state.codexHome })
        : translate('status.home', { value: '—' });
    statusChecked.textContent = translate('status.checked', { value: formatCheckedAt(state?.checkedAt) });

    lockBanner.hidden = !locked;
    lockTitle.textContent = processState === 'running'
        ? translate('lock.running.title')
        : translate('lock.unknown.title');
    lockDescription.textContent = processState === 'running'
        ? translate('lock.running.description')
        : translate('lock.unknown.description');

    const isVerified = state?.provider === 'tensorgrid' && state.connection === 'tensorgrid-verified';
    const isTensorGrid = state?.provider === 'tensorgrid';
    setupPanel.hidden = isVerified;
    activePanel.hidden = !isTensorGrid;
    setupHeading.textContent = isTensorGrid ? translate('setup.repairTitle') : translate('setup.title');
    changeModelButton.hidden = !isVerified;
    revertButton.hidden = !isTensorGrid;
    activeNote.textContent = state?.revertBlockedReason === 'CONFIG_DRIFT'
        ? translate('connection.drift')
        : isTensorGrid && !state.revertAvailable
            ? translate('connection.snapshotMissing')
            : translate('connection.revertHelp');
    modelPanelHeading.textContent = translate(modelContext === 'change' ? 'setup.changeModelTitle' : 'setup.modelTitle');

    if (isVerified && !modelPanel.hidden && modelContext !== 'change') {
        modelPanel.hidden = true;
    }
    if (!isTensorGrid) {
        modelContext = 'setup';
    }

    renderControls();
}

function renderControls() {
    const allowed = Boolean(state?.canMutate) && !busy;
    mutationControls.forEach(control => {
        if (control) {
            control.disabled = !allowed;
        }
    });
    refreshStatusButton.disabled = busy;
    closeButton.disabled = false;
    if (state?.provider === 'tensorgrid') {
        revertButton.disabled = !allowed || !state.revertAvailable;
        changeModelButton.disabled = !allowed || state.connection !== 'tensorgrid-verified';
    }
}

function showPreview(selected) {
    preview.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = translate('setup.preview');
    preview.append(title);

    const list = document.createElement('ul');
    const entries = [
        [translate('setup.preview.provider'), 'tensorgrid'],
        [translate('setup.preview.model'), selected.id],
        [translate('setup.preview.baseUrl'), 'https://api.tensorgrid.space/v1'],
        [translate('setup.preview.envKey'), 'TENSORGRID_API_KEY'],
        [translate('setup.preview.files'), `${state.configPath} · ${state.envPath}`]
    ];
    entries.forEach(([label, value]) => {
        const item = document.createElement('li');
        const labelNode = document.createElement('span');
        labelNode.textContent = `${label}: `;
        const valueNode = document.createElement('code');
        valueNode.dir = 'ltr';
        valueNode.textContent = value;
        item.append(labelNode, valueNode);
        list.append(item);
    });
    preview.append(list);
}

function renderModels() {
    modelSelect.replaceChildren();
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name} — ${model.id}`;
        option.dir = 'ltr';
        modelSelect.append(option);
    });
    if (state?.configuredModel && models.some(model => model.id === state.configuredModel)) {
        modelSelect.value = state.configuredModel;
    }
    const selected = models.find(model => model.id === modelSelect.value) || models[0];
    if (selected) {
        modelSelect.value = selected.id;
        showPreview(selected);
    }
}

async function loadModels({ context = modelContext } = {}) {
    if (!state?.canMutate || busy) {
        return;
    }

    clearError();
    modelContext = context;
    tokenStatus.textContent = translate('actions.loading');
    setBusy(true, loadModelsButton, 'actions.checking');
    setBusy(true, refreshModelsButton, 'actions.loading');
    try {
        const token = tokenInput.value.trim() || undefined;
        const result = await window.codexSetup.listModels(token);
        if (!result.ok) {
            throw result.error;
        }
        models = result.data;
        renderModels();
        tokenStatus.textContent = translate('setup.modelsFound', { count: i18n.formatNumber(models.length) });
        modelPanel.hidden = false;
        modelPanelHeading.textContent = translate(modelContext === 'change' ? 'setup.changeModelTitle' : 'setup.modelTitle');
    } catch (error) {
        setError(error);
        tokenStatus.textContent = '';
    } finally {
        setBusy(false, loadModelsButton);
        setBusy(false, refreshModelsButton);
        renderControls();
    }
}

async function applySetup() {
    if (!state?.canMutate || busy) {
        return;
    }

    clearError();
    const selected = models.find(model => model.id === modelSelect.value);
    if (!selected) {
        setError({ code: 'MODEL_REQUIRED' });
        return;
    }

    applyStatus.textContent = translate('actions.applying');
    setBusy(true, applyButton, 'actions.applying');
    try {
        const result = await window.codexSetup.apply({
            token: tokenInput.value.trim() || undefined,
            modelId: selected.id
        });
        if (!result.ok) {
            throw result.error;
        }
        setResult('result.apply');
        tokenInput.value = '';
        models = [];
        modelPanel.hidden = true;
        applyStatus.textContent = '';
    } catch (error) {
        setError(error);
        applyStatus.textContent = '';
    } finally {
        setBusy(false, applyButton);
        renderControls();
    }
}

async function revertSetup() {
    if (!state?.canMutate || !state.revertAvailable || busy) {
        return;
    }
    if (!window.confirm(translate('confirm.revert'))) {
        return;
    }

    clearError();
    setBusy(true, revertButton, 'actions.reverting');
    try {
        const result = await window.codexSetup.revert();
        if (!result.ok) {
            throw result.error;
        }
        setResult('result.revert');
        modelPanel.hidden = true;
    } catch (error) {
        setError(error);
    } finally {
        setBusy(false, revertButton);
        renderControls();
    }
}

async function refreshStatus() {
    if (busy) {
        return;
    }
    clearError();
    setBusy(true, refreshStatusButton, 'actions.checking');
    try {
        const result = await window.codexSetup.getState();
        if (!result.ok) {
            throw result.error;
        }
        state = result.data;
        renderStatus();
    } catch (error) {
        setError(error);
    } finally {
        setBusy(false, refreshStatusButton);
        renderControls();
    }
}

function applyLocale() {
    i18n.applyStaticTranslations();
    localeSelect.value = i18n.getLocale();
    document.title = `${translate('brand.eyebrow')} · ${translate('brand.title')}`;
    renderButtonIcons();
    if (state) {
        renderStatus();
    }
    if (models.length) {
        renderModels();
    }
}

function applyThemeSelection() {
    themeSelect.value = theme.getThemeMode();
}

toggleToken.addEventListener('click', () => {
    const visible = tokenInput.type === 'text';
    tokenInput.type = visible ? 'password' : 'text';
    toggleToken.querySelector(':not(.button-icon)')?.replaceChildren(document.createTextNode(translate(visible ? 'actions.show' : 'actions.hide')));
});
loadModelsButton.addEventListener('click', () => loadModels({ context: 'setup' }));
refreshModelsButton.addEventListener('click', () => loadModels({ context: modelContext }));
applyButton.addEventListener('click', applySetup);
changeModelButton.addEventListener('click', () => loadModels({ context: 'change' }));
revertButton.addEventListener('click', revertSetup);
refreshStatusButton.addEventListener('click', refreshStatus);
localeSelect.addEventListener('change', event => i18n.setLocale(event.target.value));
themeSelect.addEventListener('change', event => theme.setThemeMode(event.target.value));
modelSelect.addEventListener('change', () => {
    const selected = models.find(model => model.id === modelSelect.value);
    if (selected) {
        showPreview(selected);
    }
});
closeButton.addEventListener('click', () => window.close());
tokenInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        loadModels({ context: 'setup' });
    }
});

i18n.onChange(applyLocale);
theme.onChange(applyThemeSelection);
applyLocale();
applyThemeSelection();

window.codexSetup.onStateChanged(nextState => {
    state = nextState;
    renderStatus();
});

window.codexSetup.getState().then(result => {
    if (!result.ok) {
        setError(result.error);
        mutationControls.forEach(control => { control.disabled = true; });
        return;
    }
    state = result.data;
    renderStatus();
}).catch(setError);
