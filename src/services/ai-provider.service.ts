import { AIService, AIServiceConfig } from '../interfaces/ai-service.interface';
import { GoogleAIService } from './google-ai.service';

/**
 * AI 服務提供者類別
 * 統一管理所有 AI 服務的建立和存取
 */
export class AIProviderService {
    private services: Map<string, AIService>;
    private configs: Map<string, AIServiceConfig>;

    /**
     * 建立 AI 服務提供者實例
     */
    constructor() {
        this.services = new Map();
        this.configs = new Map();
    }

    /**
     * 註冊 AI 服務設定
     * @param provider - AI 服務提供者名稱
     * @param config - AI 服務設定
     * @throws {Error} 當設定無效時拋出錯誤
     */
    public registerService(provider: string, config: AIServiceConfig): void {
        if (!config.apiKey || config.apiKey.trim() === '') {
            throw new Error('⛔ API key is required');
        }

        if (!config.modelName || config.modelName.trim() === '') {
            throw new Error('⛔ Model name is required');
        }

        this.configs.set(provider.toLowerCase(), config);
    }

    /**
     * 取得 AI 服務實例
     * @param provider - AI 服務提供者名稱
     * @returns AI 服務實例
     * @throws {Error} 當提供者不支援或未註冊時拋出錯誤
     */
    public getService(provider: string): AIService {
        const normalizedProvider = provider.toLowerCase();
        
        // 檢查是否已有實例
        if (this.services.has(normalizedProvider)) {
            return this.services.get(normalizedProvider)!;
        }

        // 檢查是否有設定
        const config = this.configs.get(normalizedProvider);
        if (!config) {
            throw new Error(`⛔ Service ${provider} is not registered`);
        }

        // 建立新實例
        let service: AIService;
        switch (normalizedProvider) {
            case 'google':
                service = new GoogleAIService(config.apiKey, config.modelName);
                break;
            default:
                throw new Error(`⛔ Unsupported AI provider: ${provider}`);
        }

        // 快取實例
        this.services.set(normalizedProvider, service);
        return service;
    }

    /**
     * 檢查服務是否已註冊
     * @param provider - AI 服務提供者名稱
     * @returns 是否已註冊
     */
    public hasService(provider: string): boolean {
        return this.configs.has(provider.toLowerCase());
    }

    /**
     * 移除服務註冊
     * @param provider - AI 服務提供者名稱
     */
    public removeService(provider: string): void {
        const normalizedProvider = provider.toLowerCase();
        this.configs.delete(normalizedProvider);
        this.services.delete(normalizedProvider);
    }
}