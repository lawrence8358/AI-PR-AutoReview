import { AIService, AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';
import { DEFAULT_MODELS, AI_PROVIDERS } from '../constants';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

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
    private readonly githubToken: string;
    private readonly serverAddress: string;
    private readonly copilotCliPath: string;
    private readonly model: string;
    private readonly timeout: number;
    private client: any; // CopilotClient 實例，延遲初始化
    private approveAll: any; // SDK approveAll helper，延遲初始化
    private resolvedCliPath: string = ''; // 實際解析出的 CLI 路徑（含來源說明），用於錯誤診斷

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

        this.copilotCliPath = copilotCliPath?.trim() || process.env.COPILOT_CLI_PATH?.trim() || '';
        this.model = model || 'gpt-5-mini';
        this.timeout = timeout ?? 60000;
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
            // 建立 Copilot Session
            const session = await this.client.createSession({
                model: this.model,
                streaming: false,
                systemMessage: { content: systemInstruction },
                onPermissionRequest: this.approveAll,
            });

            const startTime = Date.now();
            console.log(`⏳ Sending request to GitHub Copilot (timeout: ${this.timeout}ms)...`);
            const response = await session.sendAndWait({ prompt }, this.timeout);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`⏱️ GitHub Copilot response completed in ${duration}s`);

            const content = response?.data?.content || 'No response generated';
            const tokenUsage = this.extractTokenUsage(response) ?? this.estimateTokenUsage(content);

            // 清理 session
            await session.destroy();

            // 如果啟用顯示審核內容，印出回應資訊
            if (config?.showReviewContent) {
                this.printResponseInfo(content);
            }

            // 輸出 Token 使用情況
            if (tokenUsage.inputTokens !== undefined && tokenUsage.outputTokens !== undefined) {
                console.log(`📊 Token Usage - Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}`);
            } else if (tokenUsage.outputTokens !== undefined) {
                console.log(`📊 Token Usage - Output: ${tokenUsage.outputTokens} (estimated)`);
            }

            console.log('✅ Response generated successfully');

            return {
                content,
                inputTokens: tokenUsage.inputTokens,
                outputTokens: tokenUsage.outputTokens
            };
        } catch (error: any) {
            // 記錄完整 stack trace，方便診斷真正的錯誤根源
            console.error('🔍 GitHub Copilot error details:');
            console.error(error.stack || error);

            if (error.message.includes("ENOENT")) {
                throw new Error("⛔ Copilot CLI not found. Please install it first.");
            } else if (error.message.includes("ECONNREFUSED")) {
                throw new Error("⛔ Could not connect to Copilot CLI server.");
            } else if (error.message.includes("timeout")) {
                throw new Error("⛔ GitHub Copilot SDK timeout error.");
            } else if (error.message.includes("stream was destroyed")) {
                // ERR_STREAM_DESTROYED 通常代表 CLI process 無法啟動或啟動後立即崩潰
                // SDK 內部的 vscode-jsonrpc 試圖寫入已關閉的 stdin stream 時拋出此錯誤
                const cliPath = this.resolvedCliPath || this.copilotCliPath || '(unknown — CLI not found or path resolution failed)';
                throw new Error(
                    `⛔ GitHub Copilot CLI process terminated unexpectedly (ERR_STREAM_DESTROYED).\n` +
                    `   This typically means the Copilot CLI binary failed to start or exited prematurely.\n` +
                    `   CLI path used: ${cliPath}\n` +
                    `   Hint: Verify the CLI binary exists, is executable, and your authentication is correctly configured.\n` +
                    `   Original error: ${error.message}`
                );
            } else {
                throw new Error(`⛔ GitHub Copilot SDK error: ${error.message}`);
            }

        } finally {
            // 防止 initializeClient() 失敗時 this.client 為 null 導致 TypeError 掩蓋原始錯誤
            if (this.client) {
                try {
                    await this.client.stop();
                } catch (stopError: any) {
                    console.warn(`⚠️ Error stopping GitHub Copilot client: ${stopError.message}`);
                }
                this.client = null;
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

            // 根據參數組合決定連接模式
            if (this.serverAddress) {
                // 遠端 CLI Server 模式：連接到指定的 CLI Server
                this.client = new CopilotClient({ cliUrl: this.serverAddress });
                console.log(`✅ Connected to GitHub Copilot CLI Server at ${this.serverAddress}`);
                return;
            }

            const cliPath = this.resolveCopilotCliPath();
            console.log(`📍 Using Copilot CLI at: ${this.resolvedCliPath}`);
            this.client = new CopilotClient(
                this.githubToken
                    ? { githubToken: this.githubToken, useLoggedInUser: false, cliPath }
                    : { cliPath }
            );
            console.log(`✅ Connected to GitHub Copilot (${this.githubToken ? 'token auth' : 'local agent'})`);
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
     * 解析 Copilot CLI 路徑
     * 優先順序：明確指定 → 本地 npm 平台套件 → 全域 npm 平台套件 → 系統 PATH → 拋出錯誤
     *
     * 注意：此方法不會回傳 undefined。在 esbuild CJS bundle 環境中，SDK 內部的
     * getBundledCliPath() 會使用 import.meta.resolve() 導致 crash，因此必須始終
     * 提供 cliPath 來短路該呼叫。(SDK issue #528)
     *
     * 為何「系統 PATH」排在最後：Windows 上 npm install -g 會在 PATH 中放置 CMD shim/bash
     * 腳本，而非原生 binary。SDK 嘗試以 JSON-RPC 協定與 shim 通訊時會立即退出，
     * 導致 ERR_STREAM_DESTROYED。
     */
    private resolveCopilotCliPath(): string {
        const platformPkg = `@github/copilot-${process.platform}-${process.arch}`;
        const binaryName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';

        // 1. 明確指定的路徑（constructor arg 或 COPILOT_CLI_PATH env）
        if (this.copilotCliPath) {
            if (fs.existsSync(this.copilotCliPath)) {
                this.resolvedCliPath = `${this.copilotCliPath} (explicitly configured)`;
                return this.copilotCliPath;
            }
            console.warn(`⚠️ Configured CLI path not found: ${this.copilotCliPath}, falling back to auto-detect`);
        }

        // 2. 本地 node_modules（開發 / 本地 npm install 環境）
        const localPath = this.tryFromLocalNodeModules(platformPkg);
        if (localPath) return localPath;

        // 3. 全域 npm node_modules（CI 環境：npm install -g @github/copilot）
        const globalPath = this.tryFromGlobalNpm(platformPkg, binaryName);
        if (globalPath) return globalPath;

        // 4. 系統 PATH（最後手段，Windows 上跳過 npm shim）
        const pathBin = this.tryFromSystemPath();
        if (pathBin) return pathBin;

        // 5. 無法找到 CLI → 拋出明確錯誤（避免 SDK 呼叫 getBundledCliPath 崩潰）
        throw new Error(
            'Copilot CLI not found. Please either:\n' +
            '  1. Set the "inputGitHubCopilotCliPath" task input to the CLI executable path\n' +
            '  2. Set the "COPILOT_CLI_PATH" environment variable\n' +
            '  3. Install @github/copilot globally: npm install -g @github/copilot'
        );
    }

    /** Step 2: 從本地 node_modules 解析原生 CLI binary（require.resolve 方式） */
    private tryFromLocalNodeModules(platformPkg: string): string | null {
        try {
            const binaryPath = require.resolve(platformPkg);
            if (fs.existsSync(binaryPath)) {
                this.resolvedCliPath = `${binaryPath} (local npm: ${platformPkg})`;
                console.log(`📍 Found CLI in local node_modules: ${binaryPath}`);
                return binaryPath;
            }
        } catch {
            // 本地 node_modules 找不到，繼續
        }
        return null;
    }

    /**
     * Step 3: 從全域 npm node_modules 搜尋 CLI binary
     * 支援 flat（npm v7+ hoisted）和 nested 兩種安裝佈局。
     * 使用 execSync（而非 execFileSync）是因為 Windows 上 npm 是 .cmd 腳本。
     */
    private tryFromGlobalNpm(platformPkg: string, binaryName: string): string | null {
        const prefixes = this.getGlobalNpmPrefixCandidates();
        for (const prefix of prefixes) {
            const found = this.checkGlobalNpmPrefix(prefix, platformPkg, binaryName);
            if (found) return found;
        }
        console.warn(`⚠️ Copilot CLI not found in global npm. Checked prefixes: ${prefixes.join(', ')}`);
        return null;
    }

    private getGlobalNpmPrefixCandidates(): string[] {
        const candidates: string[] = [path.dirname(process.execPath)];
        try {
            const prefix = execSync('npm config get prefix', { encoding: 'utf8', timeout: 8000 }).trim();
            if (prefix && prefix !== candidates[0]) candidates.push(prefix);
        } catch { /* npm unavailable */ }
        return candidates;
    }

    private checkGlobalNpmPrefix(prefix: string, platformPkg: string, binaryName: string): string | null {
        const arch = `copilot-${process.platform}-${process.arch}`;
        const flat   = path.join(prefix, 'node_modules', '@github', arch, binaryName);
        const nested = path.join(prefix, 'node_modules', '@github', 'copilot', 'node_modules', '@github', arch, binaryName);

        console.log(`🔍 Checking [flat]   ${flat}`);
        if (fs.existsSync(flat)) {
            this.resolvedCliPath = `${flat} (global npm flat: ${platformPkg})`;
            console.log(`📍 Found CLI in global npm (flat): ${flat}`);
            return flat;
        }
        console.log(`🔍 Checking [nested] ${nested}`);
        if (fs.existsSync(nested)) {
            this.resolvedCliPath = `${nested} (global npm nested: ${platformPkg})`;
            console.log(`📍 Found CLI in global npm (nested): ${nested}`);
            return nested;
        }
        return null;
    }

    /**
     * Step 4: 從系統 PATH 搜尋 copilot binary
     * Windows 上只接受 .exe — npm shim（無副檔名）無法被 Node.js 的 spawn 直接執行
     */
    private tryFromSystemPath(): string | null {
        try {
            const cmd = process.platform === 'win32' ? 'where' : 'which';
            const result = execFileSync(cmd, ['copilot'], { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            for (const candidate of result.trim().split(/\r?\n/).filter(Boolean)) {
                if (!fs.existsSync(candidate)) continue;
                if (process.platform === 'win32' && !candidate.toLowerCase().endsWith('.exe')) {
                    console.warn(`⚠️ Skipping "${candidate}" — npm shim/script, not a native .exe`);
                    continue;
                }
                this.resolvedCliPath = `${candidate} (system PATH via ${cmd})`;
                console.log(`📍 Found CLI in system PATH: ${candidate}`);
                return candidate;
            }
        } catch { /* copilot not in PATH */ }
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
        if (!host || !port || Number.isNaN(Number.parseInt(port, 10))) {
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
    private estimateTokenUsage(content: string): { inputTokens?: number; outputTokens?: number } {
        // 簡易估算：1 token ≈ 4 字元
        return { outputTokens: Math.ceil(content.length / 4) };
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
