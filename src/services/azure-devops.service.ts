import * as azdev from 'azure-devops-node-api';
import { IGitApi } from 'azure-devops-node-api/GitApi';
import {
    GitPullRequestIterationChanges,
    VersionControlChangeType
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { Readable } from 'stream';
import path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseDevOpsService } from './base-devops.service';
import { FileChangeDetail } from '../interfaces/devops-service.interface';

/**
 * Azure DevOps API 服務類別
 * 處理與 Azure DevOps 相關的 API 操作，包含 PR 變更檢查等功能
 */
export class AzureDevOpsService extends BaseDevOpsService {
    private connection: azdev.WebApi;

    /**
     * 建立 AzureDevOpsService 實例
     * @param accessToken - Azure DevOps 存取權杖
     * @param organizationUrl - Azure DevOps 組織 URL
     * @throws {Error} 當 accessToken 或 organizationUrl 未提供時拋出錯誤
     */
    constructor(accessToken?: string, organizationUrl?: string) {
        super(accessToken, organizationUrl);
 
        const authHandler = azdev.getPersonalAccessTokenHandler(this.accessToken);
        this.connection = new azdev.WebApi(organizationUrl!, authHandler);
    }

    /**
     * 取得服務提供者名稱
     * @returns 服務提供者名稱
     */
    protected getProviderName(): string {
        return 'Azure DevOps';
    }

    /**
     * 新增 Pull Request 評論
     * @param projectName - 專案 ID
     * @param repositoryId - Repository ID
     * @param pullRequestId - Pull Request ID
     * @param content - 評論內容
     * @param commentHeader - 評論標題，預設為空
     * @returns 評論的 Thread ID
     * @throws {Error} 當評論新增失敗時拋出錯誤
     */
    public async addPullRequestComment(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        content: string,
        commentHeader: string = ''
    ): Promise<number> {
        this.logAddCommentStart();

        // 寫入評論內容
        const commentContent = commentHeader ? `# ${commentHeader}\n${content}` : content;

        const gitApi = await this.getGitApi();

        try {
            const thread = await gitApi.createThread(
                {
                    comments: [{
                        parentCommentId: 0,
                        content: commentContent,
                        commentType: 1 // CommentType.text = 1
                    }],
                    status: 1 // CommentThreadStatus.active = 1
                },
                repositoryId,
                pullRequestId,
                projectName
            );

            if (!thread || !thread.id) {
                throw new Error('⛔ Failed to create comment thread');
            }

            this.logAddCommentSuccess(thread.id);
            return thread.id;
        } catch (error) {
            console.error('⛔ Error adding comment:', error);
            if (error instanceof Error && error.message.includes('403')) {
                console.error('⛔ Insufficient permissions. Please ensure Build Service account has "Contribute to pull requests" permission');
            }
            throw error;
        }
    }

    /**
     * 取得 Pull Request 本次變更的檔案內容
     * @param projectName - 專案 ID
     * @param repositoryId - Repository ID
     * @param pullRequestId - Pull Request ID
     * @param fileExtensions - 要過濾的副檔名列表，例如 ['.ts', '.js']，若為空則檢查所有非二進位檔案
     * @param binaryExtensions - 要排除的二進位檔案副檔名列表
     * @param enableThrottleMode - 啟用節流模式（預設 true，僅送差異；false 則送整個檔案）
     * @returns 變更內容的詳細資訊，包含檔案路徑和變更內容
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

        const gitApi = await this.getGitApi();

        // 驗證 PR 變更
        const verificationResult = await this.verifyPullRequestChanges(
            gitApi,
            projectName,
            repositoryId,
            pullRequestId
        );

        if (!verificationResult) {
            this.logNoChanges();
            return null;
        }

        const { changes } = verificationResult;

        // 過濾變更檔案
        const filteredChanges = this.filterChangeEntries(
            changes.changeEntries,
            fileExtensions,
            binaryExtensions
        );

        if (filteredChanges.length === 0) {
            this.logNoChanges();
            return null;
        }

        // 取得每個檔案的變更內容
        const changeDetails = await this.getChangeDetails(
            filteredChanges,
            gitApi,
            repositoryId,
            projectName,
            enableThrottleMode
        );

        this.logRetrievingChangesComplete(changeDetails.length, enableThrottleMode);
        return changeDetails;
    }

    //#region Private Methods

    /**
     * 取得 Git API
     */
    private async getGitApi(): Promise<IGitApi> {
        return this.connection.getGitApi();
    }

    /**
     * 檢查 Pull Request 變更情況
     * @param gitApi - Git API 實例
     * @param projectName - 專案 ID
     * @param repositoryId - Repository ID
     * @param pullRequestId - Pull Request ID
     * @returns PR 變更資訊，若檢查失敗則返回 null
     */
    private async verifyPullRequestChanges(
        gitApi: IGitApi,
        projectName: string,
        repositoryId: string,
        pullRequestId: number
    ): Promise<{ changes: GitPullRequestIterationChanges } | null> {
        // 取得 Pull Request 資訊
        const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, projectName);
        if (!pr || !pr.lastMergeSourceCommit || !pr.lastMergeTargetCommit) {
            throw new Error('⛔ Unable to get Pull Request information');
        }

