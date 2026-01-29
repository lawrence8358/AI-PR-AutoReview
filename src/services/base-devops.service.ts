import path from 'path';
import { DevOpsService, FileChangeDetail } from '../interfaces/devops-service.interface';

/**
 * 預設的二進位檔案副檔名列表
 */
export const DEFAULT_BINARY_EXTENSIONS: string[] = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.bin', '.dat', '.class',
    '.mp3', '.mp4', '.avi', '.mov', '.flv',
    ".md", ".markdown", ".txt", ".gitignore"
] as const;

/**
 * DevOps 服務基礎抽象類別
 * 提供共用的功能給所有 DevOps 服務實作
 */
export abstract class BaseDevOpsService implements DevOpsService {
    protected accessToken: string;
    protected organizationUrl?: string;

    /**
     * 建立 DevOps 服務基礎實例
     * @param accessToken - 存取權杖
     * @param organizationUrl - 組織 URL（選用）
     * @throws {Error} 當 accessToken 未提供時拋出錯誤
     */
    constructor(accessToken?: string, organizationUrl?: string) {
        if (!accessToken) {
            throw new Error('⛔ Access token is missing');
        }

        if (!organizationUrl) {
            throw new Error('⛔ Organization URL is missing');
        } 

        this.accessToken = accessToken;
        this.organizationUrl = organizationUrl;
    }

    /**
     * 取得服務提供者名稱（由子類別實作）
     * @returns 服務提供者名稱
     */
    protected abstract getProviderName(): string;

    /**
     * 新增 Pull Request 評論（由子類別實作）
     * @param projectName - 專案名稱
     * @param repositoryId - Repository ID
     * @param pullRequestId - Pull Request ID
     * @param content - 評論內容
     * @param commentHeader - 評論標題
     * @returns 評論的 ID
     */
    public abstract addPullRequestComment(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        content: string,
        commentHeader?: string
    ): Promise<number>;

    /**
     * 取得 Pull Request 變更的檔案內容（由子類別實作）
     * @param projectName - 專案名稱
     * @param repositoryId - Repository ID
     * @param pullRequestId - Pull Request ID
     * @param fileExtensions - 要過濾的副檔名列表
     * @param binaryExtensions - 要排除的二進位檔案副檔名列表
     * @param enableThrottleMode - 啟用節流模式
     * @param enableIncrementalDiff - 啟用增量 Diff 模式（僅檢查最後一次推送的變更）
     * @returns 變更內容的詳細資訊陣列
     */
    public abstract getPullRequestChanges(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        fileExtensions?: string[],
        binaryExtensions?: string[],
        enableThrottleMode?: boolean,
        enableIncrementalDiff?: boolean
    ): Promise<FileChangeDetail[] | null>;

    /**
     * 記錄開始取得 PR 變更的訊息
     * @param projectName - 專案名稱
     * @param repositoryId - Repository ID
     * @param pullRequestId - Pull Request ID
     * @param fileExtensions - 要過濾的副檔名列表
     * @param binaryExtensions - 要排除的二進位檔案副檔名列表
     * @param enableThrottleMode - 啟用節流模式
     */
    protected logRetrievingChangesStart(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        fileExtensions: string[],
        binaryExtensions: string[],
        enableThrottleMode: boolean
    ): void {
        console.log('🚩 Retrieving Pull Request changes...');
        console.log(`+ Provider: ${this.getProviderName()}`);
        if (projectName) console.log(`+ Project Name: ${projectName}`);
        console.log(`+ Repository ID: ${repositoryId}`);
        console.log(`+ Pull Request ID: ${pullRequestId}`);

        console.log(`+ FileExtensions: ${fileExtensions.length > 0 ? fileExtensions.join(', ') : 'None (all non-binary files)'}`);
        if (fileExtensions.length > 0) {
            console.log(`  + Filtering for extensions: ${fileExtensions.join(', ')}`);
        }

        console.log(`+ BinaryExtensions: ${binaryExtensions.length > 0 ? binaryExtensions.join(', ') : 'Using default list'}`);
        console.log(`  + Excluding binary extensions: ${binaryExtensions.join(', ')}`);

        console.log(`+ Throttle Mode: ${enableThrottleMode ? 'Enabled (diff only)' : 'Disabled (full content)'}`);
    }

    /**
     * 記錄完成取得 PR 變更的訊息
     * @param fileCount - 處理的檔案數量
     * @param enableThrottleMode - 啟用節流模式
     */
    protected logRetrievingChangesComplete(fileCount: number, enableThrottleMode: boolean): void {
        if (enableThrottleMode) {
            console.log(`✅ Completed diff comparison for ${fileCount} matching files`);
        } else {
            console.log(`✅ Retrieved full content for ${fileCount} matching files`);
        }
    }

