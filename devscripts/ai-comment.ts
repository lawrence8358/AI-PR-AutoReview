import { AIProviderService } from '../src/services/ai-provider.service';
import { AI_PROVIDERS, DEFAULT_MODELS, API_KEY_ENV_MAP, AI_PROVIDER_DISPLAY_NAMES } from '../src/constants';

async function run() {
    // 根據環境變數的 AiProvider 選擇要測試的 AI 平台
    const requested = (process.env.AiProvider ?? 'Google').trim();
    const providerKey = requested.toLowerCase();
    const showReviewContent: boolean = (process.env.ShowReviewContent ?? 'false').toLowerCase() === 'true';

    const aiProvider = new AIProviderService();
    const systemInstruction = `你是一位資深軟體工程師，請協助進行程式碼審查和分析。`;
    const prompt = `請先確認你會使用 C# 語言嗎?`;

    try {
        let registerConfig: { apiKey: string; modelName: string; githubToken?: string; serverAddress?: string } | undefined;
        let canonicalName = 'Google';

        if (providerKey === AI_PROVIDERS.OPENAI) {
            canonicalName = AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.OPENAI];
            const envKey = API_KEY_ENV_MAP[AI_PROVIDERS.OPENAI];
            registerConfig = {
                apiKey: process.env[envKey] ?? '',
                modelName: process.env.ModelName ?? DEFAULT_MODELS[AI_PROVIDERS.OPENAI]
            };
        } else if (providerKey === AI_PROVIDERS.GROK) {
            canonicalName = AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GROK];
            const envKey = API_KEY_ENV_MAP[AI_PROVIDERS.GROK];
            registerConfig = {
                apiKey: process.env[envKey] ?? '',
                modelName: process.env.ModelName ?? DEFAULT_MODELS[AI_PROVIDERS.GROK]
            };
        } else if (providerKey === AI_PROVIDERS.CLAUDE) {
            canonicalName = AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.CLAUDE];
            const envKey = API_KEY_ENV_MAP[AI_PROVIDERS.CLAUDE];
            registerConfig = {
                apiKey: process.env[envKey] ?? '',
                modelName: process.env.ModelName ?? DEFAULT_MODELS[AI_PROVIDERS.CLAUDE]
            };
        } else if (providerKey === AI_PROVIDERS.GOOGLE) {
            canonicalName = AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GOOGLE];
            const envKey = API_KEY_ENV_MAP[AI_PROVIDERS.GOOGLE];
            registerConfig = {
                apiKey: process.env[envKey] ?? '',
                modelName: process.env.ModelName ?? DEFAULT_MODELS[AI_PROVIDERS.GOOGLE]
            };
        } else if (providerKey === AI_PROVIDERS.GITHUB_COPILOT) {
            canonicalName = AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.GITHUB_COPILOT];
            registerConfig = {
                apiKey: '', // GitHub Copilot 不需要 API Key
                modelName: process.env.ModelName ?? DEFAULT_MODELS[AI_PROVIDERS.GITHUB_COPILOT],
                githubToken: process.env.GitHubCopilotToken ?? '',
                serverAddress: process.env.GitHubCopilotServerAddress ?? ''
            };
        } else if (providerKey === AI_PROVIDERS.OLLAMA) {
            canonicalName = AI_PROVIDER_DISPLAY_NAMES[AI_PROVIDERS.OLLAMA];
            registerConfig = {
                apiKey: '', // Ollama 不需要 API Key
                modelName: process.env.ModelName ?? DEFAULT_MODELS[AI_PROVIDERS.OLLAMA] ?? '',
                serverAddress: process.env.OllamaBaseUrl ?? 'http://localhost:11434'
            };
        } else {
            throw new Error(`⛔ Unsupported AI Provider: ${requested}`);
        }

        aiProvider.registerService(canonicalName, {
            apiKey: registerConfig.apiKey,
            modelName: registerConfig.modelName,
            githubToken: registerConfig.githubToken,
            serverAddress: registerConfig.serverAddress
        });

        const aiService = aiProvider.getService(canonicalName);

        const response = await aiService.generateComment(
            systemInstruction,
            prompt,
            {
                maxOutputTokens: parseInt(process.env.MaxOutputTokens ?? '3000'),
                temperature: parseFloat(process.env.Temperature ?? '1.0'),
                showReviewContent: showReviewContent
            }
        );
        process.exit(0);
    } catch (err: any) {
        console.error('⛔ Unhandled error: ' + (err?.message || String(err)));
        process.exit(1);
    }
}

run().catch(err => {
    console.error('⛔ Unhandled error: ' + err.message);
    process.exit(1);
});