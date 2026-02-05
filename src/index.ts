// import tl = require('azure-pipelines-task-lib/task');
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';
import { PipelineInputs, DevOpsConnection } from './interfaces/pipeline-inputs.interface';
import { AIProviderService } from './services/ai-provider.service';
import { DevOpsProviderService } from './services/devops-provider.service';
import { DevOpsService } from './interfaces/devops-service.interface';


const DEFAULT_SYSTEM_INSTRUCTION = `You are a senior software engineer. Please help complete the PR code review and respond according to the following instructions.
1. Begin with a summary conclusion of the analysis, for example: AI Review Status: 🟢 Recommend Approval, 🔴 Recommend Rejection, 🟡 Needs Human Review, followed by a brief explanation within 100 characters, then use <hr/> for a line break.
2. Do not include any content unrelated to the code review.
3. Use English (en-US) for the review result. Each issue should be listed as a bullet point. Use the following format: Emoji [Category] : Detailed explanation. Choose from: 🔴 [Critical], ⚠️ [Warning], 💡 [Suggestion], ✨ [Convention], or ❓ [Question].
4. Since each change may involve multiple modified files, mark each file before its corresponding review comments for easy reference.
5. If too many files are modified to analyze them all, limit the total response length to within 15,000 characters.
6. Skip analysis of images, binary files, or other non-code files.
7. Skip analysis of deleted files.
8. Use Markdown format for the reply.
9. Assume the provided code snippets are part of a larger, valid codebase. Do not report errors regarding "unresolved symbols," "missing definitions," or "reference issues" that may exist outside the provided diff. Focus your analysis strictly on the logic and quality of the changes themselves.`;

const ALLOWED_FILE_EXTENSIONS = ['.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html'];

export class Main {
    private isDebugMode: boolean;

    constructor(isDebugMode: boolean = false) {
        this.isDebugMode = isDebugMode;
    }

    /**
     * 從檔案載入系統指令
     * @param filePath - 檔案路徑
     * @param fallbackInstruction - 當檔案讀取失敗時的備用指令
     * @returns 系統指令內容
     */
    private loadSystemInstructionFromFile(filePath: string, fallbackInstruction: string): string {
        // 驗證副檔名
        const ext = path.extname(filePath).toLowerCase();
        if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
            console.warn(`⚠️ Warning: System prompt file extension '${ext}' is not strictly supported. Recommended: .md, .txt`);
        }

