'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveCodexHome } = require('./platform.cjs');
const {
    CODEX_ENV_KEY,
    CODEX_PROVIDER_NAME,
    CODEX_BASE_URL,
    STATE_MANIFEST_NAME
} = require('./constants.cjs');
const {
    mergeConfigToml,
    upsertEnv,
    parseConfig,
    readEnvValue,
    inspectConfig
} = require('./codex-config.cjs');
const { validateToken } = require('./tensorgrid-client.cjs');
const { SetupError } = require('./errors.cjs');
const { restrictToCurrentWindowsUser } = require('./windows-security.cjs');
const { readChatGPTProcessState } = require('./process-guard.cjs');

const CONNECTION_CACHE_MS = 30_000;

function pathsFor(codexHome) {
    return {
        codexHome,
        configPath: path.join(codexHome, 'config.toml'),
        envPath: path.join(codexHome, '.env'),
        authPath: path.join(codexHome, 'auth.json'),
        backupRoot: path.join(codexHome, 'backups'),
        manifestPath: path.join(codexHome, 'backups', STATE_MANIFEST_NAME)
    };
}

function readSnapshot(filePath) {
    if (!fs.existsSync(filePath)) {
        return { exists: false, content: undefined, mtimeMs: undefined };
    }
    return { exists: true, content: fs.readFileSync(filePath), mtimeMs: fs.statSync(filePath).mtimeMs };
}

function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function snapshotSummary(snapshot) {
    return {
        exists: snapshot.exists,
        sha256: snapshot.exists ? hashContent(snapshot.content) : null
    };
}

function summariesEqual(actual, expected) {
    return Boolean(expected)
        && actual.exists === Boolean(expected.exists)
        && (!actual.exists || actual.sha256 === expected.sha256);
}

function sameBytes(left, right) {
    return left.length === right.length && left.equals(right);
}

function sameSnapshot(left, right) {
    return left.exists === right.exists
        && (!left.exists || sameBytes(left.content, right.content));
}

function makeBackupDirectory(root, prefix = 'tensorgrid-codex-setup') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = crypto.randomBytes(3).toString('hex');
    const backupDir = path.join(root, `${prefix}-${timestamp}-${suffix}`);
    fs.mkdirSync(backupDir, { recursive: true });
    return backupDir;
}

async function backupFile(source, destination, secureFile) {
    fs.copyFileSync(source, destination);
    await secureFile(destination);
}

async function writeAtomic(filePath, content, { prepareTemp, mode = 0o600 } = {}) {
    const directory = path.dirname(filePath);
    await fsp.mkdir(directory, { recursive: true });
    const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);

    try {
        if (typeof content === 'string') {
            await fsp.writeFile(temporaryPath, content, { encoding: 'utf8', mode });
        } else {
            await fsp.writeFile(temporaryPath, content, { mode });
        }
        if (prepareTemp) {
            await prepareTemp(temporaryPath);
        }
        await fsp.rename(temporaryPath, filePath);
    } catch (error) {
        await fsp.rm(temporaryPath, { force: true }).catch(() => undefined);
        throw error;
    }
}

async function writeTextAtomic(filePath, content, options = {}) {
    return writeAtomic(filePath, content, options);
}

