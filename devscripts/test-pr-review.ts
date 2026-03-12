#!/usr/bin/env node

/// <reference types="node" />

/**
 * 測試/驗證工具: 指定 DevOps PR ID 進行代碼審查功能測試
 *
 * 使用方式:
 *   npx ts-node DEVSCRIPTS/test-pr-review.ts --provider azure --pr 123 --ai claude
 *   npx ts-node DEVSCRIPTS/test-pr-review.ts --provider github --owner USER --repo REPO --pr 456 --ai openai
 */

import * as fs from 'fs';
import * as path from 'path';
import { Main } from '../src/index';
import { AIProviderService } from '../src/services/ai-provider.service';
import { DevOpsProviderService } from '../src/services/devops-provider.service';
import { AI_PROVIDERS, AI_PROVIDER_DISPLAY_NAMES } from '../src/constants';

interface TestOptions {
    provider: 'azure' | 'github';
    prId: number;
    aiProvider: string;
    modelName: string;
    modelKey: string;
    // For GitHub Copilot
    githubToken?: string;
    serverAddress?: string;
    timeout?: number;
    // For Azure DevOps
    organizationUrl?: string;
    projectName?: string;
    repositoryId?: string;
    accessToken?: string;
    // For GitHub
    owner?: string;
    repo?: string;
    // Feature flags
    enableIncrementalDiff: boolean;
    enableThrottleMode: boolean;
    showReviewContent: boolean;
}

class PRReviewTester {
    private options: TestOptions;
    private main: Main;

    constructor(options: TestOptions) {
        this.options = options;
        this.main = new Main(true); // Debug mode
    }

    /**
     * 解析命令行參數
     */
    static parseArgs(args: string[]): TestOptions {
        const options: any = {
            provider: 'azure',
            enableIncrementalDiff: false,
            enableThrottleMode: true,
            showReviewContent: true,
            aiProvider: 'Claude',
            modelName: 'claude-haiku-4-5',
            modelKey: ''
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const value = args[i + 1];

            switch (arg) {
                // 指定 DevOps 提供者 (azure 或 github)
                case '--provider':
                    options.provider = value;
                    i++;
                    break;
                // 指定 Pull Request ID (必需)
                case '--pr':
                    options.prId = parseInt(value);
                    i++;
                    break;
                // 指定 AI 提供者 (claude、openai、grok、google)
                case '--ai':
                    options.aiProvider = this.normalizeProvider(value);
                    i++;
                    break;
                // 指定 AI 模型名稱
                case '--model':
                    options.modelName = value;
                    i++;
                    break;
                // 指定 AI API 金鑰
                case '--key':
                    options.modelKey = value;
                    i++;
                    break;
                // 指定 GitHub Token (用於 GitHub Copilot Token 認證模式)
                case '--github-token':
                    options.githubToken = value;
                    i++;
                    break;
                // 指定 GitHub Copilot CLI Server 位址
                case '--server-address':
                    options.serverAddress = value;
                    i++;
                    break;
                // 指定 GitHub Copilot 請求超時時間 (毫秒)
                case '--timeout':
                    options.timeout = parseInt(value);
                    i++;
                    break;
                // 指定 Azure DevOps 組織 URL
                case '--org':
                    options.organizationUrl = value;
                    i++;
                    break;
                // 指定 Azure DevOps 專案名稱
                case '--project':
                    options.projectName = value;
                    i++;
                    break;
                // 指定 Azure DevOps 儲存庫 ID
                case '--repo-id':
                    options.repositoryId = value;
                    i++;
                    break;
                // 指定 Azure DevOps 個人存取權杖
                case '--token':
                    options.accessToken = value;
                    i++;
                    break;
                // 指定 GitHub 儲存庫所有者
                case '--owner':
                    options.owner = value;
                    i++;
                    break;
                // 指定 GitHub 儲存庫名稱
                case '--repo':
                    options.repo = value;
                    i++;
                    break;
                // 啟用節流模式（僅送差異；false 則送整個檔案）
                case '--throttle':
                    options.enableThrottleMode = value.toLowerCase() === 'true';
                    i++;
                    break;
                // 啟用增量 Diff 模式（僅審查最新推送的變更）
                case '--incremental':
                    options.enableIncrementalDiff = value.toLowerCase() === 'true';
                    i++;
                    break;
                // 啟用詳細日誌輸出
                case '--verbose':
                    options.showReviewContent = value.toLowerCase() === 'true';
                    i++;
                    break;
                // 顯示幫助訊息
                case '--help':
                    this.printHelp();
                    process.exit(0);
                    break;
            }
        }

        if (!options.prId) {
            console.error('❌ Error: PR ID is required (--pr)');
            this.printHelp();
            process.exit(1);
        }

        // GitHub Copilot 不需要 API key，但可以使用 Token 或 serverAddress（擇一）
        if (options.aiProvider.toLowerCase() === AI_PROVIDERS.GITHUB_COPILOT) {
            // 從環境變數讀取 GitHub Token（如果命令列未提供）
            if (!options.githubToken) {
                options.githubToken = process.env.GITHUB_COPILOT_TOKEN || process.env.GitHubCopilotToken || '';
            }
            // 從環境變數讀取 Server Address（如果命令列未提供）
            if (!options.serverAddress) {
                options.serverAddress = process.env.GitHubCopilotServerAddress || '';
            }

            // 參數互斥驗證
            if (options.githubToken && options.githubToken.trim() !== '' &&
                options.serverAddress && options.serverAddress.trim() !== '') {
                console.error('⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式');
                process.exit(1);
            }

            options.modelKey = ''; // GitHub Copilot 不使用 API key
        } else {
            if (!options.modelKey) {
                options.modelKey = this.getKeyFromEnv(options.aiProvider);
                if (!options.modelKey) {
                    console.error(`❌ Error: API key is required for ${options.aiProvider}`);
                    console.log('   Provide via --key or environment variable');
                    process.exit(1);
                }
            }
        }

        return options;
    }

