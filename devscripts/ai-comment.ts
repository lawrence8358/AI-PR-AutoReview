import { AIProviderService } from '../src/services/ai-provider.service';

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

        if (providerKey === 'openai') {
            canonicalName = 'OpenAI';
            registerConfig = {
                apiKey: process.env.OpenAIAPIKey ?? '',
                modelName: process.env.ModelName ?? 'gpt-4.1-nano'
            };
        } else if (providerKey === 'grok') {
            canonicalName = 'Grok';
            registerConfig = {
                apiKey: process.env.GrokAPIKey ?? '',
                modelName: process.env.ModelName ?? 'grok-3-mini'
            };
        } else if (providerKey === 'claude') {
            canonicalName = 'Claude';
            registerConfig = {
                apiKey: process.env.ClaudeAPIKey ?? '',
                modelName: process.env.ModelName ?? 'claude-haiku-4-5'
            };
        } else if (providerKey === 'google') {
            canonicalName = 'Google';
            registerConfig = {
                apiKey: process.env.GeminiAPIKey ?? '',
                modelName: process.env.ModelName ?? 'gemini-2.5-flash'
            };
        } else if (providerKey === 'githubcopilot') {
            canonicalName = 'GitHubCopilot';
            registerConfig = {
                apiKey: '', // GitHub Copilot 不需要 API Key
                modelName: process.env.ModelName ?? 'gpt-4o',
                githubToken: process.env.GitHubCopilotToken ?? '',
                serverAddress: process.env.GitHubCopilotServerAddress ?? ''
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