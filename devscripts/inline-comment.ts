#!/usr/bin/env node

/**
 * 整合測試腳本：行內評論（精準行號標註）功能
 *
 * 測試完整流程：
 *   1. 取得 PR 變更
 *   2. 以 JSON 格式系統指令呼叫 AI
 *   3. 解析回傳的 InlineReviewResult JSON
 *   4. 發佈摘要評論 + 行內標註評論至 PR
 *
 * 使用方式（Azure DevOps）:
 *   npx ts-node devscripts/inline-comment.ts --provider azure --pr 123 --ai claude
 *
 * 使用方式（GitHub）:
 *   npx ts-node devscripts/inline-comment.ts --provider github --owner USER --repo REPO --pr 456 --ai openai
 *
 * 加上 --dry-run 只印出解析結果，不發佈評論
 */

import { AIProviderService } from '../src/services/ai-provider.service';
import { DevOpsProviderService } from '../src/services/devops-provider.service';
import { parseInlineReviewResult, addInlineReviewComments } from '../src/services/inline-review.service';
import { DevOpsConnection } from '../src/interfaces/pipeline-inputs.interface';
import { AI_PROVIDERS, AI_PROVIDER_DISPLAY_NAMES, DEFAULT_MODELS, API_KEY_ENV_MAP, buildInlineJsonAppend } from '../src/constants';

interface InlineTestOptions {
    provider: 'azure' | 'github';
    prId: number;
    aiProvider: string;
    modelName: string;
    modelKey: string;
    githubToken?: string;
    serverAddress?: string;
    timeout?: number;
    organizationUrl?: string;
    projectName?: string;
    repositoryId?: string;
    accessToken?: string;
    owner?: string;
    repo?: string;
    dryRun: boolean;
}

function normalizeProvider(p: string): string {
    const lower = p.toLowerCase();
    const map: Record<string, string> = {
        [AI_PROVIDERS.CLAUDE]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.CLAUDE],
        [AI_PROVIDERS.OPENAI]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.OPENAI],
        [AI_PROVIDERS.GROK]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GROK],
        [AI_PROVIDERS.GOOGLE]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GOOGLE],
        [AI_PROVIDERS.GITHUB_COPILOT]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GITHUB_COPILOT],
        'copilot': AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GITHUB_COPILOT]
    };
    return map[lower] ?? p;
}

function getKeyFromEnv(provider: string): string {
    // provider 可能是 display name（如 'Claude (Anthropic)'）或 internal key（如 'claude'）
    // 先從 AI_PROVIDER_DISPLAY_NAMES 反查 internal key，找不到才直接 toLowerCase
    const internalKey = Object.entries(AI_PROVIDER_DISPLAY_NAMES)
        .find(([, display]) => display === provider)?.[0]
        ?? provider.toLowerCase();
    const envKey = API_KEY_ENV_MAP[internalKey];
    return envKey ? process.env[envKey] ?? '' : '';
}

