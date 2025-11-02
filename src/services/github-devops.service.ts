import { Octokit } from '@octokit/rest';
import path from 'path';
import { BaseDevOpsService } from './base-devops.service';
import { FileChangeDetail } from '../interfaces/devops-service.interface';

/**
 * GitHub 服務類別
 * 處理與 GitHub 相關的 API 操作，包含 PR 變更檢查等功能
 */
export class GitHubDevOpsService extends BaseDevOpsService {
    private client: Octokit;

    /**
     * 建立 GitHubDevOpsService 實例
     * @param accessToken - GitHub 個人存取權杖（必要）
     * @param baseUrl - 可選的 GitHub Enterprise API 根網址；若不提供或為 github.com，
     *                  會使用預設的 public GitHub API（api.github.com）。
     * @throws {Error} 當 accessToken 未提供時拋出錯誤
     */
    constructor(accessToken?: string, baseUrl?: string) {
        super(accessToken, baseUrl);

        const opts: any = { auth: this.accessToken };

        if (baseUrl) {
            // 正規化 baseUrl：去除前後空白與尾端斜線，避免產生重複斜線
            const trimmed = baseUrl.trim().replace(/\/+$/g, '');
            try {
                const parsed = new URL(trimmed);
                // 若 host 為 github.com，則不要覆寫 Octokit 的預設 baseUrl（使用 public API）
                if (!/github\.com$/i.test(parsed.hostname)) {
                    // 針對企業版（Enterprise）或自訂 API 主機，才將 baseUrl 傳給 Octokit
                    opts.baseUrl = trimmed;
                }
            } catch (e) {
                // 若不是完整 URL，則直接使用 trim 後的字串（保留使用者輸入的原始樣式）
                opts.baseUrl = trimmed;
            }
        }

        this.client = new Octokit(opts);
    }

    /**
     * 取得服務提供者名稱
     * @returns 服務提供者名稱
     */
    protected getProviderName(): string {
        return 'GitHub';
    }

    /**
     * 新增 Pull Request 評論（使用 GitHub issues API）
     * @param projectName - 專案名稱（GitHub 不使用此參數）
     * @param repositoryId - owner/repo 格式
     * @param pullRequestId - PR 編號
     * @param content - 評論內容
     * @param commentHeader - 評論標題
     * @returns 新增評論的 ID
     * @throws {Error} 當格式不符或新增失敗時拋出錯誤
     */
    public async addPullRequestComment(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        content: string,
        commentHeader: string = ''
    ): Promise<number> {
        this.logAddCommentStart();

        const { owner, repo } = this.parseOwnerRepo(repositoryId);

        // 寫入評論內容
        const commentContent = commentHeader ? `# ${commentHeader}\n${content}` : content;

        const res = await this.client.rest.issues.createComment({
            owner,
            repo,
            issue_number: pullRequestId,
            body: commentContent
        });

        if (!res || !res.data || typeof res.data.id === 'undefined') {
            throw new Error('⛔ Failed to create GitHub comment');
        }

        const commentId = Number(res.data.id as any);
        this.logAddCommentSuccess(commentId);
        return commentId;
    }

