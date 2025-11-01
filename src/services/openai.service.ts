import { BaseOpenAICompatibleService } from './base-openai-compatible.service';

/**
 * OpenAI 服務實作
 * 使用 OpenAI API 生成內容
 */
export class OpenAIService extends BaseOpenAICompatibleService {
    /**
     * 建立 OpenAI 服務實例
     * @param apiKey - OpenAI API 金鑰
     * @param model - 模型名稱，預設為 'gpt-4o'
     * @throws {Error} 當 apiKey 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string = 'gpt-4o') {
        super(apiKey, model);
    }

    /**
     * 取得服務名稱
     * @returns 服務名稱
     */
    protected getServiceName(): string {
        return 'OpenAI';
    }
}
