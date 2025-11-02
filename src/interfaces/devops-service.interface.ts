/**
 * DevOps 服務配置介面
 */
export interface DevOpsServiceConfig {
    /** 存取權杖 */
    accessToken: string;
    /** 組織 URL 或 Base URL */
    organizationUrl?: string;
}

/**
 * 檔案變更詳細資訊介面
 */
export interface FileChangeDetail {
    /** 檔案路徑 */
    path: string;
    /** 變更類型 */
    changeType: any;
    /** 變更內容 */
    content: string;
}

/**
 * DevOps 服務介面
 * 定義所有 DevOps 提供者（Azure DevOps、GitHub）必須實作的方法
 */
export interface DevOpsService {
    /**
     * 新增 Pull Request 評論
     * @param projectName - 專案名稱（對 GitHub 可能不使用）
     * @param repositoryId - Repository ID 或 owner/repo
     * @param pullRequestId - Pull Request ID
     * @param content - 評論內容
     * @param commentHeader - 評論標題
     * @returns 評論的 ID
     */
    addPullRequestComment(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        content: string,
        commentHeader?: string
    ): Promise<number>;

    /**
     * 取得 Pull Request 變更的檔案內容
     * @param projectName - 專案名稱（對 GitHub 可能不使用）
     * @param repositoryId - Repository ID 或 owner/repo
     * @param pullRequestId - Pull Request ID
     * @param fileExtensions - 要過濾的副檔名列表
     * @param binaryExtensions - 要排除的二進位檔案副檔名列表
     * @param enableThrottleMode - 啟用節流模式
     * @returns 變更內容的詳細資訊陣列，若無變更則返回 null
     */
    getPullRequestChanges(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        fileExtensions?: string[],
        binaryExtensions?: string[],
        enableThrottleMode?: boolean
    ): Promise<FileChangeDetail[] | null>;
}
