/**
 * 單一行內問題介面
 * 代表 AI 審查回傳的一個具體問題，包含精確的檔案路徑與行號
 */
export interface InlineIssue {
    /** 檔案路徑（以 / 開頭，例如 /src/index.ts） */
    file: string;
    /** 問題起始行號（1-based，對應新版本的右側差異） */
    lineStart: number;
    /** 問題結束行號（1-based，單行問題與 lineStart 相同） */
    lineEnd: number;
    /** 嚴重程度 */
    severity: 'critical' | 'warning' | 'suggestion';
    /** 問題分類（例如 Security, Logic, Performance, Convention） */
    category: string;
    /** 問題的詳細說明 */
    description: string;
    /** 修正建議（選用） */
    suggestion?: string;
}

/**
 * AI 行內審查結果介面
 * AI 在 Inline Comment 模式下必須回傳此格式的 JSON
 */
export interface InlineReviewResult {
    /** 整體審查摘要 */
    summary: {
        /** 審查狀態，例如 "🟢 Recommend Approval" */
        status: string;
        /** 摘要說明（建議 100 字以內） */
        conclusion: string;
    };
    /** 問題清單（最多 20 個） */
    issues: InlineIssue[];
}
