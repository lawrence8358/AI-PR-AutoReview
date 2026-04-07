import { AIService, AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';
import { DEFAULT_MODELS, AI_PROVIDERS } from '../constants';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { CopilotClient, SessionConfig } from '@github/copilot-sdk';

/**
 * GitHub Copilot AI 服務實作
 * 支援三種認證模式：
 * 1. Token 模式：提供 GitHub Token（適用於雲端 CI 環境）
 * 2. 遠端 CLI Server 模式：提供 Server Address（適用於集中式架構）
 * 3. 本機 CLI 模式：不提供任何參數（使用 Build Agent 預先設定的授權）
 *
 * 注意：此服務直接實作 AIService 介面，不繼承 BaseAIService
 * 因為 GitHub Copilot 的認證機制與傳統 API Key 不同
 */
export class GithubCopilotService implements AIService {
    readonly githubToken: string;
    readonly serverAddress: string;
    readonly copilotCliPath: string;
    readonly model: string;
    readonly timeout: number;
    private client?: CopilotClient; // CopilotClient 實例，延遲初始化
    private approveAll: any; // SDK approveAll helper，延遲初始化

    /**
     * 建立 GitHub Copilot 服務實例
     * @param githubToken - GitHub Token (格式: github_pat_xxx, gho_xxx, ghu_xxx)。用於 Token 認證模式
     * @param serverAddress - CLI Server 位址 (格式: host:port)。用於遠端 CLI Server 模式
     * @param model - 模型名稱，預設為 'gpt-5-mini'
     * @param timeout - 請求超時時間（毫秒）。若未提供，預設為 60000 ms (1分鐘)
     * @param copilotCliPath - Copilot CLI 可執行檔路徑（選用）。未提供時自動從 node_modules 探索
     * @throws {Error} 當參數格式錯誤或參數互斥時拋出錯誤
     */
    constructor(githubToken?: string, serverAddress?: string, model: string = DEFAULT_MODELS[AI_PROVIDERS.GITHUB_COPILOT], timeout?: number, copilotCliPath?: string) {
        // 參數互斥驗證：githubToken 和 serverAddress 不能同時提供
        if (githubToken && githubToken.trim() !== '' && serverAddress && serverAddress.trim() !== '') {
            throw new Error('⛔ GitHub Token and CLI Server Address cannot be provided at the same time. Please choose one authentication method.');
        }

        // Token 類型驗證：不支援 Classic personal access token (ghp_)
        if (githubToken && githubToken.trim() !== '') {
            if (githubToken.startsWith('ghp_')) {
                throw new Error('⛔ Classic personal access tokens (ghp_) are not supported. Please use Fine-grained personal access token (github_pat_).');
            }
            this.githubToken = githubToken.trim();
        } else {
            this.githubToken = '';
        }

        // 如果提供了 serverAddress，則驗證格式
        if (serverAddress && serverAddress.trim() !== '') {
            this.parseServerAddress(serverAddress);
            this.serverAddress = serverAddress;
        } else {
            this.serverAddress = ''; // 空字串表示使用本機 CLI
        }

        // 處理 copilotCliPath：優先使用明確提供的路徑，其次環境變數，最後自動探索
        this.copilotCliPath = (copilotCliPath && copilotCliPath.trim() !== '') ? copilotCliPath.trim()
            : (process.env.COPILOT_CLI_PATH && process.env.COPILOT_CLI_PATH.trim() !== '') ? process.env.COPILOT_CLI_PATH.trim()
                : '';

        this.model = model || 'gpt-5-mini';
        // 處理 timeout：如果提供了值則使用，否則預設 60000 ms
        this.timeout = timeout !== undefined ? timeout : 60000;
    }

    /**
     * 生成評論內容
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定 (選用)
     * @returns AI 服務回應
     */
    public async generateComment(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): Promise<AIResponse> {
        // 確保 Client 已初始化
        await this.initializeClient();

        // 記錄生成開始
        this.logGenerationStart(config);

        // 如果啟用顯示審核內容，印出請求資訊
        if (config?.showReviewContent) {
            this.printRequestInfo(systemInstruction, prompt, config);
        }

        try {
            // 建立 Session（啟用串流模式以提升回應速度）
            const requestOptions = {
                model: this.model,
                // streaming: true, // 啟用串流模式
                systemMessage: {
                    content: systemInstruction
                },
                onPermissionRequest: this.approveAll,
                // Note: SDK 不直接支援 temperature 和 maxTokens 參數
                // 這些參數可能需要透過 provider config 或其他方式設定
            } as SessionConfig;
            console.log('🚀 Creating Copilot session with options:', requestOptions);
            const session = await this.client?.createSession(requestOptions);

            // 準備接收串流內容
            let content = '';
            let isFirstChunk = true;
            let finalResponse: any = null;

            // 監聽串流事件，即時接收內容
            session?.on('assistant.message_delta', (event: any) => {
                const deltaContent = event.data?.deltaContent || '';
                if (deltaContent) {
                    if (isFirstChunk) {
                        console.log('📨 Receiving streamed response...');
                        isFirstChunk = false;
                    }
                    // 即時輸出串流內容（可選）
                    if (config?.showReviewContent) {
                        // 先關閉即時輸出，若需要 Debug 可取消註解
                        // process.stdout.write(deltaContent);
                    }
                    content += deltaContent;
                }
            });

            // 監聽完整訊息事件（用於獲取 token usage）
            session?.on('assistant.message', (event: any) => {
                finalResponse = event;
            });

            // 發送 Prompt 並等待回應完成
            const startTime = Date.now();
            console.log(`⏳ Sending request to GitHub Copilot (timeout: ${this.timeout}ms)...`);
            const response = await session?.sendAndWait({
                prompt
            }, this.timeout);
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`\n⏱️ GitHub Copilot response completed in ${duration} seconds`);

            // 如果沒有收到串流內容，從最終回應中提取
            if (!content) {
                // console.warn('⚠️ No streaming content received, extracting from final response');
                content = response?.data?.content || finalResponse?.data?.content || 'No response generated';
            }

            // 提取或估算 Token 使用情況（優先使用 finalResponse，其次使用 response）
            const tokenUsage = this.extractTokenUsage(finalResponse || response) || this.estimateTokenUsage({ data: { content } });

            // 清理 session
            await session?.disconnect();

            // 如果啟用顯示審核內容，印出回應資訊
            if (config?.showReviewContent) {
                this.printResponseInfo(content);
            }

            // 輸出 Token 使用情況
            if (tokenUsage.inputTokens !== undefined && tokenUsage.outputTokens !== undefined) {
                console.log(`📊 Token Usage - Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}`);
            } else if (tokenUsage.outputTokens !== undefined) {
                console.log(`📊 Token Usage - Output: ${tokenUsage.outputTokens} (估算)`);
            }

            console.log('✅ Response generated successfully');

            return {
                content,
                inputTokens: tokenUsage.inputTokens,
                outputTokens: tokenUsage.outputTokens
            };
        } catch (error: any) {
            if (error.message.includes("ENOENT")) {
                throw new Error("⛔ Copilot CLI not found. Please install it first.");
            } else if (error.message.includes("ECONNREFUSED")) {
                throw new Error("⛔ Could not connect to Copilot CLI server.");
            } else if (error.message.includes("timeout")) {
                throw new Error("⛔ GitHub Copilot SDK timeout error.");
            } else if (error.message.includes("stream was destroyed")) {
                // 提供更詳細的 stream 錯誤說明
                throw new Error("⛔ GitHub Copilot connection interrupted. This may be caused by network issues or authentication problems. Please check your connection and try again.");
            } else {
                throw new Error(`⛔ GitHub Copilot SDK error: ${error.message}`);
            }

        } finally {
            if (this.client) {
                await this.client.stop();
                this.client = undefined;
            }
        }
    }

    /**
     * 初始化 Copilot Client（延遲初始化）
     * 只在首次呼叫 generateComment 時建立連接
     * 根據參數組合選擇認證模式：Token 模式、遠端 Server 模式、本機 CLI 模式
     */
    private async initializeClient(): Promise<void> {
        if (this.client) {
            return; // 已初始化，直接返回
        }

        try {
            // 動態引入 GitHub Copilot SDK
            const { CopilotClient, approveAll } = await import('@github/copilot-sdk');
            this.approveAll = approveAll;
            const logLevel = 'debug'; // 可根據需要調整日誌級別（debug, info, warn, error）

            // 根據參數組合決定連接模式
            if (this.githubToken) {
                // Token 模式：使用使用者提供的 GitHub Token
                const resolvedCliPath = this.resolveCopilotCliPath();
                console.log(`📍 Using Copilot CLI at: ${resolvedCliPath}`);
                this.client = new CopilotClient({
                    logLevel: logLevel,
                    githubToken: this.githubToken,
                    useLoggedInUser: false,
                    cliPath: resolvedCliPath,
                });
                console.log(`✅ Connected to GitHub Copilot using provided token`);
            } else if (this.serverAddress) {
                // 遠端 CLI Server 模式：連接到指定的 CLI Server
                this.client = new CopilotClient({
                    logLevel: logLevel,
                    cliUrl: this.serverAddress,
                });
                console.log(`✅ Connected to GitHub Copilot CLI Server at ${this.serverAddress}`);
            } else {
                // 本機 CLI 模式：使用 Build Agent 預先設定的授權
                const resolvedCliPath = this.resolveCopilotCliPath();
                console.log(`📍 Using Copilot CLI at: ${resolvedCliPath}`);                
                this.client = new CopilotClient({
                    logLevel: logLevel,
                    cliPath: resolvedCliPath,
                });
                console.log(`✅ Connected to GitHub Copilot CLI (local agent)`);
            }
        } catch (error: any) {
            // 根據認證模式提供不同的錯誤訊息
            if (this.githubToken) {
                // Token 認證相關錯誤
                if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                    throw new Error('⛔ Invalid or expired GitHub Token. Please check your token and try again.');
                } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                    throw new Error('⛔ GitHub Token does not have required \'Copilot\' Read permission. Please update token permissions in Account permissions > Copilot > Access: Read-only.');
                } else {
                    throw new Error(`⛔ Failed to authenticate with GitHub Token: ${error.message}`);
                }
            } else if (this.serverAddress) {
                // Server 連接相關錯誤
                throw new Error(`⛔ Failed to connect to CLI Server at ${this.serverAddress}: ${error.message}`);
            } else {
                // 本機 CLI 相關錯誤
                throw new Error(`⛔ Failed to connect to GitHub Copilot CLI (local agent): ${error.message}`);
            }
        }
    }

    /**
     * 確保 @github/copilot CLI 已安裝並取得其 JS 入口點路徑
     * 優先順序：
     * 1. 使用者明確指定路徑（跳過自動安裝）
     * 2. 自動安裝/更新 @github/copilot，並解析全域 npm JS 入口點
     *
     * 回傳 JS 入口點路徑讓 SDK 以 `node <path>` 方式執行，跨平台相容（Windows/Linux）
     */
    private resolveCopilotCliPath(): string {
        // 1. 使用者明確指定路徑（constructor 中已處理 explicit path 和 env var）
        if (this.copilotCliPath) {
            if (!fs.existsSync(this.copilotCliPath)) {
                console.warn(`⚠️ Specified Copilot CLI path not found: ${this.copilotCliPath}, falling back to auto-detect`);
            } else if (!(process.platform === 'win32' && /\.(bat|cmd|ps1)$/i.test(this.copilotCliPath))) {
                // 非 Windows 腳本，直接使用
                return this.copilotCliPath;
            }
            // Windows 腳本 (.bat/.cmd/.ps1) 無法直接 spawn，繼續往下解析 JS 入口
        }

        // 2. 確保 @github/copilot 已安裝最新版本
        this.ensureCopilotCli();

        // 3. 解析全域 npm @github/copilot 套件的 JS 入口點
        const jsPath = this.getGlobalCopilotJsPath();
        if (!jsPath) {
            throw new Error('⛔ Failed to resolve @github/copilot CLI path after installation. Please check npm global installation.');
        }

        console.log(`📍 Using Copilot CLI at: ${jsPath}`);
        return jsPath;
    }

    /**
     * 確保 @github/copilot CLI 已安裝最新版本
     * - 若未安裝：執行 npm install -g @github/copilot
     * - 若已安裝但非最新：執行更新
     * - 若已是最新：跳過安裝
     * 最後印出目前安裝的版本號碼
     */
    private ensureCopilotCli(): void {
        console.log('🔍 Checking @github/copilot CLI...');

        const installedVersion = this.getInstalledCopilotVersion();

        if (installedVersion) {
            // 嘗試取得 npm registry 最新版本
            let latestVersion: string | null = null;
            try {
                latestVersion = execSync('npm show @github/copilot version', {
                    encoding: 'utf8',
                    timeout: 15000,
                    stdio: ['pipe', 'pipe', 'pipe']
                }).trim();
            } catch {
                console.warn('⚠️ Could not fetch latest @github/copilot version from registry, skipping update check.');
            }

            if (!latestVersion || installedVersion === latestVersion) {
                console.log(`✅ @github/copilot ${installedVersion} is up to date.`);
                return;
            }

            console.log(`⬆️  Updating @github/copilot: ${installedVersion} → ${latestVersion}...`);
        } else {
            console.log('📦 @github/copilot CLI not found, installing...');
        }

        // 安裝/更新
        try {
            execSync('npm install -g @github/copilot', {
                encoding: 'utf8',
                stdio: 'inherit',
                timeout: 180000
            });
        } catch (error: any) {
            if (error.code === 'ENOENT' || (error.message && (error.message.includes('npm: not found') || error.message.includes("'npm' is not recognized")))) {
                throw new Error('⛔ npm is not available. Please install Node.js/npm to proceed.');
            }
            throw error;
        }

        const newVersion = this.getInstalledCopilotVersion();
        console.log(`✅ @github/copilot ${newVersion ?? '(unknown)'} installed successfully.`);
    }

    /**
     * 取得全域已安裝的 @github/copilot 版本號碼
     * @returns 版本號碼字串，若未安裝則回傳 null
     */
    private getInstalledCopilotVersion(): string | null {
        try {
            const result = execSync('npm list -g @github/copilot --depth=0 --json', {
                encoding: 'utf8',
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const data = JSON.parse(result);
            return data?.dependencies?.['@github/copilot']?.version ?? null;
        } catch (error: any) {
            // 舊版 npm（<v7）在套件不存在時會回傳非零 exit code，但 stdout 仍含有效 JSON
            try {
                const data = JSON.parse(error.stdout || '{}');
                return data?.dependencies?.['@github/copilot']?.version ?? null;
            } catch (parseError: any) {
                console.warn(`⚠️ Failed to parse npm list output: ${parseError.message}`);
                return null;
            }
        }
    }

    /**
     * 解析全域 npm @github/copilot 套件的 JS 入口點路徑
     * SDK 對 JS 入口點會以 `node <path>` 方式執行，跨平台相容
     * @returns JS 入口點絕對路徑，找不到時回傳 null
     */
    private getGlobalCopilotJsPath(): string | null {
        try {
            const npmRoot = execSync('npm root -g', {
                encoding: 'utf8',
                timeout: 10000
            }).trim();

            const pkgJsonPath = path.join(npmRoot, '@github', 'copilot', 'package.json');
            if (!fs.existsSync(pkgJsonPath)) {
                return null;
            }

            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            const pkgDir = path.dirname(pkgJsonPath);

            // 優先使用 bin 欄位
            const binField = pkg.bin;
            if (binField) {
                const binEntry: string = typeof binField === 'string' ? binField
                    : (binField['copilot'] ?? Object.values(binField)[0] as string);
                if (binEntry) {
                    const binPath = path.resolve(pkgDir, binEntry);
                    if (fs.existsSync(binPath)) return binPath;
                }
            }

            // 次要使用 main 欄位
            if (pkg.main) {
                const mainPath = path.resolve(pkgDir, pkg.main);
                if (fs.existsSync(mainPath)) return mainPath;
            }

            // 備用：app.js
            const appPath = path.join(pkgDir, 'app.js');
            if (fs.existsSync(appPath)) return appPath;

        } catch (error: any) {
            console.warn(`⚠️ Could not resolve @github/copilot JS entry point: ${error.message}`);
        }
        return null;
    }

    /**
     * 解析並驗證 Server 位址格式
     * @param address - Server 位址 (格式: host:port)
     * @returns [host, port]
     * @throws {Error} 當格式錯誤時拋出錯誤
     */
    private parseServerAddress(address: string): [string, string] {
        const parts = address.split(':');
        if (parts.length !== 2) {
            throw new Error(
                `⛔ Invalid server address format: ${address}. Expected format: host:port`
            );
        }

        const [host, port] = parts;
        if (!host || !port || isNaN(parseInt(port, 10))) {
            throw new Error(
                `⛔ Invalid server address format: ${address}. Expected format: host:port`
            );
        }

        return [host, port];
    }

    /**
     * 提取 SDK 提供的 Token Usage
     * @param response - SDK 回應物件
     * @returns { inputTokens, outputTokens } 或 null
     */
    private extractTokenUsage(response: any): { inputTokens?: number; outputTokens?: number } | null {
        // 嘗試多種可能的欄位名稱（處理 SDK API 變動）
        const usage = response?.usage || response?.data?.usage;

        if (!usage) {
            return null;
        }

        // 嘗試不同的欄位名稱
        const inputTokens =
            usage.inputTokens ?? usage.promptTokens ?? usage.input_tokens;
        const outputTokens =
            usage.outputTokens ?? usage.completionTokens ?? usage.output_tokens;

        if (inputTokens !== undefined || outputTokens !== undefined) {
            return { inputTokens, outputTokens };
        }

        return null;
    }

    /**
     * 估算 Token 使用情況（當 SDK 不提供時）
     * @param response - SDK 回應物件
     * @returns { outputTokens } 估算值
     */
    private estimateTokenUsage(response: any): { inputTokens?: number; outputTokens?: number } {
        const content = response?.data?.content || '';
        // 簡易估算：1 token ≈ 4 字元
        const outputTokens = Math.ceil(content.length / 4);

        return { outputTokens };
    }

    /**
     * 記錄生成開始的摘要資訊
     * @param config - 生成設定
     */
    private logGenerationStart(config?: GenerateConfig): void {
        console.log('🚩 Generating response using GitHub Copilot...');

        // 根據認證模式顯示不同的資訊
        if (this.githubToken) {
            console.log(`+ Authentication: Token`);
        } else if (this.serverAddress) {
            console.log(`+ Server: ${this.serverAddress}`);
        } else {
            console.log(`+ Server: local agent`);
        }

        console.log(`+ Model: ${this.model}`);
        console.log(`+ Timeout: ${this.timeout}ms`);
        console.log(`+ Max Output Tokens: ${config?.maxOutputTokens}`);
        console.log(`+ Temperature: ${config?.temperature}`);
        console.log(`+ ShowReviewContent: ${config?.showReviewContent}`);
    }

    /**
     * 印出送給 AI 的請求資訊
     * @param systemInstruction - 系統指令
     * @param prompt - 提示詞
     * @param config - 生成設定
     */
    private printRequestInfo(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): void {
        console.log('\n' + '='.repeat(80));
        console.log('📋 GitHub Copilot - Request Information');
        console.log('='.repeat(80));
        console.log('📝 System Instruction:');
        console.log(systemInstruction || '(none)');
        console.log('='.repeat(80));
        console.log('📝 Prompt:');
        console.log(prompt);
        console.log('='.repeat(80));
        console.log('⚙️  Generation Config:');

        // 根據認證模式顯示不同的資訊
        if (this.githubToken) {
            console.log(`   - Authentication: Token`);
        } else if (this.serverAddress) {
            console.log(`   - Server: ${this.serverAddress}`);
        } else {
            console.log(`   - Server: local agent`);
        }

        console.log(`   - Model: ${this.model}`);
        console.log(`   - Timeout: ${this.timeout}ms`);
        console.log(`   - Temperature: ${config?.temperature ?? 'default'}`);
        console.log(`   - Max Output Tokens: ${config?.maxOutputTokens ?? 'default'}`);
        console.log('='.repeat(80));
    }

    /**
     * 印出 AI 的回應資訊
     * @param content - AI 回應內容
     */
    private printResponseInfo(content: string): void {
        console.log('\n' + '='.repeat(80));
        console.log('🤖 GitHub Copilot - Response');
        console.log('='.repeat(80));
        console.log(content);
        console.log('='.repeat(80));
    }

    /**
     * 清理資源（如果需要）
     */
    public async dispose(): Promise<void> {
        if (this.client && typeof this.client.stop === 'function') {
            try {
                await this.client.stop();
                console.log('✅ GitHub Copilot Client connection closed');
            } catch (error: any) {
                console.warn(`⚠️ Error closing GitHub Copilot Client: ${error.message}`);
            }
        }
    }
}
