import { BaseOpenAICompatibleService } from './base-openai-compatible.service';

/**
 * Grok (xAI) 服務實作
 * 使用 xAI API 生成內容（相容 OpenAI API 格式）
 */
export class GrokService extends BaseOpenAICompatibleService {
    /**
     * 建立 Grok 服務實例
     * @param apiKey - xAI API 金鑰
     * @param model - 模型名稱，預設為 'grok-3-mini'
     * @throws {Error} 當 apiKey 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string = 'grok-3-mini') {
        super(apiKey, model, 'https://api.x.ai/v1');
    }

    /**
     * 取得服務名稱
     * @returns 服務名稱
     */
    protected getServiceName(): string {
        return 'Grok (xAI)';
    }
}
