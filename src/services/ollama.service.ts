import { GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseHttpAIService } from './base-http-ai.service';

/**
 * Ollama 地端 AI 服務實作
 * 使用 Ollama REST API 生成內容
 */
export class OllamaService extends BaseHttpAIService {
    private readonly baseUrl: string;

    /**
     * 建立 Ollama 服務實例
     * @param model - 模型名稱（例如 'gemma3:27b'）
     * @param baseUrl - Ollama API 基礎 URL，預設為 'http://localhost:11434'
     */
    constructor(model: string, baseUrl: string = 'http://localhost:11434') {
        super('local', model);
        const parsed = new URL(baseUrl); // 若格式非法會直接 throw
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error(`⛔ Ollama baseUrl only allows http:// or https:// protocol`);
        }
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    /**
     * 取得服務名稱
     * @returns 服務名稱
     */
    protected getServiceName(): string {
        return 'Ollama';
    }

    protected getApiUrl(): string {
        return `${this.baseUrl}/api/chat`;
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
        const messages: Array<{ role: string; content: string }> = [];

        if (systemInstruction && systemInstruction.trim() !== '') {
            messages.push({ role: 'system', content: systemInstruction });
        }

        messages.push({ role: 'user', content: prompt });

        const requestBody: any = {
            model: this.model,
            messages,
            stream: false,
            think: false   // Disable thinking mode for reasoning models
        };

        const options: Record<string, any> = {};
        if (config?.temperature !== undefined)
            options.temperature = config.temperature;
        if (config?.maxOutputTokens !== undefined)
            options.num_predict = config?.maxOutputTokens;

        requestBody.options = options;

        return requestBody;
    }

    protected extractContent(response: any): string {
        const msg = response.data?.message;
        // Reasoning models (e.g. DeepSeek-R1 style) output thinking separately from content.
        // If content is empty, fall back to thinking field.
        return msg?.content || msg?.thinking || '';
    }

    protected extractTokenUsage(response: any): { inputTokens?: number; outputTokens?: number } {
        return {
            inputTokens: response.data.prompt_eval_count,
            outputTokens: response.data.eval_count
        };
    }

    protected override getExtraAxiosConfig(): Record<string, any> {
        return { timeout: 300_000 };
    }
}
