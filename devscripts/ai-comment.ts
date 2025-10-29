import { AIProviderService } from '../src/services/ai-provider.service';

async function run() {
    // 初始化 AI Provider

    const aiProvider = new AIProviderService();
    aiProvider.registerService('Google', {
        apiKey: process.env.GeminiAPIKey ?? '',
        modelName: 'gemini-2.5-flash'
    }); 

    // 使用 AI 服務進行程式碼分析
    const aiService = aiProvider.getService('Google');

    const systemInstruction = `你是一位資深軟體工程師，請協助進行程式碼審查和分析。`;
    const prompt = `請先確認你會使用 C# 語言嗎?`;
    const aiResponse = await aiService.generateComment(
        systemInstruction,
        prompt,
        {
            maxOutputTokens: 3000,
            temperature: 1.0
        }
    );

    console.log('AI Response\n', aiResponse.content.trim());
}

run().catch(err => {
    console.error('⛔ Unhandled error: ' + err.message);
    process.exit(1);
});