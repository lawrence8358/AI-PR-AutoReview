import OpenAI from 'openai';
import { AIService, AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';

/**
 * Grok (xAI) 服務實作
 * 使用 xAI API 生成內容（相容 OpenAI API 格式）
 */
export class GrokService implements AIService {
    private apiKey: string;
    private model: string;

    /**
     * 建立 Grok 服務實例
     * @param apiKey - xAI API 金鑰
     * @param model - 模型名稱，預設為 'grok-3-mini'
     * @throws {Error} 當 apiKey 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string = 'grok-3-mini') {
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('⛔ API key is required for Grok service');
        }

        if (!model || model.trim() === '') {
            throw new Error('⛔ Model name is required for Grok service');
        }

        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * 生成評論內容
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定 (選用)
     * @returns AI 服務回應
     */
    public async generateComment(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): Promise<AIResponse> {
        console.log('🚩 Generating response using Grok (xAI)...');

        try {
            // 建立 OpenAI 客戶端，指向 xAI 端點
            const client = new OpenAI({
                apiKey: this.apiKey,
                baseURL: 'https://api.x.ai/v1'
            });

            // 準備訊息陣列
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
            
            if (systemInstruction && systemInstruction.trim() !== '') {
                messages.push({ role: 'system', content: systemInstruction });
            }
            
            messages.push({ role: 'user', content: prompt });

            // 準備請求參數
            const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
                model: this.model,
                messages: messages
            };

            // 若有提供設定，則加入生成設定
            if (config) {
                if (config.temperature !== undefined) {
                    requestOptions.temperature = config.temperature;
                }
                if (config.maxOutputTokens !== undefined) {
                    requestOptions.max_completion_tokens = config.maxOutputTokens;
                }
            }

            const response = await client.chat.completions.create(requestOptions);

            // 取得回應內容
            const content = response.choices?.[0]?.message?.content || 'No response generated';
            console.log('✅ Response generated successfully');
            return { content };

        } catch (error: any) {
            const message = JSON.stringify(error.response?.data || error.message);
            throw new Error('⛔ Grok service error: ' + message);
        }
    }
}
