import axios from 'axios';
import { GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseHttpAIService } from './base-http-ai.service';
import { DEFAULT_MODELS, AI_PROVIDERS } from '../constants';

/**
 * Google AI 服務實作
 * 使用 Google Gemini API 生成內容
 */
export class GoogleAIService extends BaseHttpAIService {
    /**
     * 建立 Google AI 服務實例
     * @param apiKey - Google AI API 金鑰
     * @param model - 模型名稱，預設為 'gemini-2.5-flash'
     * @throws {Error} 當 apiKey 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string = DEFAULT_MODELS[AI_PROVIDERS.GOOGLE]) {
        super(apiKey, model);
    }

    /**
     * 取得服務名稱
     * @returns 服務名稱
     */
    protected getServiceName(): string {
        return 'Google AI';
    }

    protected getApiUrl(): string {
        return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    }

    protected getHeaders(): any {
        return {
            'Content-Type': 'application/json'
        };
    }

    protected getRequestBody(
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

    protected extractContent(response: any): string {
        return response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
    }

    /**
     * 提取 Google Gemini API 回應中的 Token 使用情況
     * @param response - API 回應物件
     * @returns { inputTokens, outputTokens }
     */
    protected extractTokenUsage(response: any): { inputTokens?: number; outputTokens?: number } {
        const usage = response.data.usageMetadata;
        return {
            inputTokens: usage?.promptTokenCount,
            outputTokens: usage?.candidatesTokenCount
        };
    }
}
