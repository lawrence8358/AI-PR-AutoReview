import OpenAI from 'openai';
import { AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseAIService } from './base-ai.service';

/**
 * OpenAI 相容 API 的基礎服務類別
 * 此類別提供共用的邏輯給使用 OpenAI API 格式的服務（如 OpenAI、Grok 等）
 */
export abstract class BaseOpenAICompatibleService extends BaseAIService {
    protected baseURL?: string;

    /**
     * 建立 OpenAI 相容服務實例
     * @param apiKey - API 金鑰
     * @param model - 模型名稱
     * @param baseURL - API 端點 URL（選用）
     * @throws {Error} 當 apiKey 或 model 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string, baseURL?: string) {
        super(apiKey, model);
        this.baseURL = baseURL;
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
        try {
            this.logGenerationStart(config);

            if (config?.showReviewContent)
                this.printRequestInfo(systemInstruction, prompt, config);

            // 建立 OpenAI 客戶端
            const clientOptions: any = { apiKey: this.apiKey };
            if (this.baseURL) {
                clientOptions.baseURL = this.baseURL;
            }
            const client = new OpenAI(clientOptions);
            const requestOptions = this.getRequestOptions(systemInstruction, prompt, config);

            // 取得回應內容
            const response = await client.chat.completions.create(requestOptions);
            const content = response.choices?.[0]?.message?.content || 'No response generated';

            if (config?.showReviewContent)
                this.printResponseInfo(content);

            console.log('✅ Response generated successfully');

            return { content };

        } catch (error: any) {
            const message = JSON.stringify(error.response?.data || error.message);
            throw new Error(`⛔ ${this.getServiceName()} service error: ` + message);
        }
    }

    /**
     * 準備 OpenAI 請求參數
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定 (選用)
     * @returns OpenAI 請求參數
     */
    private getRequestOptions(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        // 準備請求內容
        messages.push({ role: 'user', content: prompt });

        if (systemInstruction && systemInstruction.trim() !== '') {
            messages.push({ role: 'system', content: systemInstruction });
        }

        const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            model: this.model,
            messages: messages
        };

        if (!config) return requestOptions;

        // 若有提供設定，則加入生成設定
        if (config.temperature !== undefined) {
            requestOptions.temperature = config.temperature;
        }
        if (config.maxOutputTokens !== undefined) {
            requestOptions.max_completion_tokens = config.maxOutputTokens;
        }

        return requestOptions;
    }
}