async function removeFileIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.remove`);
    await fsp.rename(filePath, temporaryPath);
    try {
        await fsp.rm(temporaryPath, { force: true });
    } catch (error) {
        await fsp.rename(temporaryPath, filePath).catch(() => undefined);
        throw error;
    }
}

async function restoreSnapshot(filePath, snapshot, { secure = false, secureFile } = {}) {
    if (!snapshot.exists) {
        await removeFileIfExists(filePath);
        return;
    }

    await writeAtomic(filePath, snapshot.content, {
        prepareTemp: secure && secureFile ? secureFile : undefined
    });
}

async function rollbackFile(filePath, snapshot, options = {}) {
    await restoreSnapshot(filePath, snapshot, options);
}

function manifestIsSafe(manifest) {
    return Boolean(manifest)
        && manifest.schemaVersion === 1
        && typeof manifest.active === 'boolean'
        && typeof manifest.backupDir === 'string'
        && manifest.backupDir.length > 0
        && manifest.backupDir === path.basename(manifest.backupDir)
        && !manifest.backupDir.includes('..');
}

function readManifest(paths) {
    if (!fs.existsSync(paths.manifestPath)) {
        return undefined;
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(paths.manifestPath, 'utf8'));
        return manifestIsSafe(manifest) ? manifest : undefined;
    } catch (_error) {
        return undefined;
    }
}

function backupPath(paths, manifest, fileName) {
    if (!manifestIsSafe(manifest)) {
        return undefined;
    }
    const candidate = path.resolve(paths.backupRoot, manifest.backupDir, fileName);
    const root = `${path.resolve(paths.backupRoot)}${path.sep}`;
    return candidate.startsWith(root) ? candidate : undefined;
}

function readBackupSnapshot(paths, manifest, fileName) {
    const filePath = backupPath(paths, manifest, fileName);
    return filePath ? readSnapshot(filePath) : { exists: false, content: undefined, mtimeMs: undefined };
}

function listBackupDirectories(paths) {
    if (!fs.existsSync(paths.backupRoot)) {
        return [];
    }

    return fs.readdirSync(paths.backupRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name.startsWith('tensorgrid-codex-setup-'))
        .map(entry => {
            const fullPath = path.join(paths.backupRoot, entry.name);
            return { name: entry.name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
        })
        .sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function findLegacyBackup(paths) {
    for (const candidate of listBackupDirectories(paths)) {
        const configPath = path.join(candidate.fullPath, 'config.toml');
        if (!fs.existsSync(configPath)) {
            continue;
        }

        try {
            const info = inspectConfig(fs.readFileSync(configPath, 'utf8'));
            if (info.provider !== CODEX_PROVIDER_NAME && info.provider !== 'invalid') {
                return {
                    schemaVersion: 1,
                    active: true,
                    legacy: true,
                    backupDir: candidate.name,
                    createdAt: new Date(candidate.mtimeMs).toISOString()
                };
            }
        } catch (_error) {
            // An invalid legacy backup is not safe to restore automatically.
        }
    }
    return undefined;
}

function activeManifestOrLegacy(paths, state) {
    const manifest = readManifest(paths);
    if (manifest?.active) {
        return manifest;
    }

    if (state.provider === CODEX_PROVIDER_NAME && state.tensorgridConfigured) {
        return findLegacyBackup(paths);
    }

    return undefined;
}

function buildManifest(paths, backupDir, beforeSnapshots, existingManifest) {
    const before = {
        config: snapshotSummary(beforeSnapshots.config),
        env: snapshotSummary(beforeSnapshots.env)
    };
    const after = {
        config: snapshotSummary(readSnapshot(paths.configPath)),
        env: snapshotSummary(readSnapshot(paths.envPath))
    };

    return {
        schemaVersion: 1,
        active: true,
        backupDir: path.basename(backupDir),
        createdAt: existingManifest?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        before: existingManifest?.before || before,
        after
    };
}

async function writeManifest(paths, manifest) {
    await writeTextAtomic(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function mapWriteError(error) {
    if (error instanceof SetupError) {
        return error;
    }

    if (error?.code === 'EACCES' || error?.code === 'EPERM') {
        return new SetupError('WRITE_PERMISSION', 'دسترسی نوشتن در Codex Home وجود ندارد؛ Codex را ببندید و دسترسی پوشه را بررسی کنید.', { cause: error });
    }

    if (error?.code === 'EBUSY' || error?.code === 'ETXTBSY') {
        return new SetupError('FILE_IN_USE', 'یکی از فایل‌های Codex توسط برنامه دیگری باز است؛ Codex و ChatGPT Desktop را کاملاً ببندید و دوباره تلاش کنید.', { cause: error });
    }

    return new SetupError('WRITE_FAILED', 'فایل‌های Codex ذخیره نشدند و تغییرات rollback شد.', { cause: error });
}

class InstallService {
    constructor({
        client,
        environment = process.env,
        platform = process.platform,
        secureFile = filePath => restrictToCurrentWindowsUser(filePath, { platform, environment }),
        processProbe = () => readChatGPTProcessState({ platform })
    }) {
        this.client = client;
        this.environment = environment;
        this.platform = platform;
        this.secureFile = secureFile;
        this.processProbe = processProbe;
        this.connectionCache = undefined;
    }

    resolvePaths() {
        return pathsFor(resolveCodexHome({ environment: this.environment, platform: this.platform }));
    }

    readProcessState() {
        try {
            const result = this.processProbe();
            if (result === 'running' || result === 'closed' || result === 'unknown') {
                return result;
            }
            return result ? 'running' : 'closed';
        } catch (_error) {
            return 'unknown';
        }
    }

    getState() {
        const paths = this.resolvePaths();
        const processState = this.readProcessState();
        const configSnapshot = readSnapshot(paths.configPath);
        const envSnapshot = readSnapshot(paths.envPath);
        const manifest = readManifest(paths);
        let configInfo;

        try {
            configInfo = inspectConfig(configSnapshot.exists ? configSnapshot.content.toString('utf8') : '');
        } catch (_error) {
            configInfo = { provider: 'invalid', configured: false, configuredModel: undefined };
        }

        const storedToken = envSnapshot.exists
            ? readEnvValue(envSnapshot.content.toString('utf8'))
            : undefined;
        const activeManifest = manifest?.active ? manifest : undefined;
        const currentConfigSummary = snapshotSummary(configSnapshot);
        const currentEnvSummary = snapshotSummary(envSnapshot);
        const currentMatches = activeManifest
            ? summariesEqual(currentConfigSummary, activeManifest.after?.config)
                && summariesEqual(currentEnvSummary, activeManifest.after?.env)
            : true;
        // A user may have restored the original ChatGPT files manually. That is
        // not drift: it means there is no longer anything safe to revert, while
        // the original backup can still be reused on the next Apply.
        const currentMatchesBefore = activeManifest
            ? summariesEqual(currentConfigSummary, activeManifest.before?.config)
                && summariesEqual(currentEnvSummary, activeManifest.before?.env)
            : false;
        const legacyManifest = !activeManifest && configInfo.provider === CODEX_PROVIDER_NAME
            ? findLegacyBackup(paths)
            : undefined;
        const revertAvailable = Boolean((activeManifest && currentMatches) || legacyManifest);
        const revertBlockedReason = activeManifest
            && configInfo.provider === CODEX_PROVIDER_NAME
            && !currentMatches
            && !currentMatchesBefore
            ? 'CONFIG_DRIFT'
            : null;

        let connection = 'custom';
        if (configInfo.provider === 'invalid') {
            connection = 'invalid';
        } else if (configInfo.provider === CODEX_PROVIDER_NAME) {
            connection = 'tensorgrid-configured-unverified';
        } else if (configInfo.provider === 'chatgpt') {
            connection = 'chatgpt-configured';
        }

        const state = {
            platform: this.platform,
            codexHome: paths.codexHome,
            configPath: paths.configPath,
            envPath: paths.envPath,
            hasConfig: configSnapshot.exists,
            hasEnv: envSnapshot.exists,
            hasAuth: fs.existsSync(paths.authPath),
            provider: configInfo.provider,
            tensorgridConfigured: configInfo.provider === CODEX_PROVIDER_NAME && configInfo.configured,
            configuredModel: configInfo.configuredModel || null,
            hasTensorGridKey: Boolean(storedToken),
            connection,
            chatgptProcess: processState,
            canMutate: processState === 'closed',
            blockReason: processState === 'running'
                ? 'CHATGPT_RUNNING'
                : processState === 'unknown' ? 'PROCESS_CHECK_FAILED' : null,
            revertAvailable,
            revertBlockedReason,
            manuallyRestored: Boolean(activeManifest && currentMatchesBefore && !currentMatches),
            connectionCode: null,
            authorizedModelCount: null,
            checkedAt: new Date().toISOString()
        };

        if (state.provider !== CODEX_PROVIDER_NAME || !state.tensorgridConfigured || !state.hasTensorGridKey || state.chatgptProcess !== 'closed') {
            this.connectionCache = undefined;
        } else if (this.connectionCache
            && this.connectionCache.expiresAt > Date.now()
            && this.connectionCache.processState === processState
            && this.connectionCache.configSha256 === snapshotSummary(configSnapshot).sha256
            && this.connectionCache.envSha256 === snapshotSummary(envSnapshot).sha256) {
            return {
                ...state,
                connection: this.connectionCache.connection,
                connectionCode: this.connectionCache.connectionCode,
                authorizedModelCount: this.connectionCache.authorizedModelCount,
                checkedAt: this.connectionCache.checkedAt
            };
        }

        return state;
    }

    async verifyConnection() {
        const localState = this.getState();
        if (localState.provider !== CODEX_PROVIDER_NAME || !localState.tensorgridConfigured || !localState.hasTensorGridKey || !localState.canMutate) {
            return localState;
        }

        const paths = this.resolvePaths();
        const envSnapshot = readSnapshot(paths.envPath);
        const token = validateToken(readEnvValue(envSnapshot.exists ? envSnapshot.content.toString('utf8') : ''));

        try {
            const authorizedModels = await this.client.listAuthorizedModels(token);
            const latestState = this.getState();
            if (latestState.chatgptProcess !== 'closed') {
                return latestState;
            }
            this.setConnectionCache('tensorgrid-verified', null, authorizedModels.length);
            const verifiedState = this.getState();
            return {
                ...verifiedState,
                connection: 'tensorgrid-verified',
                connectionCode: null,
                authorizedModelCount: authorizedModels.length,
                checkedAt: new Date().toISOString()
            };
        } catch (error) {
            const latestState = this.getState();
            this.setConnectionCache('tensorgrid-configured-unverified', error?.code || 'CONNECTION_FAILED', null);
            const unverifiedState = this.getState();
            return {
                ...unverifiedState,
                connection: 'tensorgrid-configured-unverified',
                connectionCode: error?.code || 'CONNECTION_FAILED',
                authorizedModelCount: null,
                checkedAt: new Date().toISOString()
            };
        }
    }

    setConnectionCache(connection, connectionCode, authorizedModelCount) {
        const paths = this.resolvePaths();
        const configSnapshot = readSnapshot(paths.configPath);
        const envSnapshot = readSnapshot(paths.envPath);
        this.connectionCache = {
            connection,
            connectionCode,
            authorizedModelCount,
            processState: 'closed',
            configSha256: snapshotSummary(configSnapshot).sha256,
            envSha256: snapshotSummary(envSnapshot).sha256,
            checkedAt: new Date().toISOString(),
            expiresAt: Date.now() + CONNECTION_CACHE_MS
        };
    }

    assertMutationAllowed() {
        const state = this.getState();
        if (state.chatgptProcess === 'running') {
            throw new SetupError('CHATGPT_RUNNING', 'ChatGPT Desktop باز است. برای ادامه، آن را از System Tray کاملاً Quit کنید.');
        }
        if (state.chatgptProcess === 'unknown') {
            throw new SetupError('PROCESS_CHECK_FAILED', 'وضعیت ChatGPT Desktop قابل بررسی نیست؛ برای امنیت تغییرات قفل شد.');
        }
    }

    resolveToken(token, state, paths) {
        if (typeof token === 'string' && token.trim()) {
            return validateToken(token);
        }

        if (state.provider === CODEX_PROVIDER_NAME && state.hasTensorGridKey) {
            const envSnapshot = readSnapshot(paths.envPath);
            return validateToken(readEnvValue(envSnapshot.exists ? envSnapshot.content.toString('utf8') : ''));
        }

        throw new SetupError('TOKEN_REQUIRED', 'توکن TensorGrid را وارد کنید.');
    }

    async listModels(token) {
        this.assertMutationAllowed();
        const paths = this.resolvePaths();
        const state = this.getState();
        const validToken = this.resolveToken(token, state, paths);
        const models = await this.client.listResponsesModels(validToken);
        this.assertMutationAllowed();
        return models;
    }

    async apply({ token, modelId }) {
        this.assertMutationAllowed();

        if (typeof modelId !== 'string' || !modelId.trim()) {
            throw new SetupError('MODEL_REQUIRED', 'یک مدل Responses انتخاب کنید.');
        }

        const paths = this.resolvePaths();
        const state = this.getState();
        if (state.revertBlockedReason) {
            throw new SetupError('CONFIG_DRIFT', 'فایل‌های Codex بعد از آخرین تنظیم تغییر کرده‌اند؛ برای جلوگیری از overwrite، ابتدا آن‌ها را بررسی کنید.');
        }

        const validToken = this.resolveToken(token, state, paths);
        const models = await this.client.listResponsesModels(validToken);
        this.assertMutationAllowed();
        const selected = models.find(model => model.id === modelId);
        if (!selected) {
            throw new SetupError('MODEL_NOT_AUTHORIZED', 'مدل انتخاب‌شده دیگر در catalog معتبر نیست؛ فهرست مدل‌ها را refresh کنید.');
        }

        const configSnapshot = readSnapshot(paths.configPath);
        const envSnapshot = readSnapshot(paths.envPath);
        const authSnapshot = readSnapshot(paths.authPath);
        const manifestSnapshot = readSnapshot(paths.manifestPath);
        const existingConfig = configSnapshot.exists ? configSnapshot.content.toString('utf8') : '';
        const existingEnv = envSnapshot.exists ? envSnapshot.content.toString('utf8') : '';
        const nextConfig = mergeConfigToml(existingConfig, selected.id);
        const nextEnv = upsertEnv(existingEnv, validToken);
        const existingManifest = readManifest(paths);
        const existingActiveManifest = existingManifest?.active ? existingManifest : undefined;
        const activeManifestBeforeMatchesCurrent = existingActiveManifest
            ? summariesEqual(snapshotSummary(configSnapshot), existingActiveManifest.before?.config)
                && summariesEqual(snapshotSummary(envSnapshot), existingActiveManifest.before?.env)
            : false;
        // If the user manually returned to a non-TensorGrid provider, the old
        // manifest is no longer authoritative unless the files still match its
        // exact pre-TensorGrid snapshot. In that case create a fresh origin
        // backup so Revert returns to what the user has now chosen.
        const reusableActiveManifest = existingActiveManifest
            && (state.provider === CODEX_PROVIDER_NAME || activeManifestBeforeMatchesCurrent)
            ? existingActiveManifest
            : undefined;
        const legacyManifest = !existingActiveManifest && state.provider === CODEX_PROVIDER_NAME
            ? findLegacyBackup(paths)
            : undefined;
        let originBackupDir = reusableActiveManifest
            ? path.join(paths.backupRoot, reusableActiveManifest.backupDir)
            : legacyManifest ? path.join(paths.backupRoot, legacyManifest.backupDir) : undefined;
        let createdBackupDir;

        if (!originBackupDir && state.provider !== CODEX_PROVIDER_NAME) {
            createdBackupDir = makeBackupDirectory(paths.backupRoot);
            originBackupDir = createdBackupDir;
        }

        try {
            if (createdBackupDir) {
                if (configSnapshot.exists) {
                    await backupFile(paths.configPath, path.join(createdBackupDir, 'config.toml'), this.secureFile);
                }
                if (envSnapshot.exists) {
                    await backupFile(paths.envPath, path.join(createdBackupDir, '.env'), this.secureFile);
                }
            }

            if (existingConfig !== nextConfig) {
                await writeTextAtomic(paths.configPath, nextConfig);
            }

            if (existingEnv !== nextEnv) {
                await writeTextAtomic(paths.envPath, nextEnv, { prepareTemp: this.secureFile });
            } else if (envSnapshot.exists) {
                await this.secureFile(paths.envPath);
            }

            this.verifyConfig(paths.configPath, selected.id);
            this.verifyEnv(paths.envPath, nextEnv);
            this.verifyAuthUnchanged(paths.authPath, authSnapshot);

            if (originBackupDir) {
                const manifestBeforeSnapshots = createdBackupDir
                    ? {
                        config: readSnapshot(path.join(createdBackupDir, 'config.toml')),
                        env: readSnapshot(path.join(createdBackupDir, '.env'))
                    }
                    : legacyManifest
                        ? {
                            config: readBackupSnapshot(paths, legacyManifest, 'config.toml'),
                            env: readBackupSnapshot(paths, legacyManifest, '.env')
                        }
                        : {
                            config: configSnapshot,
                            env: envSnapshot
                        };
                await writeManifest(paths, buildManifest(paths, originBackupDir, {
                    config: manifestBeforeSnapshots.config,
                    env: manifestBeforeSnapshots.env
                }, reusableActiveManifest || legacyManifest));
            }
        } catch (error) {
            await rollbackFile(paths.configPath, configSnapshot).catch(() => undefined);
            await rollbackFile(paths.envPath, envSnapshot, { secure: true, secureFile: this.secureFile }).catch(() => undefined);
            await rollbackFile(paths.manifestPath, manifestSnapshot).catch(() => undefined);
            throw mapWriteError(error);
        }

        return {
            provider: CODEX_PROVIDER_NAME,
            baseUrl: CODEX_BASE_URL,
            envKey: CODEX_ENV_KEY,
            modelId: selected.id,
            modelName: selected.name,
            configPath: paths.configPath,
            envPath: paths.envPath,
            backupDir: originBackupDir,
            restartRequired: true
        };
    }

    async revert({ allowDrift = false } = {}) {
        this.assertMutationAllowed();

        const paths = this.resolvePaths();
        const state = this.getState();
        const manifest = activeManifestOrLegacy(paths, state);
        if (!manifest) {
            throw new SetupError('REVERT_UNAVAILABLE', 'نسخه قبلی تنظیمات TensorGrid پیدا نشد.');
        }
        if (state.provider !== CODEX_PROVIDER_NAME || !state.tensorgridConfigured) {
            throw new SetupError('CONFIG_DRIFT', 'تنظیمات فعلی دیگر با وضعیت TensorGrid هماهنگ نیست؛ revert متوقف شد.');
        }

        const configSnapshot = readSnapshot(paths.configPath);
        const envSnapshot = readSnapshot(paths.envPath);
        const authSnapshot = readSnapshot(paths.authPath);
        const manifestSnapshot = readSnapshot(paths.manifestPath);

        if (!allowDrift && manifest.after && (
            !summariesEqual(snapshotSummary(configSnapshot), manifest.after.config)
            || !summariesEqual(snapshotSummary(envSnapshot), manifest.after.env)
        )) {
            throw new SetupError('CONFIG_DRIFT', 'فایل‌های Codex بعد از فعال‌سازی تغییر کرده‌اند؛ برای جلوگیری از overwrite، revert متوقف شد.');
        }

        const originalConfig = readBackupSnapshot(paths, manifest, 'config.toml');
        const originalEnv = readBackupSnapshot(paths, manifest, '.env');
        const backupDir = makeBackupDirectory(paths.backupRoot, 'tensorgrid-codex-revert');

        try {
            if (configSnapshot.exists) {
                await backupFile(paths.configPath, path.join(backupDir, 'config.toml'), this.secureFile);
            }
            if (envSnapshot.exists) {
                await backupFile(paths.envPath, path.join(backupDir, '.env'), this.secureFile);
            }

            await restoreSnapshot(paths.configPath, originalConfig);
            await restoreSnapshot(paths.envPath, originalEnv, { secure: true, secureFile: this.secureFile });

            const restoredConfig = readSnapshot(paths.configPath);
            const restoredEnv = readSnapshot(paths.envPath);
            if (!sameSnapshot(restoredConfig, originalConfig) || !sameSnapshot(restoredEnv, originalEnv)) {
                throw new SetupError('VERIFY_FAILED', 'تنظیمات قبلی بعد از revert قابل تأیید نیست.');
            }
            this.verifyAuthUnchanged(paths.authPath, authSnapshot);

            await writeManifest(paths, {
                schemaVersion: 1,
                active: false,
                backupDir: manifest.backupDir,
                createdAt: manifest.createdAt || new Date().toISOString(),
                revertedAt: new Date().toISOString(),
                lastRevertBackupDir: path.basename(backupDir)
            });
        } catch (error) {
            await rollbackFile(paths.configPath, configSnapshot).catch(() => undefined);
            await rollbackFile(paths.envPath, envSnapshot, { secure: true, secureFile: this.secureFile }).catch(() => undefined);
            await rollbackFile(paths.manifestPath, manifestSnapshot).catch(() => undefined);
            throw mapWriteError(error);
        }

        return {
            provider: 'chatgpt',
            configPath: paths.configPath,
            envPath: paths.envPath,
            backupDir,
            restartRequired: true
        };
    }

    verifyConfig(configPath, modelId) {
        const parsed = parseConfig(fs.readFileSync(configPath, 'utf8'));
        if (parsed.model !== modelId || parsed.model_provider !== CODEX_PROVIDER_NAME) {
            throw new SetupError('VERIFY_FAILED', 'مقدار config.toml بعد از ذخیره قابل تأیید نیست.');
        }
        if (parsed.model_providers?.[CODEX_PROVIDER_NAME]?.env_key !== CODEX_ENV_KEY) {
            throw new SetupError('VERIFY_FAILED', 'provider TensorGrid بعد از ذخیره قابل تأیید نیست.');
        }
    }

    verifyEnv(envPath, expectedContent) {
        const content = fs.readFileSync(envPath, 'utf8');
        if (!readEnvValue(content) || content !== expectedContent) {
            throw new SetupError('VERIFY_FAILED', 'توکن در فایل env بعد از ذخیره قابل تأیید نیست.');
        }
    }

    verifyAuthUnchanged(authPath, snapshot) {
        const after = readSnapshot(authPath);
        if (snapshot.exists !== after.exists || (snapshot.exists && (
            !sameBytes(snapshot.content, after.content) || snapshot.mtimeMs !== after.mtimeMs
        ))) {
            throw new SetupError('AUTH_CHANGED', 'auth.json در زمان نصب تغییر کرد؛ برای امنیت rollback انجام شد.');
        }
    }
}

module.exports = {
    InstallService,
    pathsFor,
    readSnapshot,
    writeTextAtomic,
    envContainsKey: content => Boolean(readEnvValue(content))
};
