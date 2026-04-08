import { AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseHttpAIService } from './base-http-ai.service';
import { DEFAULT_MODELS, AI_PROVIDERS, CLAUDE_MODEL_MAX_TOKENS, CLAUDE_DEFAULT_MAX_TOKENS } from '../constants';

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
        // 轉換流程（支援使用者輸入易讀格式，如 "Claude Sonnet 4.6"）：
        // 1. BaseAIService 基礎正規化：trim + lowercase + 空白→破折號
        //    "Claude Sonnet 4.6" → "claude-sonnet-4.6"
        // 2. 此處先將版本號中的點轉為破折號，再交由 BaseAIService 正規化
        //    "claude-sonnet-4.6" → "claude-sonnet-4-6"
        // 傳入前先做版本號的點→破折號，BaseAIService 再做 trim/lowercase/spaces→dash
        super(apiKey, model.replaceAll(/(\.)(\d)/g, '-$2'));
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

        // 決定 max_tokens：
        // 1. 使用者明確指定時優先使用
        // 2. 已知模型查表（快取優化，避免不必要的重試）
        // 3. 未知新模型使用高預設值，若超限則由 generateComment 自動重試
        requestBody.max_tokens = config?.maxOutputTokens
            ?? CLAUDE_MODEL_MAX_TOKENS[this.model]
            ?? CLAUDE_DEFAULT_MAX_TOKENS;

        if (systemInstruction && systemInstruction.trim() !== '') {
            requestBody.system = systemInstruction;
        }

        if (config?.temperature !== undefined) {
            requestBody.temperature = config.temperature;
        }

        return requestBody;
    }

    /**
     * 生成評論內容（覆寫父類別以支援 max_tokens 自動解析）
     *
     * Anthropic API 在 max_tokens 超出模型上限時會回傳明確的錯誤訊息，
     * 格式為：「max_tokens: X > Y, which is the maximum allowed...」
     * 此方法捕獲該錯誤後，從訊息中解析出實際上限 Y，然後自動重試，
     * 確保新模型上線時無需手動更新任何 hardcoded 設定。
     */
    public override async generateComment(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): Promise<AIResponse> {
        // 若使用者已明確指定 maxOutputTokens，直接呼叫（尊重使用者設定，不重試）
        if (config?.maxOutputTokens !== undefined) {
            return super.generateComment(systemInstruction, prompt, config);
        }

        // 嘗試呼叫（max_tokens 由 getRequestBody 決定：查表或高預設值）
        // 若 Anthropic 回傳超限錯誤，自動從錯誤訊息解析實際上限並重試
        try {
            return await super.generateComment(systemInstruction, prompt, config);
        } catch (error: any) {
            // Anthropic 錯誤格式：
            // "max_tokens: 99999 > 16000, which is the maximum allowed number of output tokens for <model>"
            const maxMatch = error.message?.match(/max_tokens[^>]+>\s*(\d+)/);
            if (maxMatch) {
                const actualMax = Number.parseInt(maxMatch[1], 10);
                console.log(`⚠️ max_tokens exceeds limit for "${this.model}". Auto-detected actual limit: ${actualMax}. Retrying...`);
                const retryConfig: GenerateConfig = { ...config, maxOutputTokens: actualMax, showReviewContent: config?.showReviewContent ?? false };
                return await super.generateComment(systemInstruction, prompt, retryConfig);
            }
            throw error;
        }
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
