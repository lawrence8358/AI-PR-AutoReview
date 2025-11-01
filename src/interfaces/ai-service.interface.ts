/**
 * AI 服務回應介面
 */
export interface AIResponse {
    /** 回應內容 */
    content: string; 
}

/**
 * AI 服務生成設定介面
 */
export interface GenerateConfig {
    /** 最大輸出 token 數 (選用) */
    maxOutputTokens?: number;
    /** 溫度值 (隨機性) (選用) */
    temperature?: number;
    /** 顯示審核內容（印出送給 AI 的內容和回應） */
    showReviewContent: boolean;
}

/**
 * AI 服務基礎介面
 */
export interface AIService {
    /**
     * 生成評論內容
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定 (選用)
     * @returns AI 服務回應
     */
    generateComment(systemInstruction: string, prompt: string, config?: GenerateConfig): Promise<AIResponse>;
}

/**
 * AI 服務提供者設定介面
 */
export interface AIServiceConfig {
    /** API 金鑰 */
    apiKey: string;
    /** 模型名稱 */
    modelName: string;
    /** API 端點 (選用) */
    apiEndpoint?: string;
}