        // 嘗試讀取檔案
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ System prompt file not found: ${filePath}. Fallback to inline instruction.`);
            return fallbackInstruction;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content && content.trim().length > 0) {
                return content;
            } else {
                console.warn(`⚠️ System prompt file is empty: ${filePath}. Fallback to inline instruction.`);
                return fallbackInstruction;
            }
        } catch (error) {
            console.warn(`⚠️ Failed to read system prompt file: ${filePath}. Fallback to inline instruction. Error: ${error}`);
            return fallbackInstruction;
        }
    }

    /**
     * 取得系統指令（支援 inline 或 file 來源）
     * @param source - 來源類型 ('Inline' 或 'File')
     * @param filePath - 檔案路徑（當 source 為 'File' 時使用）
     * @param inlineInstruction - inline 指令內容
     * @returns 最終的系統指令
     */
    private getSystemInstruction(source: string, filePath: string, inlineInstruction: string): string {
        let instruction = '';

        if (source === 'File') {
            if (!filePath) {
                console.warn(`⚠️ System prompt file path is not specified. Fallback to inline instruction.`);
                instruction = inlineInstruction;
            } else {
                instruction = this.loadSystemInstructionFromFile(filePath, inlineInstruction);
            }
        } else {
            instruction = inlineInstruction;
        }

        // 最終檢查：如果仍然為空，使用預設指令
        if (!instruction || instruction.trim().length === 0) {
            console.warn(`⚠️ System prompt (inline or file fallback) is empty. Using default instruction.`);
            return DEFAULT_SYSTEM_INSTRUCTION;
        }

        return instruction;
    }

    /**
     * 從環境變數或 task input 取得輸入值
     * @param envKey - 環境變數的 key
     * @param taskInputKey - task input 的 key
     * @param required - 是否必填
     * @param defaultValue - 預設值
     * @returns 輸入值
     */
    private getInputValue(envKey: string, taskInputKey: string, required: boolean = false, defaultValue: string = ''): string {
        if (this.isDebugMode) {
            return process.env[envKey] ?? defaultValue;
        } else {
            return tl.getInput(taskInputKey, required) ?? defaultValue;
        }
    }

    /**
     * 取得 AI Provider 的模型名稱和 API Key
     * @param provider - AI Provider 名稱
     * @returns { modelName, modelKey, serverAddress }
     */
    private getAIProviderConfig(provider: string): { modelName: string; modelKey: string; serverAddress?: string } {
        const providerLower = provider.toLowerCase();

        if (this.isDebugMode) {
            const modelName = process.env.ModelName ?? this.getDefaultModelName(providerLower);
            const modelKey = this.getModelKeyFromEnv(providerLower);
            const serverAddress = providerLower === 'githubcopilot' ? process.env.GitHubCopilotServerAddress : undefined;
            return { modelName, modelKey, serverAddress };
        } else {
            return this.getModelConfigFromTaskInput(providerLower);
        }
    }

    private getDefaultModelName(provider: string): string {
        const defaults: Record<string, string> = {
            'openai': 'gpt-4.1-nano',
            'grok': 'grok-3-mini',
            'claude': 'claude-haiku-4-5',
            'google': 'gemini-2.5-flash',
            'githubcopilot': 'gpt-5-mini'
        };
        return defaults[provider] ?? 'gemini-2.5-flash';
    }

    private getModelKeyFromEnv(provider: string): string {
        const keyMap: Record<string, string> = {
            'openai': 'OpenAIAPIKey',
            'grok': 'GrokAPIKey',
            'claude': 'ClaudeAPIKey',
            'google': 'GeminiAPIKey',
            'githubcopilot': '' // GitHub Copilot 不需要 API Key
        };
        return process.env[keyMap[provider]] ?? '';
    }

    private getModelConfigFromTaskInput(provider: string): { modelName: string; modelKey: string; serverAddress?: string } {
        const configMap: Record<string, { nameKey: string; apiKeyKey: string; defaultName: string; serverAddressKey?: string }> = {
            'openai': { nameKey: 'inputOpenAIModelName', apiKeyKey: 'inputOpenAIApiKey', defaultName: 'gpt-4.1-nano' },
            'grok': { nameKey: 'inputGrokModelName', apiKeyKey: 'inputGrokApiKey', defaultName: 'grok-3-mini' },
            'claude': { nameKey: 'inputClaudeModelName', apiKeyKey: 'inputClaudeApiKey', defaultName: 'claude-haiku-4-5' },
            'google': { nameKey: 'inputModelName', apiKeyKey: 'inputModelKey', defaultName: 'gemini-2.5-flash' },
            'githubcopilot': { nameKey: 'inputGitHubCopilotModelName', apiKeyKey: '', defaultName: 'gpt-4o', serverAddressKey: 'inputGitHubCopilotServerAddress' }
        };

        const config = configMap[provider];
        if (!config) {
            throw new Error(`⛔ Unsupported AI Provider: ${provider}`);
        }

        const result: { modelName: string; modelKey: string; serverAddress?: string } = {
            modelName: tl.getInput(config.nameKey, false) ?? config.defaultName,
            modelKey: config.apiKeyKey ? (tl.getInput(config.apiKeyKey, true) ?? '') : ''
        };

        // GitHub Copilot 需要讀取 serverAddress
        if (config.serverAddressKey) {
            result.serverAddress = tl.getInput(config.serverAddressKey, true) ?? '';
        }

        return result;
    }

    /**
     * 取得 Pipeline 的輸入參數
     * @returns Pipeline 輸入參數
     */
    getPipelineInputs(): PipelineInputs {
        // 取得 AI Provider
        const inputAiProvider = this.getInputValue('AiProvider', 'inputAiProvider', true, 'Google');

        // 取得 AI Provider 設定
        const { modelName, modelKey, serverAddress } = this.getAIProviderConfig(inputAiProvider);

        // 取得系統指令
        const systemInstructionSource = this.getInputValue('SystemInstructionSource', 'inputSystemInstructionSource', false, 'Inline');
        const systemPromptFile = this.getInputValue('SystemPromptFile', 'inputSystemPromptFile', false, '');
        const inlineInstruction = this.getInputValue('SystemInstruction', 'inputSystemInstruction', false, '');
        const systemInstruction = this.getSystemInstruction(systemInstructionSource, systemPromptFile, inlineInstruction);

        // 取得其他參數
        const promptTemplate = this.getInputValue('PromptTemplate', 'inputPromptTemplate', true, '{code_changes}');
        const maxOutputTokens = parseInt(this.getInputValue('MaxOutputTokens', 'inputMaxOutputTokens', false, '4096'));
        const temperature = parseFloat(this.getInputValue('Temperature', 'inputTemperature', false, '1.0'));
        const fileExtensionsStr = this.getInputValue('FileExtensions', 'inputFileExtensions', false, '');
        const binaryExtensionsStr = this.getInputValue('BinaryExtensions', 'inputBinaryExtensions', false, '');
        const enableThrottleMode = this.getInputValue('EnableThrottleMode', 'inputEnableThrottleMode', false, 'true').toLowerCase() === 'true';
        const showReviewContent = this.getInputValue('ShowReviewContent', 'inputShowReviewContent', false, 'false').toLowerCase() === 'true';
        const enableIncrementalDiff = this.getInputValue('EnableIncrementalDiff', 'inputEnableIncrementalDiff', false, 'false').toLowerCase() === 'true';
        
        // 取得 GitHub Copilot Timeout (僅當 AI Provider 為 GitHubCopilot 時)
        let timeout: number | undefined = undefined;
        if (inputAiProvider.toLowerCase() === 'githubcopilot') {
            const timeoutStr = this.getInputValue('GitHubCopilotTimeout', 'inputGitHubCopilotTimeout', false, '120000');
            if (timeoutStr && timeoutStr.trim() !== '') {
                const parsedTimeout = parseInt(timeoutStr);
                timeout = isNaN(parsedTimeout) ? undefined : parsedTimeout;
            }
        }

        // 解析副檔名列表
        const fileExtensions = fileExtensionsStr
            ? fileExtensionsStr.split(',').map(ext => ext.trim()).filter(ext => ext.length > 0)
            : [];

        const binaryExtensions = binaryExtensionsStr
            ? binaryExtensionsStr.split(',').map(ext => ext.trim()).filter(ext => ext.length > 0)
            : [];

        return {
            aiProvider: inputAiProvider,
            modelName,
            modelKey,
            serverAddress,
            timeout,
            systemInstruction,
            promptTemplate,
            maxOutputTokens,
            temperature,
            fileExtensions,
            binaryExtensions,
            enableThrottleMode,
            showReviewContent,
            enableIncrementalDiff
        };
    }

    /**
     * 取得 Azure DevOps 連線資訊
     * @returns Azure DevOps 連線資訊
     */
    getDevOpsConnection(): DevOpsConnection {
        let accessToken: string;
        let collectionUri: string;
        let projectName: string;
        let repositoryId: string;
        let pullRequestId: number;

        if (this.isDebugMode) {
            // Debug 模式：從環境變數讀取
            accessToken = process.env.DevOpsAccessToken ?? '';
            collectionUri = process.env.DevOpsOrgUrl ?? '';
            projectName = process.env.DevOpsProjectName ?? '';
            repositoryId = process.env.DevOpsRepositoryId ?? '';
            pullRequestId = parseInt(process.env.DevOpsPRId ?? '0');
        } else {
            // Pipeline 模式：從 Azure DevOps 變數讀取
            const repositoryUri = tl.getVariable('Build.Repository.Uri') ?? '';

            // 根據 Repository URI 判斷是 GitHub 還是 Azure DevOps
            const isGitHub = repositoryUri.toLowerCase().includes('github.com');
            if (isGitHub) {
                // Github 模式下目前還不知道怎麼取得 Access Token，所以先手動在變數裡設定，並將 PR 權限的 PAT 加入到變數中
                accessToken = tl.getVariable('AccessToken') ?? '';
                collectionUri = this.extractGitHubBaseUrl(repositoryUri);
                repositoryId = this.extractGitHubOwnerRepo(repositoryUri);
                projectName = repositoryId.split('/')[0]; // 使用 owner 作為 project name
                pullRequestId = parseInt(tl.getVariable('System.PullRequest.PullRequestNumber') ?? '0');
            } else {
                accessToken = tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false) ?? '';
                collectionUri = tl.getVariable('System.CollectionUri') ?? '';
                projectName = tl.getVariable('System.TeamProject') ?? '';
                repositoryId = tl.getVariable('Build.Repository.ID') ?? '';
                pullRequestId = parseInt(tl.getVariable('System.PullRequest.PullRequestId') ?? '0');
            }
        }

        if (!accessToken) {
            throw new Error('⛔ Unable to get DevOps access token');
        }

        if (!collectionUri) {
            throw new Error('⛔ Unable to get DevOps collection URI');
        }

        if (!projectName) {
            throw new Error('⛔ Unable to get DevOps project name');
        }

        if (!repositoryId) {
            throw new Error('⛔ Unable to get DevOps repository ID');
        }

        return {
            accessToken,
            collectionUri,
            projectName,
            repositoryId,
            pullRequestId
        };
    }

    /**
     * 從 GitHub Repository URI 提取 owner/repo 格式
     * @param repositoryUri - GitHub Repository URI (例如: https://github.com/lawrence8358/AI-PR-AutoReview)
     * @returns owner/repo 格式的字串 (例如: lawrence8358/AI-PR-AutoReview)
     */
    extractGitHubOwnerRepo(repositoryUri: string): string {
        try {
            const url = new URL(repositoryUri);
            // 移除開頭的斜線並去除可能的 .git 後綴
            const pathParts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
            if (pathParts.length >= 2) {
                return `${pathParts[0]}/${pathParts[1]}`;
            }
        } catch (e) {
            console.error(`⚠️ Failed to parse GitHub URI: ${repositoryUri}`, e);
        }
        throw new Error(`⛔ Invalid GitHub repository URI format: ${repositoryUri}`);
    }

    /**
     * 從 GitHub Repository URI 提取基礎 URL
     * @param repositoryUri - GitHub Repository URI (例如: https://github.com/lawrence8358/AI-PR-AutoReview)
     * @returns GitHub 基礎 URL (例如: https://github.com/)
     */
    extractGitHubBaseUrl(repositoryUri: string): string {
        try {
            const url = new URL(repositoryUri);
            return `${url.protocol}//${url.host}/`;
        } catch (e) {
            console.error(`⚠️ Failed to parse GitHub URI: ${repositoryUri}`, e);
        }
        throw new Error(`⛔ Invalid GitHub repository URI format: ${repositoryUri}`);
    }

    /**
     * 取得 PR 變更的檔案清單
     * @param devOpsService - DevOps 服務實例
     * @param connection - Azure DevOps 連線資訊
     * @param inputs - Pipeline 輸入參數
     * @returns PR 變更檔案清單
     */
    async getPullRequestChanges(
        devOpsService: DevOpsService,
        connection: DevOpsConnection,
        inputs: PipelineInputs
    ) {
        const changes = await devOpsService.getPullRequestChanges(
            connection.projectName,
            connection.repositoryId,
            connection.pullRequestId,
            inputs.fileExtensions,
            inputs.binaryExtensions.length > 0 ? inputs.binaryExtensions : [],
            inputs.enableThrottleMode,
            inputs.enableIncrementalDiff
        );

        return changes;
    }

    /**
     * 呼叫 AI 服務取得建議內容
     * @param aiProvider - AI Provider 服務實例
     * @param inputs - Pipeline 輸入參數
     * @param changes - PR 變更檔案清單
     * @returns AI 分析結果，包含內容和 token 使用情況
     */
    async generateAIReview(
        aiProvider: AIProviderService,
        inputs: PipelineInputs,
        changes: Array<{ path: string; changeType: any; content: string }>
    ) {
        // 取得 AI 服務
        const aiService = aiProvider.getService(inputs.aiProvider);

        // 組合變更內容
        const codeChanges = changes
            .map(change => `\n## File: ${change.path}\n\`\`\`\n${change.content}\n\`\`\``)
            .join('\n');

        // 替換提示詞範本中的佔位符
        const prompt = inputs.promptTemplate.replace('{code_changes}', codeChanges);

        // 呼叫 AI 服務
        const aiResponse = await aiService.generateComment(
            inputs.systemInstruction,
            prompt,
            {
                maxOutputTokens: inputs.maxOutputTokens,
                temperature: inputs.temperature,
                showReviewContent: inputs.showReviewContent
            }
        );

        // 記錄總 token 使用情況
        if (aiResponse.inputTokens && aiResponse.outputTokens) {
            const totalTokens = aiResponse.inputTokens + aiResponse.outputTokens;
            console.log(`💰 Total Token Usage: ${totalTokens} (Input: ${aiResponse.inputTokens}, Output: ${aiResponse.outputTokens})`);
        }

        return {
            content: aiResponse.content,
            inputTokens: aiResponse.inputTokens || 0,
            outputTokens: aiResponse.outputTokens || 0
        };
    }

    /**
     * 將建議內容新增為 PR 的評論
     * @param devOpsService - DevOps 服務實例
     * @param connection - Azure DevOps 連線資訊
     * @param reviewContent - AI 分析結果內容  
     * @param providerName - AI 提供者名稱
     * @param aiModelName - 使用的 AI 模型名稱
     */
    async addReviewComment(
        devOpsService: DevOpsService,
        connection: DevOpsConnection,
        reviewContent: string,  
        providerName: string,
        aiModelName: string
    ) {
        const commentHeader = `🤖 AI Code Review (${providerName} - ${aiModelName})`;
        await devOpsService.addPullRequestComment(
            connection.projectName,
            connection.repositoryId,
            connection.pullRequestId,
            reviewContent,
            commentHeader
        );
    }
}