    /**
     * 標準化提供者名稱
     */
    private static normalizeProvider(provider: string): string {
        const providerLower = provider.toLowerCase();
        const map: Record<string, string> = {
            [AI_PROVIDERS.CLAUDE]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.CLAUDE],
            [AI_PROVIDERS.OPENAI]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.OPENAI],
            [AI_PROVIDERS.GROK]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GROK],
            [AI_PROVIDERS.GOOGLE]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GOOGLE],
            [AI_PROVIDERS.GITHUB_COPILOT]: AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GITHUB_COPILOT],
            'copilot': AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GITHUB_COPILOT]
        };
        return map[providerLower] || provider;
    }

    /**
     * 從環境變數取得 API Key
     */
    private static getKeyFromEnv(provider: string): string {
        const keyMap: Record<string, string> = {
            'Claude': 'ANTHROPIC_API_KEY',
            'OpenAI': 'OPENAI_API_KEY',
            'Grok': 'XAI_API_KEY',
            'Google': 'GOOGLE_API_KEY',
            'GitHubCopilot': '' // GitHub Copilot 不需要 API Key
        };

        const envKey = keyMap[provider];
        return envKey ? process.env[envKey] || '' : '';
    }

    /**
     * 打印幫助信息
     */
    private static printHelp(): void {
        console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           AI PR AutoReview - Test/Verification Tool              ║
╚════════════════════════════════════════════════════════════════════╝

用法:
  npx ts-node DEVSCRIPTS/test-pr-review.ts [選項]

必需參數:
  --pr <ID>                 Pull Request ID (必需)
  --provider <TYPE>         DevOps provider: 'azure' 或 'github'
                           (預設: 'azure')

Azure DevOps 參數:
  --org <URL>              Organization URL
  --project <NAME>         Project name
  --repo-id <ID>           Repository ID
  --token <TOKEN>          Personal Access Token

GitHub 參數:
  --owner <USER>           Repository owner
  --repo <NAME>            Repository name

AI 提供者參數:
  --ai <PROVIDER>          'claude', 'openai', 'grok', 'google', 'githubcopilot'
  --model <NAME>           Model name (如: claude-haiku-4-5, gpt-5-mini)
  --key <KEY>              API key (或使用環境變數)
  --github-token <TOKEN>   GitHub Token (用於 GitHub Copilot Token 認證模式)
  --server-address <ADDR>  GitHub Copilot CLI Server 位址 (格式: host:port)

功能開關:
  --throttle <true|false>      啟用節流模式 (預設: true，僅送差異)
  --incremental <true|false>  啟用增量 Diff (預設: false)
  --verbose <true|false>     顯示詳細日誌 (預設: true)

例子:
  # Azure DevOps with Claude
  npx ts-node src/test-pr-review.ts \\
    --provider azure \\
    --pr 123 \\
    --org https://dev.azure.com/yourorg \\
    --project MyProject \\
    --repo-id repo123 \\
    --ai claude \\
    --incremental false

  # GitHub with OpenAI
  npx ts-node src/test-pr-review.ts \\
    --provider github \\
    --pr 456 \\
    --owner myusername \\
    --repo myrepo \\
    --ai openai \\
    --model gpt-4 \\
    --key sk-...

  # 啟用增量 Diff (最新推送變更)
  npx ts-node src/test-pr-review.ts \\
    --pr 123 \\
    --incremental true

  # 顯示幫助
  npx ts-node src/test-pr-review.ts --help
`);
    }

    /**
     * 執行測試
     */
    async run(): Promise<void> {
        console.log('╔════════════════════════════════════════════════════════════════════╗');
        console.log('║         開始 PR 代碼審查測試                                        ║');
        console.log('╚════════════════════════════════════════════════════════════════════╝\n');

        try {
            // 打印配置
            this.printConfiguration();

            // 初始化服務
            console.log('\n🔧 初始化服務...');
            const aiProvider = new AIProviderService();
            aiProvider.registerService(this.options.aiProvider, {
                apiKey: this.options.modelKey,
                modelName: this.options.modelName,
                githubToken: this.options.githubToken,
                serverAddress: this.options.serverAddress,
                timeout: this.options.timeout
            });

            const devOpsProvider = new DevOpsProviderService();
            const providerName = this.options.provider === 'azure' ? 'Azure' : 'GitHub';

            devOpsProvider.registerService(providerName, {
                accessToken: this.options.accessToken!,
                organizationUrl: this.options.organizationUrl || this.options.owner
            });

            const devOpsService = devOpsProvider.getService(providerName);
            const systemInstruction = `You are a senior software engineer. Please help complete the PR code review and respond according to the following instructions.
1. Begin with a summary conclusion of the analysis, for example: AI Review Status: 🟢 Recommend Approval, 🔴 Recommend Rejection, 🟡 Needs Human Review, followed by a brief explanation within 100 characters, then use <hr/> for a line break.
2. Do not include any content unrelated to the code review.
3. Use Traditional Chinese (zh-TW) for the review result. Each issue should be listed as a bullet point. Use the following format: Emoji [Category] : Detailed explanation. Choose from: 🔴 [Critical], ⚠️ [Warning], 💡 [Suggestion], ✨ [Convention], or ❓ [Question].
4. Since each change may involve multiple modified files, mark each file before its corresponding review comments for easy reference.
5. If too many files are modified to analyze them all, limit the total response length to within 15,000 characters.
6. Skip analysis of images, binary files, or other non-code files.
7. Skip analysis of deleted files.
8. Use Markdown format for the reply.
9. Assume the provided code snippets are part of a larger, valid codebase. Do not report errors regarding "unresolved symbols," "missing definitions," or "reference issues" that may exist outside the provided diff. Focus your analysis strictly on the logic and quality of the changes themselves.`;

            // 構建 pipeline inputs
            console.log('\n📋 準備 Pipeline 輸入...');
            const inputs = {
                aiProvider: this.options.aiProvider,
                modelName: this.options.modelName,
                modelKey: this.options.modelKey,
                githubToken: this.options.githubToken,
                serverAddress: this.options.serverAddress,
                timeout: this.options.timeout,
                systemInstruction: systemInstruction,
                promptTemplate: '{code_changes}',
                maxOutputTokens: 4096,
                temperature: 1.0,
                fileExtensions: [],
                binaryExtensions: [],
                showReviewContent: this.options.showReviewContent,
                enableThrottleMode: this.options.enableThrottleMode,
                enableIncrementalDiff: this.options.enableIncrementalDiff
            };

            // 取得 PR 變更
            console.log('\n🔍 取得 PR 變更...');
            const repositoryId = this.options.provider === 'azure'
                ? this.options.repositoryId!
                : `${this.options.owner}/${this.options.repo}`;

            const changes = await devOpsService.getPullRequestChanges(
                this.options.projectName || this.options.owner || 'default',
                repositoryId,
                this.options.prId,
                inputs.fileExtensions,
                inputs.binaryExtensions,
                inputs.enableThrottleMode,
                inputs.enableIncrementalDiff
            );

            if (!changes || changes.length === 0) {
                console.log('⚠️ 沒有找到代碼變更');
                return;
            }

            console.log(`✅ 找到 ${changes.length} 個文件變更`);

            // 生成 AI 審查
            console.log('\n🤖 生成 AI 審查...');
            const reviewContent = await (this.main as any).generateAIReview(aiProvider, inputs, changes);

            // 打印結果
            console.log('\n' + '='.repeat(80));
            console.log('📄 審查結果');
            console.log('='.repeat(80));
            console.log(reviewContent);
            console.log('='.repeat(80));

            console.log('\n✅ 測試完成！');
            process.exit(0);
        } catch (error: any) {
            console.error('\n❌ 錯誤:', error.message);
            if (error.stack) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * 打印配置信息
     */
    private printConfiguration(): void {
        console.log('⚙️  測試配置:');
        console.log(`  • Provider: ${this.options.provider.toUpperCase()}`);
        console.log(`  • PR ID: ${this.options.prId}`);
        console.log(`  • AI Provider: ${this.options.aiProvider}`);
        console.log(`  • Model: ${this.options.modelName}`);
        if (this.options.aiProvider.toLowerCase() === 'githubcopilot') {
            if (this.options.githubToken && this.options.githubToken.trim() !== '') {
                console.log(`  • Authentication: Token`);
            } else if (this.options.serverAddress && this.options.serverAddress.trim() !== '') {
                console.log(`  • CLI Connection: ${this.options.serverAddress}`);
            } else {
                console.log(`  • CLI Connection: local agent`);
            }
        }
        console.log(`  • Throttle Mode: ${this.options.enableThrottleMode ? '✓ Enabled' : '✗ Disabled'}`);
        console.log(`  • Incremental Diff: ${this.options.enableIncrementalDiff ? '✓ Enabled' : '✗ Disabled'}`);
        console.log(`  • Verbose Output: ${this.options.showReviewContent ? '✓ Enabled' : '✗ Disabled'}`);
    }
}

// 主程序
async function main() {
    const args = process.argv.slice(2);
    const options = PRReviewTester.parseArgs(args);
    const tester = new PRReviewTester(options);
    await tester.run();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