    /**
     * 取得 Pull Request 的變更檔案與內容
     * @param projectName - 專案名稱（GitHub 不使用此參數）
     * @param repositoryId - owner/repo 格式
     * @param pullRequestId - PR 編號
     * @param fileExtensions - 要包含的副檔名列表（例如 ['.ts']），若為空則表示所有非二進位檔案
     * @param binaryExtensions - 要排除的二進位副檔名列表
     * @param enableThrottleMode - 節流模式：true 表示僅取差異 (patch)，false 表示取完整檔案內容
     * @returns 變更詳細資訊陣列，格式為 { path, changeType, content }，若無變更則返回 null
     */
    public async getPullRequestChanges(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        fileExtensions: string[] = [],
        binaryExtensions: string[] = [],
        enableThrottleMode: boolean = true
    ): Promise<FileChangeDetail[] | null> {
        // 確保二進位檔案副檔名有預設值
        binaryExtensions = this.ensureBinaryExtensions(binaryExtensions);

        // 記錄開始處理
        this.logRetrievingChangesStart(
            projectName,
            repositoryId,
            pullRequestId,
            fileExtensions,
            binaryExtensions,
            enableThrottleMode
        );

        const { owner, repo } = this.parseOwnerRepo(repositoryId);

        const prInfo = await this.client.rest.pulls.get({
            owner,
            repo,
            pull_number: pullRequestId
        });
        const headSha = prInfo.data.head?.sha;

        const files = await this.client.paginate(
            this.client.rest.pulls.listFiles,
            { owner, repo, pull_number: pullRequestId }
        );

        if (!files || files.length === 0) {
            this.logNoChanges();
            return null;
        }

        const ghChangeEntries = files.map((f: any) => ({
            path: f.filename,
            status: f.status,
            patch: (f as any).patch
        }));

        const filteredGh = ghChangeEntries.filter((entry: any) => {
            if (entry.status === 'removed') return false;

            const fileExt = path.extname(entry.path).toLowerCase();

            // 如果沒有 patch 且是二進位檔案，則排除
            if (!entry.patch && binaryExtensions.includes(fileExt)) {
                return false;
            }

            // 使用基礎類別的過濾邏輯
            if (!this.shouldIncludeFile(entry.path, fileExtensions, binaryExtensions)) {
                return false;
            }

            // 若有 patch 或不是二進位檔案，則包含
            return !!entry.patch || !binaryExtensions.includes(fileExt);
        });

        if (filteredGh.length === 0) {
            this.logNoChanges();
            return null;
        }

        this.logFilterResult(
            ghChangeEntries.length,
            filteredGh.length,
            filteredGh.map(e => e.path)
        );

        const changeDetails = await Promise.all(filteredGh.map(async (f: any) => {
            let content = '';
            const filePath = f.path;
            try {
                if (enableThrottleMode) {
                    if (f.patch) {
                        // Use patch as diff-like content
                        content = this.processDiffOutput(f.patch as string);
                        this.logProcessEditedFile(filePath, true);
                    } else if (headSha) {
                        content = await this.getGitHubFileContent(owner, repo, filePath, headSha);
                        this.logProcessAddedFile(filePath, true);
                    }
                } else {
                    if (headSha) {
                        content = await this.getGitHubFileContent(owner, repo, filePath, headSha);
                        this.logProcessEditedFile(filePath, false);
                    }
                }
            } catch (err) {
                console.error(`Error getting GitHub changes for ${filePath}:`, err);
                content = 'Unable to get PR change content';
            }
            return {
                path: filePath,
                changeType: (f as any).status || 'modified',
                content
            };
        }));

        this.logRetrievingChangesComplete(changeDetails.length, enableThrottleMode);
        return changeDetails;
    }

    //#region Private Methods

    /**
     * 解析 repositoryId (owner/repo)
     * @param repositoryId - 期望格式為 "owner/repo"
     * @returns { owner, repo }
     * @throws 當格式不符時會丟出錯誤
     */
    private parseOwnerRepo(repositoryId: string): { owner: string; repo: string } {
        const parts = repositoryId.split('/');
        if (parts.length < 2) {
            throw new Error('⛔ For GitHub provider repositoryId must be "owner/repo"');
        }
        return { owner: parts[0], repo: parts.slice(1).join('/') };
    }

    /**
     * 取得 GitHub 檔案內容並解碼（base64）
     * @param owner - repository owner
     * @param repo - repository 名稱
     * @param filepath - 檔案路徑
     * @param ref - commit SHA 或 branch
     * @returns 檔案內容
     */
    private async getGitHubFileContent(
        owner: string,
        repo: string,
        filepath: string,
        ref?: string
    ): Promise<string> {
        const res = await this.client.rest.repos.getContent({
            owner,
            repo,
            path: filepath,
            ref
        });
        const data: any = res.data;
        if (Array.isArray(data)) return '';
        if (data && data.content) {
            const buff = Buffer.from(data.content, 'base64');
            return buff.toString('utf8');
        }
        return '';
    }

    //#endregion
}