function parseArgs(args: string[]): InlineTestOptions {
    const opts: any = {
        provider: 'azure',
        aiProvider: normalizeProvider(process.env.AiProvider ?? 'Claude'),
        modelName: '',
        modelKey: '',
        dryRun: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const val = args[i + 1];
        switch (arg) {
            case '--provider':       opts.provider = val; i++; break;
            case '--pr':             opts.prId = parseInt(val); i++; break;
            case '--ai':             opts.aiProvider = normalizeProvider(val); i++; break;
            case '--model':          opts.modelName = val; i++; break;
            case '--key':            opts.modelKey = val; i++; break;
            case '--github-token':   opts.githubToken = val; i++; break;
            case '--server-address': opts.serverAddress = val; i++; break;
            case '--timeout':        opts.timeout = parseInt(val); i++; break;
            case '--org':            opts.organizationUrl = val; i++; break;
            case '--project':        opts.projectName = val; i++; break;
            case '--repo-id':        opts.repositoryId = val; i++; break;
            case '--token':          opts.accessToken = val; i++; break;
            case '--owner':          opts.owner = val; i++; break;
            case '--repo':           opts.repo = val; i++; break;
            case '--dry-run':        opts.dryRun = true; break;
            case '--help':           printHelp(); process.exit(0); break;
        }
    }

    // 從 .env 補齊 DevOps 連線資訊
    opts.organizationUrl = opts.organizationUrl ?? process.env.DevOpsOrgUrl ?? '';
    opts.projectName     = opts.projectName     ?? process.env.DevOpsProjectName ?? '';
    opts.repositoryId    = opts.repositoryId    ?? process.env.DevOpsRepositoryId ?? '';
    opts.accessToken     = opts.accessToken     ?? process.env.DevOpsAccessToken ?? '';
    opts.prId            = opts.prId            ?? parseInt(process.env.DevOpsPRId ?? '0');

    if (!opts.prId) {
        console.error('❌ PR ID is required (--pr or DevOpsPRId in .env)');
        printHelp();
        process.exit(1);
    }

    const aiLower = opts.aiProvider.toLowerCase();
    if (aiLower === AI_PROVIDERS.GITHUB_COPILOT) {
        opts.githubToken   = opts.githubToken   ?? process.env.GitHubCopilotToken ?? '';
        opts.serverAddress = opts.serverAddress ?? process.env.GitHubCopilotServerAddress ?? '';
        opts.modelKey = '';
    } else {
        if (!opts.modelKey) opts.modelKey = getKeyFromEnv(opts.aiProvider);
        if (!opts.modelKey) {
            console.error(`❌ API key is required for ${opts.aiProvider}`);
            process.exit(1);
        }
    }

    if (!opts.modelName) {
        opts.modelName = process.env.ModelName ?? DEFAULT_MODELS[aiLower] ?? '';
    }

    return opts as InlineTestOptions;
}

