import axios from 'axios';
import { GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseHttpAIService } from './base-http-ai.service';
import { DEFAULT_MODELS, AI_PROVIDERS } from '../constants';

/**
 * Claude AI 服務實作
 * 使用 Anthropic API 生成內容
 */
export class ClaudeService extends BaseHttpAIService {
    private readonly apiVersion = '2023-06-01';

    /**
     * 建立 Claude AI 服務實例
     * @param apiKey - Anthropic API 金鑰
     * @param model - 模型名稱，預設為 'claude-haiku-4-5'
     * @throws {Error} 當 apiKey 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string = DEFAULT_MODELS[AI_PROVIDERS.CLAUDE]) {
        super(apiKey, model);
    }

    /**
     * 取得服務名稱
     * @returns 服務名稱
     */
    protected getServiceName(): string {
        return 'Claude (Anthropic)';
    }

    protected getApiUrl(): string {
        return 'https://api.anthropic.com/v1/messages';
    }

    protected getHeaders(): any {
        return {
            'x-api-key': this.apiKey,
            'anthropic-version': this.apiVersion,
            'content-type': 'application/json'
        };
    }

    /**
     * 準備 Claude API 請求參數
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定 (選用)
     * @returns Claude API 請求參數
     */
    protected getRequestBody(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): any {
        // 準備請求內容
        const requestBody: any = {
            model: this.model,
            messages: [
                { role: 'user', content: prompt }
            ]
        };

        if (config?.maxOutputTokens !== undefined) {
            requestBody.max_tokens = config.maxOutputTokens;
        }

        if (systemInstruction && systemInstruction.trim() !== '') {
            requestBody.system = systemInstruction;
        }

        if (config?.temperature !== undefined) {
            requestBody.temperature = config.temperature;
        }

        return requestBody;
    }

    protected extractContent(response: any): string {
        return response.data.content?.[0]?.text || 'No response generated';
    }

    /**
     * 提取 Claude API 回應中的 Token 使用情況
     * @param response - API 回應物件
     * @returns { inputTokens, outputTokens }
     */
    protected extractTokenUsage(response: any): { inputTokens?: number; outputTokens?: number } {
        const usage = response.data.usage;
        return {
            inputTokens: usage?.input_tokens,
            outputTokens: usage?.output_tokens
        };
    }
}
