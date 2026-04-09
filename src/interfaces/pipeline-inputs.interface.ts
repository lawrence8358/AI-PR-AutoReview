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
    /** GitHub Token (選用，用於 GitHub Copilot Token 認證模式) */
    githubToken?: string;
    /** Server 位址 (選用，用於 GitHub Copilot 遠端 CLI Server 模式) */
    serverAddress?: string;
    /** 請求超時時間 (選用，用於 GitHub Copilot，單位：毫秒) */
    timeout?: number;
    /** Copilot CLI 路徑 (選用，明確指定 CLI 可執行檔位置) */
    copilotCliPath?: string;
    /** 系統指令 */
    systemInstruction: string;
    /** 回應語言 (例如 'Taiwanese (zh-TW)') */
    responseLanguage: string;
    /** 最大輸出 token 數 */
    maxOutputTokens?: number;
    /** 溫度值 (隨機性) */
    temperature: number;
    /** 要包含的檔案副檔名列表 */
    fileExtensions: string[];
    /** 要排除的二進位檔案副檔名列表 */
    binaryExtensions: string[];
    /** 啟用 AI 節流模式（預設 true，僅送差異；false 則送整個檔案） */
    enableThrottleMode: boolean;
    /** 顯示審核內容（預設 true，print 出送給 AI 以及回應的內容；false 則不顯示） */
    showReviewContent: boolean;
    /** 啟用增量 Diff 模式（預設 false，檢查所有 PR 變更；true 則僅檢查最後一次推送的變更） */
    enableIncrementalDiff: boolean;
    /** 啟用行內評論模式（預設 true，發精準行號標註的行內評論；false 則發單一總結評論） */
    enableInlineComments: boolean;
    /** 合併同一檔案的行內評論為單一區塊（預設 false） */
    groupInlineCommentsByFile: boolean;
    /** 嚴厲模式：true 時 AI 額外回報 suggestion 級別問題（預設 false，僅回報 critical / warning） */
    inlineStrictMode: boolean;
    /** 是否將審核結果寫回 PR（預設 true；false 時為 Debug 模式，不寫回 PR） */
    writeReviewResult: boolean;
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