function printHelp() {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║   inline-comment.ts — Inline Annotation Integration Test          ║
╚═══════════════════════════════════════════════════════════════════╝

用法:
  npx ts-node devscripts/inline-comment.ts [選項]

必要參數:
  --pr <ID>              Pull Request ID（或在 .env 設 DevOpsPRId）

DevOps 提供者:
  --provider <azure|github>   (預設 azure)
  Azure:  --org <URL> --project <NAME> --repo-id <ID> --token <PAT>
  GitHub: --owner <USER> --repo <NAME> --token <PAT>

AI 提供者:
  --ai <claude|openai|grok|google|githubcopilot>  (預設 claude)
  --model <NAME>   模型名稱（預設從 DEFAULT_MODELS 取得）
  --key <KEY>      API Key（或從 .env 讀取）

其他:
  --dry-run   解析 JSON 但不發佈評論
  --help      顯示此說明

範例:
  # Dry-run：只驗證 AI 是否回傳正確 JSON
  npx ts-node devscripts/inline-comment.ts --pr 123 --ai claude --dry-run

  # 實際發佈行內評論
  npx ts-node devscripts/inline-comment.ts --pr 123 --ai openai

  # GitHub PR
  npx ts-node devscripts/inline-comment.ts --provider github --owner myuser --repo myrepo --pr 456 --ai claude
`);
}

async function run() {
    const opts = parseArgs(process.argv.slice(2));

    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║         Inline Comment Integration Test                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log(`  Provider : ${opts.provider.toUpperCase()}`);
    console.log(`  PR ID    : ${opts.prId}`);
    console.log(`  AI       : ${opts.aiProvider} / ${opts.modelName}`);
    console.log(`  Dry Run  : ${opts.dryRun ? '✓ (no comments will be posted)' : '✗ (comments WILL be posted to the PR)'}`);
    console.log('');

    // 初始化 AI 服務
    const aiProvider = new AIProviderService();
    aiProvider.registerService(opts.aiProvider, {
        apiKey: opts.modelKey,
        modelName: opts.modelName,
        githubToken: opts.githubToken,
        serverAddress: opts.serverAddress,
        timeout: opts.timeout
    });

    // 初始化 DevOps 服務
    const devOpsProvider = new DevOpsProviderService();
    const devOpsProviderName = opts.provider === 'azure' ? 'Azure' : 'GitHub';
    devOpsProvider.registerService(devOpsProviderName, {
        accessToken: opts.accessToken!,
        organizationUrl: opts.organizationUrl ?? (opts.owner ? `https://github.com/${opts.owner}/` : undefined)
    });
    const devOpsService = devOpsProvider.getService(devOpsProviderName);

    const repositoryId = opts.provider === 'azure'
        ? opts.repositoryId!
        : `${opts.owner}/${opts.repo}`;

    const connection: DevOpsConnection = {
        accessToken: opts.accessToken!,
        collectionUri: opts.organizationUrl ?? `https://github.com/${opts.owner}/`,
        projectName: opts.projectName ?? opts.owner ?? '',
        repositoryId,
        pullRequestId: opts.prId
    };

    // 取得 PR 變更
    console.log('🔍 Fetching PR changes...');
    const changes = await devOpsService.getPullRequestChanges(
        connection.projectName,
        repositoryId,
        opts.prId,
        [], [], true, false
    );

    if (!changes || changes.length === 0) {
        console.log('⚠️ No code changes found. Exiting.');
        return;
    }
    console.log(`✅ Found ${changes.length} file(s)\n`);

    // 組合 prompt
    const codeChanges = changes
        .map(c => `\n## File: ${c.path}\n\`\`\`\n${c.content}\n\`\`\``)
        .join('\n');

    // 讀取使用者自訂 SystemInstruction（與一般模式相同），附加 JSON 格式需求
    const baseInstruction = (process.env.SystemInstruction ?? '').replaceAll(String.raw`\n`, '\n').trim();
    const strictMode = (process.env.InlineStrictMode ?? 'false').toLowerCase() === 'true';
    const systemInstruction = (baseInstruction || 'You are a senior software engineer. Please help complete the PR code review.') + buildInlineJsonAppend(strictMode);
    console.log('🤖 Calling AI (inline JSON mode, JSON format requirement appended)...');
    const aiService = aiProvider.getService(opts.aiProvider);
    const aiResponse = await aiService.generateComment(
        systemInstruction,
        codeChanges,
        {
            maxOutputTokens: parseInt(process.env.MaxOutputTokens ?? '8192'),
            temperature: parseFloat(process.env.Temperature ?? '1.0'),
            showReviewContent: (process.env.ShowReviewContent ?? 'true').toLowerCase() === 'true'
        }
    );

    console.log('\n' + '='.repeat(70));
    console.log('📄 Raw AI Response:');
    console.log('='.repeat(70));
    console.log(aiResponse.content);
    console.log('='.repeat(70) + '\n');

    // 解析 JSON
    const inlineResult = parseInlineReviewResult(aiResponse.content);
    if (!inlineResult) {
        console.error('❌ Failed to parse inline review JSON. Check AI response above.');
        process.exit(1);
    }

    console.log('✅ JSON parsed successfully:');
    console.log(`   Status     : ${inlineResult.summary.status}`);
    console.log(`   Conclusion : ${inlineResult.summary.conclusion}`);
    console.log(`   Issues     : ${inlineResult.issues.length}`);
    for (const [i, issue] of inlineResult.issues.entries()) {
        const emoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : '💡';
        const desc = issue.description.length > 60 ? issue.description.slice(0, 60) + '...' : issue.description;
        console.log(`   [${i + 1}] ${emoji} ${issue.file}:${issue.lineStart}-${issue.lineEnd} [${issue.category}] ${desc}`);
    }

    if (opts.dryRun) {
        console.log('\n🟡 Dry-run mode: no comments posted.');
        return;
    }

    // 發佈摘要 + 行內評論
    const groupByFile = (process.env.GroupInlineCommentsByFile ?? 'true').toLowerCase() !== 'false';
    console.log(`\n📌 Posting summary + inline comments... (groupByFile=${groupByFile}, strictMode=${strictMode})`);
    await addInlineReviewComments(
        devOpsService,
        connection,
        inlineResult,
        opts.aiProvider,
        opts.modelName,
        groupByFile,
        strictMode
    );

    console.log('\n🎉 Done!');
}

run().catch(err => {
    console.error('Fatal error:', err.message ?? err);
    process.exit(1);
});
