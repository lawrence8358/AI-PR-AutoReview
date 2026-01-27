import axios from 'axios';
import { AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseAIService } from './base-ai.service';

/**
 * HTTP AI 服務基礎抽象類別
 * 提供使用 HTTP (Axios) 呼叫 AI 服務的共用邏輯
 */
export abstract class BaseHttpAIService extends BaseAIService {

    constructor(apiKey: string, model: string) {
        super(apiKey, model);
    }

    /**
     * 生成評論內容（共用 HTTP 邏輯）
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

            // 準備請求
            const url = this.getApiUrl();
            const requestBody = this.getRequestBody(systemInstruction, prompt, config);
            const headers = this.getHeaders();
            const requestOptions = {
                headers: headers
            };

            // 發送請求
            const response = await axios.post(
                url,
                requestBody,
                requestOptions
            );

            // 取得回應內容
            const content = this.extractContent(response);

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
     * 取得 API URL (由子類別實作)
     */
    protected abstract getApiUrl(): string;

    /**
     * 取得請求內容 (由子類別實作)
     */
    protected abstract getRequestBody(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): any;

    /**
     * 取得請求 Headers (由子類別實作)
     */
    protected abstract getHeaders(): any;

    /**
     * 從回應中提取內容 (由子類別實作)
     */
    protected abstract extractContent(response: any): string;
}
