import axios from 'axios';
import { AIService, AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';

/**
 * Google AI 服務實作
 * 使用 Google Gemini API 生成內容
 */
export class GoogleAIService implements AIService {
    private apiKey: string;
    private model: string;

    /**
     * 建立 Google AI 服務實例
     * @param apiKey - Google AI API 金鑰
     * @param model - 模型名稱，預設為 'gemini-pro'
     * @throws {Error} 當 apiKey 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string = 'gemini-pro') {
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('⛔ API key is required for Google AI service');
        }

        if (!model || model.trim() === '') {
            throw new Error('⛔ Model name is required for Google AI service');
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
        console.log('🚩 Generating response using Google AI...');

        try {
            // 建立 API 請求
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

            // 準備請求內容
            const requestBody: any = {
                contents: [
                    { role: 'user', parts: [{ text: prompt }] }
                ]
            };

            if(systemInstruction && systemInstruction.trim() !== '') {
                requestBody.systemInstruction = {
                    parts: [{ text: systemInstruction }]
                };
            }

            // 若有提供設定，則加入生成設定
            if (config) {
                requestBody.generationConfig = {};
                if (config.temperature !== undefined) {
                    requestBody.generationConfig.temperature = config.temperature;
                }
                if (config.maxOutputTokens !== undefined) {
                    requestBody.generationConfig.maxOutputTokens = config.maxOutputTokens;
                }
            }

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
            console.log('✅ Response generated successfully');
            return { content };

        } catch (error: any) {
            const message = JSON.stringify(error.response?.data || error.message);
            throw new Error('⛔ Google AI service error: ' + message);
        }
    }
}