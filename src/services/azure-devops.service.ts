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
     * @param enableIncrementalDiff - 啟用增量 Diff 模式（預設 false，檢查所有 PR 變更；true 則僅檢查最後一次推送的變更）
     * @returns 變更內容的詳細資訊，包含檔案路徑和變更內容
     */
    public async getPullRequestChanges(
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        fileExtensions: string[] = [],
        binaryExtensions: string[] = [],
        enableThrottleMode: boolean = true,
        enableIncrementalDiff: boolean = false
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

        if (enableIncrementalDiff) {
            console.log('🔄 Incremental Diff Mode: Enabled - Only the latest push changes will be reviewed');
        }

        const gitApi = await this.getGitApi();

        // 驗證 PR 變更
        const verificationResult = await this.verifyPullRequestChanges(
            gitApi,
            projectName,
            repositoryId,
            pullRequestId,
            enableIncrementalDiff
        );

        if (!verificationResult) {
            this.logNoChanges();
            return null;
        }

        const { changes, previousChanges } = verificationResult;

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
            enableThrottleMode,
            enableIncrementalDiff,
            previousChanges
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
     * @param enableIncrementalDiff - 啟用增量 Diff 模式（僅檢查最後一次推送的變更）
     * @returns PR 變更資訊，若檢查失敗則返回 null
     */
    private async verifyPullRequestChanges(
        gitApi: IGitApi,
        projectName: string,
        repositoryId: string,
        pullRequestId: number,
        enableIncrementalDiff: boolean = false
    ): Promise<{ changes: GitPullRequestIterationChanges; previousChanges?: GitPullRequestIterationChanges["changeEntries"] } | null> {
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


        // 根據增量 diff 模式選擇要審查的 iteration
        let targetIteration;
        let previousIteration;

        if (enableIncrementalDiff && iterations.length > 1) {
            // 增量模式：只獲取最後一次推送的變更
            // 獲取最後一個 iteration 與前一個 iteration 之間的變更
            targetIteration = iterations[iterations.length - 1];
            previousIteration = iterations[iterations.length - 2];
            console.log(`📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push (comparing iteration ${targetIteration.id} against iteration ${previousIteration.id})`);
        } else if (enableIncrementalDiff && iterations.length === 1) {
            // 增量模式但只有 1 個 iteration：此時增量 diff 等同於全量 diff
            targetIteration = iterations[0];
            console.log(`📍 Incremental Diff Mode: Only 1 iteration found - reviewing all PR changes (equivalent to full diff)`);
        } else {
            // 全量模式：獲取 PR 相對於基礎分支的所有變更
            // 使用最後一個 iteration（它代表與基礎分支的完整差異）
            targetIteration = iterations[iterations.length - 1];
            console.log(`📍 Full Diff Mode: Reviewing all PR changes from base branch`);
        }

        if (!targetIteration || targetIteration.id === undefined) {
            console.log('❗ Unable to get target PR iteration');
            return null;
        }

        // 取得 PR 的變更檔案清單
        let changes = await gitApi.getPullRequestIterationChanges(
            repositoryId,
            pullRequestId,
            targetIteration.id
        );

        let previousChanges: GitPullRequestIterationChanges["changeEntries"] | undefined;

        // 如果在增量模式下，需要計算只包含最新 push 的變更
        if (enableIncrementalDiff && previousIteration && previousIteration.id !== undefined) {
            // 獲取前一個 iteration 的變更以進行比較
            const previousIterationChanges = await gitApi.getPullRequestIterationChanges(
                repositoryId,
                pullRequestId,
                previousIteration.id
            );

            // 計算增量變更（只保留在最新 iteration 中新增或修改的檔案）
            changes = this.calculateIncrementalChanges(changes, previousIterationChanges);
            previousChanges = previousIterationChanges.changeEntries;
            console.log(`ℹ️ Only changes from the latest push will be included`);
        }

        if (!changes.changeEntries || changes.changeEntries.length === 0) {
            console.log('❗ No code changes detected');
            return null;
        }

        return { changes, previousChanges };
    }

    /**
     * 計算增量變更（只保留最新 push 中的變更）
     * @param currentChanges - 目前 iteration 的變更
     * @param previousChanges - 前一個 iteration 的變更
     * @returns 僅包含最新 push 變更的 GitPullRequestIterationChanges
     */
    private calculateIncrementalChanges(
        currentChanges: GitPullRequestIterationChanges,
        previousChanges: GitPullRequestIterationChanges
    ): GitPullRequestIterationChanges {
        if (!currentChanges.changeEntries) {
            return currentChanges;
        }

        const previousPaths = new Set(
            previousChanges.changeEntries?.map(e => e.item?.path) || []
        );

        const incrementalEntries = currentChanges.changeEntries.filter(change => {
            const currentPath = change.item?.path;

            // 保留在前一個 iteration 中不存在的檔案（新增的）
            if (!previousPaths.has(currentPath)) {
                return true;
            }

            // 對於存在的檔案，我們需要確定它是否在最新 push 中被修改
            // 由於 iteration 中的 objectId 會改變，我們可以通過比較來判斷
            const previousChange = previousChanges.changeEntries?.find(
                e => e.item?.path === currentPath
            );

            // 如果 objectId 不同，說明檔案在最新 push 中被修改了
            if (previousChange && change.item?.objectId !== previousChange.item?.objectId) {
                return true;
            }

            return false;
        });

        return {
            ...currentChanges,
            changeEntries: incrementalEntries
        };
    }

    /**
     * 從差異內容中提取只包含新增和修改的行
     * @param diffContent - 完整的 diff 內容
     * @returns 只包含新增和修改行的 diff
     */
    private extractIncrementalDiffLines(diffContent: string): string {
        if (!diffContent) return '';

        const lines = diffContent.split('\n');
        const incrementalLines: string[] = [];
        let currentSection = '';

        for (const line of lines) {
            // 保留 diff header 行
            if (line.startsWith('diff --git') ||
                line.startsWith('index ') ||
                line.startsWith('---') ||
                line.startsWith('+++') ||
                line.startsWith('@@')) {
                incrementalLines.push(line);
                currentSection = line;
            }
            // 保留新增行（+開頭，但不是 +++）
            else if (line.startsWith('+') && !line.startsWith('+++')) {
                incrementalLines.push(line);
            }
            // 保留修改行前後的上下文（-開頭的舊行，但不是 ---）
            else if (line.startsWith('-') && !line.startsWith('---')) {
                incrementalLines.push(line);
            }
            // 保留一些上下文行（空行或普通行，用於理解修改的上下文）
            else if (line.startsWith(' ') || line === '') {
                // 只在有新增或修改行附近時才保留上下文
                if (incrementalLines.length > 0) {
                    incrementalLines.push(line);
                }
            }
        }

        return incrementalLines.join('\n');
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
     * @param enableIncrementalDiff - 啟用增量 Diff 模式（預設 false，檢查所有 PR 變更；true 則僅檢查最後一次推送的變更）
     * @param previousIterationChanges - 前一個 iteration 的變更（用於增量模式）
     * @returns 檔案變更的詳細資訊，包含檔案路徑和差異內容
     */
    private async getChangeDetails(
        changes: GitPullRequestIterationChanges["changeEntries"],
        gitApi: IGitApi,
        repositoryId: string,
        projectName: string,
        enableThrottleMode: boolean = true,
        enableIncrementalDiff: boolean = false,
        previousIterationChanges?: GitPullRequestIterationChanges["changeEntries"]
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
                        if (change.changeType === VersionControlChangeType.Edit) {
                            if (enableThrottleMode) {
                                let targetContent = '';

                                // 在增量模式下，從前一個 iteration 獲取舊版本
                                // 否則使用 originalObjectId（與基礎分支的比較）
                                if (enableIncrementalDiff && previousIterationChanges) {
                                    const previousChange = previousIterationChanges.find(
                                        c => c.item?.path === filePath
                                    );
                                    if (previousChange && previousChange.item?.objectId) {
                                        // 從前一個 iteration 獲取檔案版本
                                        targetContent = await this.getFileContent(
                                            gitApi,
                                            repositoryId,
                                            projectName,
                                            previousChange.item.objectId
                                        );
                                    }
                                } else if (change.item.originalObjectId) {
                                    // 使用原始版本（通常是基礎分支）
                                    targetContent = await this.getFileContent(
                                        gitApi,
                                        repositoryId,
                                        projectName,
                                        change.item.originalObjectId
                                    );
                                }

                                if (targetContent) {
                                    content = await this.getDiffContent(sourceContent, targetContent);
                                } else {
                                    // 如果無法獲取目標內容，顯示整個源內容
                                    content = this.formatAddedFileContent(sourceContent);
                                }

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
