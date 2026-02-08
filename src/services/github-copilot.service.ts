import { AIService, AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';

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
    private githubToken: string;
    private serverAddress: string;
    private model: string;
    private timeout: number;
    private client: any; // CopilotClient 實例，延遲初始化

    /**
     * 建立 GitHub Copilot 服務實例
     * @param githubToken - GitHub Token (格式: github_pat_xxx, gho_xxx, ghu_xxx)。用於 Token 認證模式
     * @param serverAddress - CLI Server 位址 (格式: host:port)。用於遠端 CLI Server 模式
     * @param model - 模型名稱，預設為 'gpt-4o'
     * @param timeout - 請求超時時間（毫秒）。若未提供，預設為 60000 ms (1分鐘)
     * @throws {Error} 當參數格式錯誤或參數互斥時拋出錯誤
     */
    constructor(githubToken?: string, serverAddress?: string, model: string = 'gpt-4o', timeout?: number) {
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

        this.model = model || 'gpt-4o';
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
                streaming: true, // 啟用串流模式
                systemMessage: {
                    content: systemInstruction
                },
                // Note: SDK 不直接支援 temperature 和 maxTokens 參數
                // 這些參數可能需要透過 provider config 或其他方式設定
            };
            console.log('🚀 Creating Copilot session with options:', requestOptions);
            const session = await this.client.createSession(requestOptions);

            // 準備接收串流內容
            let content = '';
            let isFirstChunk = true;
            let finalResponse: any = null;

            // 監聽串流事件，即時接收內容
            session.on('assistant.message_delta', (event: any) => {
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
            session.on('assistant.message', (event: any) => {
                finalResponse = event;
            });

            // 發送 Prompt 並等待回應完成
            const startTime = Date.now();
            console.log(`⏳ Sending request to GitHub Copilot (timeout: ${this.timeout}ms)...`); 
            const response = await session.sendAndWait({
                prompt
            }, this.timeout); 
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`\n⏱️ GitHub Copilot response completed in ${duration} seconds`);

            // 如果沒有收到串流內容，從最終回應中提取
            if (!content) {
                console.warn('⚠️ No streaming content received, extracting from final response');
                content = response?.data?.content || finalResponse?.data?.content || 'No response generated';
            }

            // 提取或估算 Token 使用情況（優先使用 finalResponse，其次使用 response）
            const tokenUsage = this.extractTokenUsage(finalResponse || response) || this.estimateTokenUsage({ data: { content } });

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
            await this.client.stop();
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
            const { CopilotClient } = await import('@github/copilot-sdk');

            // 根據參數組合決定連接模式
            if (this.githubToken) {
                // Token 模式：使用使用者提供的 GitHub Token
                this.client = new CopilotClient({
                    githubToken: this.githubToken,
                    useLoggedInUser: false
                });
                console.log(`✅ Connected to GitHub Copilot using provided token`);
            } else if (this.serverAddress) {
                // 遠端 CLI Server 模式：連接到指定的 CLI Server
                this.client = new CopilotClient({
                    cliUrl: this.serverAddress,
                });
                console.log(`✅ Connected to GitHub Copilot CLI Server at ${this.serverAddress}`);
            } else {
                // 本機 CLI 模式：使用 Build Agent 預先設定的授權
                this.client = new CopilotClient();
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