/**
 * 執行 Azure DevOps Pipeline Task
 */
async function run() {
    // 檢查是否為 debug 模式 (從環境變數或命令列參數)
    const isDebugMode = process.env.DEBUG_MODE === 'true' || process.argv.includes('--debug');
    const main = new Main(isDebugMode);

    try {
        console.log(`🚀 Starting AI Pull Request Code Review Task... (Debug Mode: ${isDebugMode ? 'ON' : 'OFF'})`);

        // 1. 取得輸入參數
        const inputs = main.getPipelineInputs();
        const connection = main.getDevOpsConnection();

        // 確認是否有 Pull Request 資訊
        if (!connection.pullRequestId) {
            console.log('⚠️ Unable to get Pull Request information. Please ensure this task runs in a PR build.');
            tl.setResult(tl.TaskResult.Succeeded, 'No Pull Request context found. Task skipped.');
            return;
        }

        // 2. 初始化服務
        const aiProvider = new AIProviderService();
        const config = {
            apiKey: inputs.modelKey,
            modelName: inputs.modelName,
            serverAddress: inputs.serverAddress,
            timeout: inputs.timeout
        }; 
        aiProvider.registerService(inputs.aiProvider, config);
        
        const devOpsProvider = new DevOpsProviderService();
        const provider = DevOpsProviderService.detectProvider(connection.collectionUri);
        devOpsProvider.registerService(provider, {
            accessToken: connection.accessToken,
            organizationUrl: connection.collectionUri
        });
        const devOpsService = devOpsProvider.getService(provider);

        // 3. 取得 PR 變更
        const changes = await main.getPullRequestChanges(devOpsService, connection, inputs);
        if (!changes || changes.length === 0) {
            console.log('⚠️ No code changes to review. Task completed.');
            tl.setResult(tl.TaskResult.Succeeded, 'No code changes to review');
            return;
        }

        // 4. 生成 AI 分析
        const reviewResult = await main.generateAIReview(aiProvider, inputs, changes);

        // 5. 新增評論
        await main.addReviewComment(
            devOpsService, 
            connection, 
            reviewResult.content, 
            inputs.aiProvider,     
            inputs.modelName
        );
        console.log('🎉 AI Pull Request Code Review completed successfully!');
        tl.setResult(tl.TaskResult.Succeeded, 'AI Code Review completed successfully');

    } catch (err: any) {
        console.error(`😡 Task failed with error: ${err.message}`);
        tl.setResult(tl.TaskResult.Failed, `Task failed with error: ${err.message}`);
    }
}

if (require.main === module) {
    run();
}