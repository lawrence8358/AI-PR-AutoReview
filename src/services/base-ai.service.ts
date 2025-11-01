import { AIService, GenerateConfig } from '../interfaces/ai-service.interface';

/**
 * AI 服務基礎抽象類別
 * 提供共用的功能給所有 AI 服務實作
 */
export abstract class BaseAIService implements AIService {
    protected apiKey: string;
    protected model: string;

    /**
     * 建立 AI 服務基礎實例
     * @param apiKey - API 金鑰
     * @param model - 模型名稱
     * @throws {Error} 當 apiKey 或 model 未提供時拋出錯誤
     */
    constructor(apiKey: string, model: string) {
        if (!apiKey || apiKey.trim() === '') {
            throw new Error(`⛔ API key is required for ${this.getServiceName()} service`);
        }

        if (!model || model.trim() === '') {
            throw new Error(`⛔ Model name is required for ${this.getServiceName()} service`);
        }

        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * 紀錄生成開始的摘要資訊（共用）
     * @param config - 生成設定
     */
    protected logGenerationStart(config?: GenerateConfig): void {
        console.log(`🚩 Generating response using ${this.getServiceName()}...`);
        console.log(`+ Using model: ${this.model}`);
        console.log(`+ Max Output Tokens: ${config?.maxOutputTokens}`);
        console.log(`+ Temperature: ${config?.temperature}`);
        console.log(`+ ShowReviewContent: ${config?.showReviewContent}`);
    }

    /**
     * 取得服務名稱（由子類別實作）
     * @returns 服務名稱
     */
    protected abstract getServiceName(): string;

    /**
     * 生成評論內容（由子類別實作）
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定 (選用)
     * @returns AI 服務回應
     */
    public abstract generateComment(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): Promise<any>;

    /**
     * 印出送給 AI 的請求資訊
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定
     */
    protected printRequestInfo(systemInstruction: string, prompt: string, config: GenerateConfig): void {
        console.log('\n' + '='.repeat(80));
        console.log(`📋 ${this.getServiceName()} - Request Information`);
        console.log('='.repeat(80));
        console.log('📝 System Instruction:');
        console.log(systemInstruction || '(none)');
        console.log('='.repeat(80));
        console.log('📝 Prompt:');
        console.log(prompt);
        console.log('='.repeat(80));
        console.log('⚙️  Generation Config:');
        console.log(`   - Model: ${this.model}`);
        console.log(`   - Temperature: ${config.temperature ?? 'default'}`);
        console.log(`   - Max Output Tokens: ${config.maxOutputTokens ?? 'default'}`);
        console.log('='.repeat(80));
    }

    /**
     * 印出 AI 的回應資訊
     * @param content - AI 回應內容
     */
    protected printResponseInfo(content: string): void {
        console.log('\n' + '='.repeat(80));
        console.log(`🤖 ${this.getServiceName()} - Response`);
        console.log('='.repeat(80));
        console.log(content);
        console.log('='.repeat(80));
    }
}
