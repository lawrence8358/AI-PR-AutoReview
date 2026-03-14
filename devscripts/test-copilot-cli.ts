#!/usr/bin/env node

/**
 * GitHub Copilot CLI 診斷工具
 *
 * 用途：逐步驗證 CLI 路徑解析、binary 可執行性及 SDK 基本連線
 * 使用方式：
 *   npm run devscripts:test-copilot
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';

const GITHUB_TOKEN = process.env.GitHubCopilotToken?.trim() ?? '';
const SERVER_ADDRESS = process.env.GitHubCopilotServerAddress?.trim() ?? '';
const CLI_PATH_OVERRIDE = process.env.COPILOT_CLI_PATH?.trim() ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function separator(title: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Environment info
// ─────────────────────────────────────────────────────────────────────────────

separator('STEP 1: Environment');
console.log(`Node.js    : ${process.version}`);
console.log(`Platform   : ${process.platform}-${process.arch}`);
console.log(`CWD        : ${process.cwd()}`);
console.log(`node.exe   : ${process.execPath}`);
console.log(`Token set  : ${GITHUB_TOKEN ? 'YES (' + GITHUB_TOKEN.substring(0, 8) + '...)' : 'NO'}`);
console.log(`Server addr: ${SERVER_ADDRESS || '(not set)'}`);
console.log(`CLI override: ${CLI_PATH_OVERRIDE || '(not set)'}`);

// Token format check — now, before wasting time on CLI path resolution
if (GITHUB_TOKEN) {
    const validPrefixes = ['github_pat_', 'gho_', 'ghu_'];
    const matchedPrefix = validPrefixes.find(p => GITHUB_TOKEN.startsWith(p));
    if (matchedPrefix) {
        console.log(`Token format: ✅ Valid GitHub token (prefix: ${matchedPrefix})`);
    } else {
        console.error(`Token format: ❌ INVALID — token starts with "${GITHUB_TOKEN.substring(0, 12)}..."`);
        console.error(`   Valid GitHub token prefixes: github_pat_ (Fine-grained PAT), gho_ (OAuth), ghu_ (user-to-server)`);
        console.error(`   ⛔ This is NOT a GitHub token. Check your GitHubCopilotToken env var.`);
        console.error(`   Common mistake: passing an Azure DevOps PAT or other token instead of a GitHub token.`);
        process.exit(1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: CLI path resolution (mirrors resolveCopilotCliPath in the service)
// ─────────────────────────────────────────────────────────────────────────────

separator('STEP 2: CLI Path Resolution');

function resolveCopilotCliPath(): string {
    const platformPkg = `@github/copilot-${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';

    // 1. Explicit override
    if (CLI_PATH_OVERRIDE) {
        console.log(`[1] CLI_PATH_OVERRIDE = ${CLI_PATH_OVERRIDE}`);
        if (fs.existsSync(CLI_PATH_OVERRIDE)) {
            console.log(`    ✅ File exists`);
            return CLI_PATH_OVERRIDE;
        }
        console.log(`    ❌ File NOT found, falling back`);
    } else {
        console.log(`[1] No explicit override`);
    }

    // 2. Local node_modules
    console.log(`[2] require.resolve('${platformPkg}') from CWD...`);
    try {
        const binaryPath = require.resolve(platformPkg);
        if (fs.existsSync(binaryPath)) {
            console.log(`    ✅ Found: ${binaryPath}`);
            return binaryPath;
        }
        console.log(`    ⚠️  resolve succeeded but file missing: ${binaryPath}`);
    } catch (e: any) {
        console.log(`    ❌ Not found in local node_modules: ${e.message.split('\n')[0]}`);
    }

    // 3. Global npm (via node.exe dir + npm config get prefix)
    console.log(`[3] Searching global npm node_modules...`);
    const globalPrefixCandidates: string[] = [];

    const nodeDir = path.dirname(process.execPath);
    globalPrefixCandidates.push(nodeDir);
    console.log(`    3a. node.exe dir: ${nodeDir}`);

    try {
        const npmPrefix = execSync('npm config get prefix', {
            encoding: 'utf8', timeout: 8000, stdio: ['pipe', 'pipe', 'pipe'], shell: true
        }).trim();
        console.log(`    3b. npm config get prefix: ${npmPrefix}`);
        if (npmPrefix && npmPrefix !== nodeDir) {
            globalPrefixCandidates.push(npmPrefix);
        }
    } catch (e: any) {
        console.log(`    3b. npm config get prefix FAILED: ${e.message.split('\n')[0]}`);
    }

    for (const prefix of globalPrefixCandidates) {
        // 3-flat: npm v7+ hoist -> {prefix}/node_modules/@github/copilot-win32-x64/copilot.exe
        const flatPath = path.join(prefix, 'node_modules', '@github', `copilot-${process.platform}-${process.arch}`, binaryName);
        const flatExists = fs.existsSync(flatPath);
        console.log(`    [flat]   ${flatPath} → ${flatExists ? '✅ EXISTS' : '❌ not found'}`);
        if (flatExists) return flatPath;

        // 3-nested: npm may keep optional dep inside its parent package's own node_modules
        // {prefix}/node_modules/@github/copilot/node_modules/@github/copilot-win32-x64/copilot.exe
        const nestedPath = path.join(prefix, 'node_modules', '@github', 'copilot', 'node_modules', '@github', `copilot-${process.platform}-${process.arch}`, binaryName);
        const nestedExists = fs.existsSync(nestedPath);
        console.log(`    [nested] ${nestedPath} → ${nestedExists ? '✅ EXISTS' : '❌ not found'}`);
        if (nestedExists) return nestedPath;
    }

    // print full directory listing to help diagnose
    for (const prefix of globalPrefixCandidates) {
        const githubDir = path.join(prefix, 'node_modules', '@github');
        if (fs.existsSync(githubDir)) {
            const entries = fs.readdirSync(githubDir);
            console.log(`    @github packages in ${githubDir}: ${entries.join(', ') || '(empty)'}`);
            // check nested too
            const copilotNested = path.join(githubDir, 'copilot', 'node_modules', '@github');
            if (fs.existsSync(copilotNested)) {
                const nested = fs.readdirSync(copilotNested);
                console.log(`    @github nested in ${copilotNested}: ${nested.join(', ') || '(empty)'}`);
            }
        } else {
            console.log(`    ${githubDir} → directory does not exist`);
        }
    }

    // 4. System PATH (where/which) — last resort, may find shim on Windows
    //    ⚠️  Windows: 'where copilot' finds the bash shell script (no ext), NOT the .exe
    //    The shim CANNOT be spawned by Node.js spawnSync without shell:true
    //    → only accept .exe files on Windows
    console.log(`[4] Searching system PATH via ${process.platform === 'win32' ? 'where' : 'which'}...`);
    try {
        const cmd = process.platform === 'win32' ? 'where' : 'which';
        const result = spawnSync(cmd, ['copilot'], { encoding: 'utf8', timeout: 5000 });
        if (!result.error) {
            const allResults = result.stdout.trim().split(/\r?\n/).filter(Boolean);
            console.log(`    All PATH results: ${allResults.join(', ') || '(none)'}`);
            for (const candidate of allResults) {
                if (!fs.existsSync(candidate)) continue;
                if (process.platform === 'win32' && !candidate.toLowerCase().endsWith('.exe')) {
                    console.log(`    ⚠️  Skipping ${candidate} — bash/cmd shim, not a native .exe (spawnSync would fail with ENOENT)`);
                    continue;
                }
                console.log(`    ✅ Using: ${candidate}`);
                return candidate;
            }
        } else {
            console.log(`    ❌ ${result.error.message}`);
        }
    } catch {
        // ignore
    }

    throw new Error(
        'Copilot CLI native binary not found.\n' +
        '  Options:\n' +
        '  1. Set COPILOT_CLI_PATH to the full path of copilot.exe\n' +
        '  2. npm install -g @github/copilot-win32-x64  (installs binary directly)\n' +
        '  3. npm install -g @github/copilot             (should install binary as optional dep)\n' +
        '     then verify: dir C:\\<npm-prefix>\\node_modules\\@github\\'
    );
}

let cliPath: string;
try {
    cliPath = resolveCopilotCliPath();
    console.log(`\n➡  Using CLI: ${cliPath}`);
} catch (e: any) {
    console.error(`\n💥 ${e.message}`);
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Verify binary is executable
// ─────────────────────────────────────────────────────────────────────────────

separator('STEP 3: Binary Execution Test');

const versionResult = spawnSync(cliPath, ['--version'], {
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
});

if (versionResult.error) {
    console.error(`❌ Failed to spawn CLI: ${versionResult.error.message}`);
    console.error(`   This means the file exists but cannot be executed.`);
    console.error(`   On Linux/macOS: check execute permission (chmod +x)`);
} else {
    console.log(`Exit code : ${versionResult.status}`);
    console.log(`stdout    : ${versionResult.stdout.trim() || '(empty)'}`);
    console.log(`stderr    : ${versionResult.stderr.trim() || '(empty)'}`);

    if (versionResult.status === 0) {
        console.log(`✅ CLI binary is executable and responding`);
    } else {
        console.warn(`⚠️  CLI exited with non-zero code ${versionResult.status}`);
        console.warn(`   If stdout/stderr is empty, this may be a CMD shim (not native binary).`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 + 5: Network check & SDK test (async)
// ─────────────────────────────────────────────────────────────────────────────

async function main() {

separator('STEP 4: Network Connectivity Check');

await new Promise<void>((resolve) => {
    const https = require('node:https');
    const targets = [
        { host: 'api.github.com', path: '/' },
        { host: 'copilot-proxy.githubusercontent.com', path: '/' },
    ];
    let done = 0;
    const finish = () => { if (++done === targets.length) resolve(); };
    for (const t of targets) {
        const req = https.request({ host: t.host, path: t.path, method: 'HEAD', timeout: 8000 }, (res: any) => {
            console.log(`  ${t.host} → HTTP ${res.statusCode} ✅`);
            res.resume(); // drain response
            finish();
        });
        req.on('timeout', () => { req.destroy(new Error('timeout')); });
        req.on('error', (e: any) => {
            const msg = e.message === 'timeout' ? '⏱️  TIMEOUT (8s)' : `❌ ${e.message}`;
            console.log(`  ${t.host} → ${msg}`);
            finish();
        });
        req.end();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: SDK connectivity test
// ─────────────────────────────────────────────────────────────────────────────

separator('STEP 5: SDK Connectivity Test');

console.log('Loading @github/copilot-sdk...');
const { CopilotClient, approveAll } = await import('@github/copilot-sdk');

let client: any;

if (GITHUB_TOKEN) {
    console.log(`Mode: Token auth (${GITHUB_TOKEN.substring(0, 8)}...)`);
    console.log(`CLI : ${cliPath}`);
    client = new CopilotClient({
        githubToken: GITHUB_TOKEN,
        useLoggedInUser: false,
        cliPath,
    });
} else if (SERVER_ADDRESS) {
    console.log(`Mode: Remote CLI Server (${SERVER_ADDRESS})`);
    client = new CopilotClient({ cliUrl: SERVER_ADDRESS });
} else {
    console.log(`Mode: Local CLI agent`);
    console.log(`CLI : ${cliPath}`);
    client = new CopilotClient({ cliPath });
}

// Register client-level events to trace what happens before session.idle
for (const evt of ['connected', 'disconnected', 'error', 'cli.started', 'cli.exited']) {
    client.on?.(evt, (data: any) => console.log(`  [client event] ${evt}:`, JSON.stringify(data ?? '').substring(0, 200)));
}

console.log('Creating session (timeout: 60s)...');
console.log('  Watching for session events...');

const sessionPromise = client.createSession({
    model: 'gpt-4o-mini',
    streaming: false,
    systemMessage: { content: 'You are a helpful assistant. Reply concisely.' },
    onPermissionRequest: approveAll,
});

// Progress ticker so we can see the script is still alive during wait
const ticker = setInterval(() => process.stdout.write('.'), 3000);
let session: any;
try {
    session = await Promise.race([
        sessionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('createSession timed out after 60s — CLI likely cannot authenticate with the provided token')), 60000))
    ]);
} finally {
    clearInterval(ticker);
    console.log();
}

console.log('Session created ✅  Sending test prompt...');
const response = await session.sendAndWait({ prompt: 'Reply with exactly: OK' }, 30000);

console.log(`\n✅ SDK response received:`);
console.log(`   content: ${response?.data?.content ?? JSON.stringify(response)}`);

await session.destroy();
await client.stop();
process.exit(0);
} // end main()

main().catch((e: any) => {
    console.error(`\n❌ Failed: ${e.message}`);
    if (e.stack) console.error(e.stack);
    process.exit(1);
});
