// import tl = require('azure-pipelines-task-lib/task');
import * as tl from 'azure-pipelines-task-lib/task';
import { PipelineInputs, DevOpsConnection } from './interfaces/pipeline-inputs.interface';
import { AIProviderService } from './services/ai-provider.service';
import { DevOpsService } from './services/devops.service';


class Main {
    private isDebugMode: boolean;

    constructor(isDebugMode: boolean = false) {
        this.isDebugMode = isDebugMode;
    }

    /**
     * 取得 Pipeline 的輸入參數
     * @returns Pipeline 輸入參數
     */
    getPipelineInputs(): PipelineInputs {
        let inputAiProvider: string;
        let inputModelName: string;
        let inputModelKey: string;
        let inputSystemInstruction: string;
        let inputPromptTemplate: string;
        let inputMaxOutputTokens: number;
        let inputTemperature: number;
        let inputFileExtensions: string;
        let inputBinaryExtensions: string;
        let inputEnableThrottleMode: boolean;
        let inputShowReviewContent: boolean;

        if (this.isDebugMode) {
            // Debug 模式：從環境變數讀取 10
            inputAiProvider = process.env.AiProvider ?? 'Google';

            // 測試 Code Review 功能故意寫上 HotCode Key， GeminiKey ABC12345678902
            // 根據不同的 AI Provider 讀取對應的 API Key 和 Model
            if (inputAiProvider.toLowerCase() === 'openai') {
                inputModelName = process.env.ModelName ?? 'gpt-4.1-nano';
                inputModelKey = process.env.OpenAIAPIKey ?? '';
            } else if (inputAiProvider.toLowerCase() === 'grok') {
                inputModelName = process.env.ModelName ?? 'grok-3-mini';
                inputModelKey = process.env.GrokAPIKey ?? '';
            } else if (inputAiProvider.toLowerCase() === 'google') {
                inputModelName = process.env.ModelName ?? 'gemini-2.5-flash';
                inputModelKey = process.env.GeminiAPIKey ?? '';
            } else {
                throw new Error(`⛔ Unsupported AI Provider: ${inputAiProvider}`);
            }

            inputSystemInstruction = process.env.SystemInstruction ?? '';
            inputPromptTemplate = process.env.PromptTemplate ?? '{code_changes}';
            inputMaxOutputTokens = parseInt(process.env.MaxOutputTokens ?? '4096');
            inputTemperature = parseFloat(process.env.Temperature ?? '1.0');
            inputFileExtensions = process.env.FileExtensions ?? '';
            inputBinaryExtensions = process.env.BinaryExtensions ?? '';
            inputEnableThrottleMode = (process.env.EnableThrottleMode ?? 'true').toLowerCase() === 'true';
            inputShowReviewContent = (process.env.ShowReviewContent ?? 'false').toLowerCase() === 'true';
        } else {
            // Pipeline 模式：從 task inputs 讀取，account = admin
            inputAiProvider = tl.getInput('inputAiProvider', true) ?? 'Google';

            // 根據不同的 AI Provider 讀取對應的參數
            if (inputAiProvider.toLowerCase() === 'openai') {
                inputModelName = tl.getInput('inputOpenAIModelName', true) ?? 'gpt-4.1-nano';
                inputModelKey = tl.getInput('inputOpenAIApiKey', true) ?? '';
            } else if (inputAiProvider.toLowerCase() === 'grok') {
                inputModelName = tl.getInput('inputGrokModelName', true) ?? 'grok-3-mini';
                inputModelKey = tl.getInput('inputGrokApiKey', true) ?? '';
            } else if (inputAiProvider.toLowerCase() === 'google') {
                inputModelName = tl.getInput('inputModelName', true) ?? 'gemini-2.5-flash';
                inputModelKey = tl.getInput('inputModelKey', true) ?? '';
            } else {
                throw new Error(`⛔ Unsupported AI Provider: ${inputAiProvider}`);
            }

            inputSystemInstruction = tl.getInput('inputSystemInstruction', false) ?? '';
            inputPromptTemplate = tl.getInput('inputPromptTemplate', true) ?? '{code_changes}';
            inputMaxOutputTokens = parseInt(tl.getInput('inputMaxOutputTokens', false) ?? '4096');
            inputTemperature = parseFloat(tl.getInput('inputTemperature', false) ?? '1.0');
            inputFileExtensions = tl.getInput('inputFileExtensions', false) ?? '';
            inputBinaryExtensions = tl.getInput('inputBinaryExtensions', false) ?? '';
            inputEnableThrottleMode = (tl.getInput('inputEnableThrottleMode', false) ?? 'true').toLowerCase() === 'true';
            inputShowReviewContent = (tl.getInput('inputShowReviewContent', false) ?? 'false').toLowerCase() === 'true';
        }

        // 解析副檔名列表
        const fileExtensions = inputFileExtensions
            ? inputFileExtensions.split(',').map(ext => ext.trim()).filter(ext => ext.length > 0)
            : [];

        const binaryExtensions = inputBinaryExtensions
            ? inputBinaryExtensions.split(',').map(ext => ext.trim()).filter(ext => ext.length > 0)
            : [];

        return {
            aiProvider: inputAiProvider,
            modelName: inputModelName,
            modelKey: inputModelKey,
            systemInstruction: inputSystemInstruction,
            promptTemplate: inputPromptTemplate,
            maxOutputTokens: inputMaxOutputTokens,
            temperature: inputTemperature,
            fileExtensions: fileExtensions,
            binaryExtensions: binaryExtensions,
            enableThrottleMode: inputEnableThrottleMode,
            showReviewContent: inputShowReviewContent
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
            accessToken = tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false) ?? '';
            collectionUri = tl.getVariable('System.CollectionUri') ?? '';
            projectName = tl.getVariable('System.TeamProject') ?? '';
            repositoryId = tl.getVariable('Build.Repository.ID') ?? '';
            pullRequestId = parseInt(tl.getVariable('System.PullRequest.PullRequestId') ?? '0');
        }

