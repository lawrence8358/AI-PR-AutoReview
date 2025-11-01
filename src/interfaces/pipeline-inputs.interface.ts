/**
 * Azure DevOps Pipeline 輸入參數介面
 */
export interface PipelineInputs {
    /** AI 提供者名稱 */
    aiProvider: string;
    /** AI 模型名稱 */
    modelName: string;
    /** AI 模型 API 金鑰 */
    modelKey: string;
    /** 系統指令 */
    systemInstruction: string;
    /** 提示詞範本 */
    promptTemplate: string;
    /** 最大輸出 token 數 */
    maxOutputTokens: number;
    /** 溫度值 (隨機性) */
    temperature: number;
    /** 要包含的檔案副檔名列表 */
    fileExtensions: string[];
    /** 要排除的二進位檔案副檔名列表 */
    binaryExtensions: string[];
    /** 啟用 AI 節流模式（預設 true，僅送差異；false 則送整個檔案） */
    enableThrottleMode: boolean;
    /** 顯示審核內容（預設 false，不顯示；true 則 print 出送給 AI 以及回應的內容） */
    showReviewContent: boolean;
}

/**
 * Azure DevOps 連線資訊介面
 */
export interface DevOpsConnection {
    /** 存取權杖 */
    accessToken: string;
    /** 組織 URL */
    collectionUri: string;
    /** 專案名稱 */
    projectName: string;
    /** Repository ID */
    repositoryId: string;
    /** Pull Request ID */
    pullRequestId: number;
}
