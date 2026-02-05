import { AIService, AIResponse, GenerateConfig } from '../interfaces/ai-service.interface';

/**
 * GitHub Copilot AI 服務實作
 * 使用 GitHub Copilot CLI Server 生成內容
 * 
 * 注意：此服務直接實作 AIService 介面，不繼承 BaseAIService
 * 因為 GitHub Copilot 不需要 API Key（認證由 CLI Server 處理）
 */
export class GithubCopilotService implements AIService {
    private serverAddress: string;
    private model: string;
    private client: any; // CopilotClient 實例，延遲初始化

    /**
     * 建立 GitHub Copilot 服務實例
     * @param serverAddress - CLI Server 位址 (格式: host:port)。若未提供，則使用 Build Agent 內的 GitHub Copilot CLI
     * @param model - 模型名稱，預設為 'gpt-5-mini'
     * @throws {Error} 當 serverAddress 格式錯誤時拋出錯誤
     */
    constructor(serverAddress?: string, model: string = 'gpt-5-mini') {
        // 如果提供了 serverAddress，則驗證格式
        if (serverAddress && serverAddress.trim() !== '') {
            this.parseServerAddress(serverAddress);
            this.serverAddress = serverAddress;
        } else {
            this.serverAddress = ''; // 空字串表示使用本機 CLI
        }

        this.model = model || 'gpt-5-mini';
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
                        process.stdout.write(deltaContent);
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
            console.log('⏳ Sending request to GitHub Copilot...'); 
            const response = await session.sendAndWait({
                prompt
            }); 
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
     */
    private async initializeClient(): Promise<void> {
        if (this.client) {
            return; // 已初始化，直接返回
        }

        try {
            // 動態引入 GitHub Copilot SDK
            const { CopilotClient } = await import('@github/copilot-sdk');

            // 根據是否有 serverAddress 決定連接方式
            if (this.serverAddress) {
                this.client = new CopilotClient({
                    cliUrl: this.serverAddress,
                });
                console.log(`✅ Connected to GitHub Copilot CLI Server at ${this.serverAddress}`);
            } else {
                this.client = new CopilotClient();
                console.log(`✅ Connected to GitHub Copilot CLI (local agent)`);
            }
        } catch (error: any) {
            const location = this.serverAddress || 'local agent';
            throw new Error(
                `⛔ Failed to connect to GitHub Copilot CLI at ${location}: ${error.message}`
            );
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
        console.log(`+ Server: ${this.serverAddress || 'local agent'}`);
        console.log(`+ Model: ${this.model}`);
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
        console.log(`   - Server: ${this.serverAddress || 'local agent'}`);
        console.log(`   - Model: ${this.model}`);
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