        if (!accessToken) {
            throw new Error('⛔ Unable to get Azure DevOps access token');
        }

        if (!collectionUri) {
            throw new Error('⛔ Unable to get Azure DevOps collection URI');
        }

        if (!projectName) {
            throw new Error('⛔ Unable to get Azure DevOps project name');
        }

        if (!repositoryId) {
            throw new Error('⛔ Unable to get Azure DevOps repository ID');
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
            inputs.binaryExtensions.length > 0 ? inputs.binaryExtensions : undefined,
            inputs.enableThrottleMode
        );

        return changes;
    }

    /**
     * 呼叫 AI 服務取得建議內容
     * @param aiProvider - AI Provider 服務實例
     * @param inputs - Pipeline 輸入參數
     * @param changes - PR 變更檔案清單
     * @returns AI 分析結果
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
            .map(change => {
                return `\n## File: ${change.path}\n\`\`\`\n${change.content}\n\`\`\``;
            })
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

        return aiResponse.content;
    }

    /**
     * 將建議內容新增為 PR 的評論
     * @param devOpsService - DevOps 服務實例
     * @param connection - Azure DevOps 連線資訊
     * @param reviewContent - AI 分析結果內容
     * @param aiModelName - 使用的 AI 模型名稱
     */
    async addReviewComment(
        devOpsService: DevOpsService,
        connection: DevOpsConnection,
        reviewContent: string,
        aiModelName: string
    ) {
        const commentHeader = `🤖 AI Code Review (${aiModelName})`;
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
        aiProvider.registerService(inputs.aiProvider, {
            apiKey: inputs.modelKey,
            modelName: inputs.modelName
        });

        const devOpsService = new DevOpsService(
            connection.accessToken,
            connection.collectionUri
        );

        // 3. 取得 PR 變更
        const changes = await main.getPullRequestChanges(devOpsService, connection, inputs);
        if (!changes || changes.length === 0) {
            console.log('⚠️ No code changes to review. Task completed.');
            tl.setResult(tl.TaskResult.Succeeded, 'No code changes to review');
            return;
        }

        // 4. 生成 AI 分析
        const reviewContent = await main.generateAIReview(aiProvider, inputs, changes); 

        // 5. 新增評論
        await main.addReviewComment(devOpsService, connection, reviewContent, inputs.modelName);

        console.log('🎉 AI Pull Request Code Review completed successfully!');
        tl.setResult(tl.TaskResult.Succeeded, 'AI Code Review completed successfully');

    } catch (err: any) {
        console.error(`😡 Task failed with error: ${err.message}`);
        tl.setResult(tl.TaskResult.Failed, `Task failed with error: ${err.message}`);
    }
}

run();