    /**
     * 記錄無變更的訊息
     */
    protected logNoChanges(): void {
        console.log('❗ No matching code changes detected');
    }

    /**
     * 記錄開始新增評論的訊息
     */
    protected logAddCommentStart(): void {
        console.log('🚩 Adding Pull Request comment...');
        console.log(`+ Provider: ${this.getProviderName()}`);
    }

    /**
     * 記錄成功新增評論的訊息
     * @param id - 評論 ID
     */
    protected logAddCommentSuccess(id: number): void {
        console.log(`✅ Successfully added comment, ID: ${id}`);
    }

    /**
     * 確保二進位檔案副檔名列表有預設值
     * @param binaryExtensions - 輸入的二進位檔案副檔名列表
     * @returns 處理後的二進位檔案副檔名列表
     */
    protected ensureBinaryExtensions(binaryExtensions?: string[]): string[] {
        if (!binaryExtensions || binaryExtensions.length === 0) {
            return DEFAULT_BINARY_EXTENSIONS as string[];
        }
        return binaryExtensions;
    }

    /**
     * 檢查檔案是否應該被過濾（基於副檔名）
     * @param filePath - 檔案路徑
     * @param fileExtensions - 要包含的副檔名列表
     * @param binaryExtensions - 要排除的二進位檔案副檔名列表
     * @returns true 表示應該包含此檔案，false 表示應該過濾掉
     */
    protected shouldIncludeFile(
        filePath: string,
        fileExtensions: string[],
        binaryExtensions: string[]
    ): boolean {
        const fileExt = path.extname(filePath).toLowerCase();

        // 排除二進位檔案
        if (binaryExtensions.includes(fileExt)) {
            return false;
        }

        // 如果有指定副檔名，只包含符合的檔案
        if (fileExtensions.length > 0) {
            return fileExtensions.includes(fileExt);
        }

        // 沒有指定副檔名時，包含所有非二進位檔案
        return true;
    }

    /**
     * 記錄檔案過濾結果
     * @param totalFiles - 總檔案數
     * @param filteredFiles - 過濾後的檔案數
     * @param filePaths - 要處理的檔案路徑列表
     */
    protected logFilterResult(totalFiles: number, filteredFiles: number, filePaths: string[]): void {
        console.log(`🔍 Total changed files: ${totalFiles}, after filtering, ${filteredFiles} file changes remaining`);
        console.log(`📄 Files to be processed: ${filePaths.join(', ')}`);
    }

    /**
     * 格式化新增檔案的內容（每行前面加上 + 符號）
     * @param content - 原始檔案內容
     * @returns 格式化後的內容
     */
    protected formatAddedFileContent(content: string): string {
        return content
            .split('\n')
            .map(line => `+ ${line}`)
            .join('\n');
    }

    /**
     * 處理 git diff 或 patch 輸出結果（已優化以減少 Token 消耗）
     * 移除空白行、註釋和多餘的上下文
     * @param output - git diff 或 patch 命令的輸出內容
     * @returns 處理後的差異內容，只包含變更行和區塊標記
     */
    protected processDiffOutput(output: string): string {
        const lines = output.split('\n');
        const contentStart = lines.findIndex((line: string) => line.startsWith('@@'));
        if (contentStart === -1) return '';

        return lines
            .slice(contentStart)
            .filter((line: string) =>
                line.startsWith('+') ||
                line.startsWith('-') ||
                line.startsWith('@@')
            )
            // 移除空白行和只有空白的行
            .filter(line => line.trim().length > 1 || line.startsWith('@@'))
            // 移除開頭和結尾的空白
            .map(line => {
                if (line.startsWith('+') || line.startsWith('-')) {
                    return line.substring(0, 1) + line.substring(1).trim();
                }
                return line;
            })
            .join('\n');
    }

    /**
     * 記錄檔案處理進度（針對新增檔案）
     * @param filePath - 檔案路徑
     * @param enableThrottleMode - 是否啟用節流模式
     */
    protected logProcessAddedFile(filePath: string, enableThrottleMode: boolean): void {
        if (enableThrottleMode) {
            console.log(`🆕 Retrieved diff content for new file: ${filePath}`);
        } else {
            console.log(`🆕 Retrieved full content for new file: ${filePath}`);
        }
    }

    /**
     * 記錄檔案處理進度（針對編輯檔案）
     * @param filePath - 檔案路徑
     * @param enableThrottleMode - 是否啟用節流模式
     */
    protected logProcessEditedFile(filePath: string, enableThrottleMode: boolean): void {
        if (enableThrottleMode) {
            console.log(`✏️ Retrieved diff content for edited file: ${filePath}`);
        } else {
            console.log(`✏️ Retrieved full content for edited file: ${filePath}`);
        }
    }
}
