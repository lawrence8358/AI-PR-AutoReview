import { AIService, AIServiceConfig } from '../interfaces/ai-service.interface';
import { GoogleAIService } from './google-ai.service';
import { OpenAIService } from './openai.service';
import { GrokService } from './grok.service';
import { ClaudeService } from './claude.service';
import { GithubCopilotService } from './github-copilot.service';
import { OpenAICompatibleService } from './openai-compatible.service';
import { AI_PROVIDERS, AI_PROVIDER_DISPLAY_NAMES } from '../constants';

/**
 * AI 服務提供者類別
 * 統一管理所有 AI 服務的建立和存取
 */
export class AIProviderService {
    private readonly services: Map<string, AIService>;
    private readonly configs: Map<string, AIServiceConfig>;

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
        const providerLower = this.normalizeProvider(provider);

        // GitHub Copilot 不使用 API Key；OpenAI-compatible 平台可能不需要 Key。
        if (providerLower !== AI_PROVIDERS.GITHUB_COPILOT && providerLower !== AI_PROVIDERS.OPENAI_COMPATIBLE) {
            if (!config.apiKey || config.apiKey.trim() === '') {
                throw new Error('⛔ API key is required');
            }
        }

        if (!config.modelName || config.modelName.trim() === '') {
            throw new Error('⛔ Model name is required');
        }
        this.configs.set(providerLower, config);
    }

    /**
     * 取得 AI 服務實例
     * @param provider - AI 服務提供者名稱
     * @returns AI 服務實例
     * @throws {Error} 當提供者不支援或未註冊時拋出錯誤
     */
    public getService(provider: string): AIService {
        const normalizedProvider = this.normalizeProvider(provider);

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
            case AI_PROVIDERS.GOOGLE:
                service = new GoogleAIService(config.apiKey, config.modelName);
                break;
            case AI_PROVIDERS.OPENAI:
                service = new OpenAIService(config.apiKey, config.modelName);
                break;
            case AI_PROVIDERS.GROK:
                service = new GrokService(config.apiKey, config.modelName);
                break;
            case AI_PROVIDERS.CLAUDE:
                service = new ClaudeService(config.apiKey, config.modelName);
                break;
            case AI_PROVIDERS.GITHUB_COPILOT:
                // githubToken, serverAddress, timeout 和 copilotCliPath 是可選的
                // 未提供時使用本機 CLI 和預設超時
                service = new GithubCopilotService(config.githubToken, config.serverAddress, config.modelName, config.timeout, config.copilotCliPath);
                break;
            case AI_PROVIDERS.OPENAI_COMPATIBLE:
                service = new OpenAICompatibleService(
                    config.apiKey,
                    config.modelName,
                    config.apiEndpoint || ''
                );
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
        return this.configs.has(this.normalizeProvider(provider));
    }

    /**
     * 移除服務註冊
     * @param provider - AI 服務提供者名稱
     */
    public removeService(provider: string): void {
        const normalizedProvider = this.normalizeProvider(provider);
        this.configs.delete(normalizedProvider);
        this.services.delete(normalizedProvider);
    }

    private normalizeProvider(provider: string): string {
        const value = provider.trim();
        const normalized = value.toLowerCase();

        if (normalized === 'openai-compatible' || normalized === 'openai compatible') {
            return AI_PROVIDERS.OPENAI_COMPATIBLE;
        }

        const displayNameMatch = Object.entries(AI_PROVIDER_DISPLAY_NAMES)
            .find(([, displayName]) => displayName.toLowerCase() === normalized);
        if (displayNameMatch) {
            return displayNameMatch[0];
        }

        return normalized;
    }
}
