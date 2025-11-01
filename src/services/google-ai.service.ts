import axios from 'axios';
import { AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseAIService } from './base-ai.service';

/**
 * Google AI 服務實作
 * 使用 Google Gemini API 生成內容
 */
export class GoogleAIService extends BaseAIService {
    /**
     * 建立 Google AI 服務實例
     * @param apiKey - Google AI API 金鑰
     * @param model - 模型名稱，預設為 'gemini-pro'
     * @throws {Error} 當 apiKey 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string = 'gemini-pro') {
        super(apiKey, model);
    }

    /**
     * 取得服務名稱
     * @returns 服務名稱
     */
    protected getServiceName(): string {
        return 'Google AI';
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

            // 建立 Gemini API 請求
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
            const requestBody = this.getRequestBody(systemInstruction, prompt, config);
            const response = await axios.post(
                url,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            // 取得回應內容
            const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

            if (config?.showReviewContent)
                this.printResponseInfo(content);

            console.log('✅ Response generated successfully');

            return { content };

        } catch (error: any) {
            const message = JSON.stringify(error.response?.data || error.message);
            throw new Error('⛔ Google AI service error: ' + message);
        }
    }

    /** 
     * 準備 Google AI 請求參數
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定 (選用)
     * @returns Google AI 請求參數
     */
    private getRequestBody(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): any {
        // 準備請求內容
        const requestBody: any = {
            contents: [
                { role: 'user', parts: [{ text: prompt }] }
            ]
        };

        if (systemInstruction && systemInstruction.trim() !== '') {
            requestBody.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        if (!config) return requestBody;

        // 若有提供設定，則加入生成設定
        requestBody.generationConfig = {};
        if (config.temperature !== undefined)
            requestBody.generationConfig.temperature = config.temperature;
        if (config.maxOutputTokens !== undefined)
            requestBody.generationConfig.maxOutputTokens = config.maxOutputTokens;

        return requestBody;
    }
}