        // 取得最新的 PR iteration
        const iterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, projectName);
        if (!iterations || iterations.length === 0) {
            console.log('❗ No PR iterations found');
            return null;
        }

        // 取得最新的 iteration
        const latestIteration = iterations[iterations.length - 1];
        if (!latestIteration || latestIteration.id === undefined) {
            console.log('❗ Unable to get latest PR iteration');
            return null;
        }

        // 取得 PR 的變更檔案清單
        const changes = await gitApi.getPullRequestIterationChanges(
            repositoryId,
            pullRequestId,
            latestIteration.id
        );

        if (!changes.changeEntries || changes.changeEntries.length === 0) {
            console.log('❗ No code changes detected');
            return null;
        }

        return { changes };
    }

    /**
     * 過濾變更檔案條目
     * @param changeEntries - PR 變更檔案列表
     * @param fileExtensions - 要過濾的副檔名列表
     * @param binaryExtensions - 要排除的二進位檔案副檔名列表
     * @returns 過濾後的變更檔案列表
     */
    private filterChangeEntries(
        changeEntries: GitPullRequestIterationChanges["changeEntries"],
        fileExtensions: string[],
        binaryExtensions: string[]
    ) {
        if (!changeEntries) return [];

        const filteredEntries = changeEntries.filter(change => {
            // 排除刪除的檔案
            if (change.changeType === VersionControlChangeType.Delete) {
                return false;
            }

            const filePath = change.item?.path;
            if (!filePath) return false;

            return this.shouldIncludeFile(filePath, fileExtensions, binaryExtensions);
        });

        this.logFilterResult(
            changeEntries.length,
            filteredEntries.length,
            filteredEntries.map(e => e.item?.path || '').filter(p => p)
        );

        return filteredEntries;
    }

    /**
     * 取得檔案變更的詳細內容
     * @param changes - 變更檔案列表
     * @param gitApi - Git API 實例
     * @param repositoryId - Repository ID
     * @param projectName - 專案 ID
     * @param enableThrottleMode - 啟用節流模式（預設 true，僅送差異；false 則送整個檔案）
     * @returns 檔案變更的詳細資訊，包含檔案路徑和差異內容
     */
    private async getChangeDetails(
        changes: GitPullRequestIterationChanges["changeEntries"],
        gitApi: IGitApi,
        repositoryId: string,
        projectName: string,
        enableThrottleMode: boolean = true
    ): Promise<FileChangeDetail[]> {
        if (!changes) return [];

        return Promise.all(
            changes.map(async (change) => {
                const filePath = change.item!.path!;
                let content = '';

                if (change.item) {
                    try {
                        const sourceContent = await this.getFileContent(
                            gitApi,
                            repositoryId,
                            projectName,
                            change.item.objectId!
                        );

                        // 類型如果是新增
                        if (change.changeType === VersionControlChangeType.Add) {
                            if (enableThrottleMode) {
                                content = this.formatAddedFileContent(sourceContent);
                                this.logProcessAddedFile(filePath, true);
                            } else {
                                content = sourceContent;
                                this.logProcessAddedFile(filePath, false);
                            }
                        }

                        // 類型如果是編輯
                        if (change.changeType === VersionControlChangeType.Edit && change.item.originalObjectId) {
                            if (enableThrottleMode) {
                                const targetContent = await this.getFileContent(
                                    gitApi,
                                    repositoryId,
                                    projectName,
                                    change.item.originalObjectId
                                );
                                content = await this.getDiffContent(sourceContent, targetContent);
                                this.logProcessEditedFile(filePath, true);
                            } else {
                                content = sourceContent;
                                this.logProcessEditedFile(filePath, false);
                            }
                        }
                    } catch (error) {
                        console.error(`Error getting changes for ${filePath}:`, error);
                        content = 'Unable to get PR change content';
                    }
                }

                return {
                    path: filePath,
                    changeType: change.changeType,
                    content: content
                };
            })
        );
    }

    /**
     * 取得檔案內容
     * @param gitApi - Git API 實例
     * @param repositoryId - Repository ID
     * @param projectName - 專案 ID
     * @param objectId - 檔案物件 ID
     * @returns 檔案內容
     */
    private async getFileContent(
        gitApi: IGitApi,
        repositoryId: string,
        projectName: string,
        objectId: string
    ): Promise<string> {
        const blobContent = await gitApi.getBlobContent(
            repositoryId,
            objectId,
            projectName,
            true
        );

        if (blobContent instanceof Readable) {
            return this.readStreamContent(blobContent);
        }

        return '';
    }

    /**
     * 從 Readable stream 讀取內容
     * @param stream - Readable stream
     * @returns 檔案內容字串
     */
    private async readStreamContent(stream: Readable): Promise<string> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf8');
    }

    /**
     * 執行命令的非同步方法
     */
    private readonly execAsync = promisify(exec);

    /**
     * 使用 git diff 取得檔案差異
     * @param newContent - 新版本內容
     * @param oldContent - 舊版本內容
     * @returns 差異內容
     */
    private async getDiffContent(newContent: string, oldContent: string): Promise<string> {
        // 建立臨時檔案
        const tempPath = os.tmpdir();
        const randomId = Math.random().toString(36).substring(2, 15);
        const oldFile = path.join(tempPath, `old-${randomId}.tmp`);
        const newFile = path.join(tempPath, `new-${randomId}.tmp`);

        try {
            // 寫入臨時檔案
            await fs.writeFile(oldFile, oldContent);
            await fs.writeFile(newFile, newContent);

            try {
                // 使用 git diff 比較檔案
                const { stdout } = await this.execAsync(`git diff --no-index "${oldFile}" "${newFile}"`);
                return this.processDiffOutput(stdout);
            } catch (error: any) {
                // git diff 在有差異時會回傳 exit code 1，這是正常的
                if (error.code === 1 && error.stdout) {
                    return this.processDiffOutput(error.stdout);
                }

                throw new Error(`⛔ Error in git diff: ${error.message}`);
            }
        } finally {
            // 清理臨時檔案
            await Promise.all([
                fs.unlink(oldFile).catch(() => { }),
                fs.unlink(newFile).catch(() => { })
            ]);
        }
    }

    //#endregion
}
