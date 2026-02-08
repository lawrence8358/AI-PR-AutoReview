# GitHub Copilot Token 認證支援 - 實作任務清單

## 1. 更新 GithubCopilotService

- [x] 1.1 修改 GithubCopilotService 建構子簽章，新增 `githubToken` 參數作為第一個參數
- [x] 1.2 在建構子中新增參數互斥驗證邏輯（githubToken 和 serverAddress 不能同時存在）
- [x] 1.3 更新 `initializeClient` 方法，根據參數組合選擇 SDK 配置（Token 模式、遠端 Server 模式、本機 CLI 模式）
- [x] 1.4 實作 Token 模式的 Client 初始化邏輯（githubToken + useLoggedInUser: false）
- [x] 1.5 更新連接成功日誌，根據模式顯示不同訊息（Authentication: Token / Server: xxx / Server: local agent）
- [x] 1.6 新增 Token 類型驗證（檢查是否為 ghp_ 前綴並拋出錯誤）
- [x] 1.7 更新錯誤處理邏輯，新增 Token 相關錯誤訊息（無效、過期、缺少權限、類型不支援）
- [x] 1.8 更新 `logGenerationStart` 方法，在日誌中標示認證模式

## 2. 更新 task.json

- [x] 2.1 移除 `inputGitHubCopilotNetworkType` 欄位定義
- [x] 2.2 新增 `inputGitHubCopilotToken` 欄位（type: string, required: false, visibleRule: inputAiProvider == GitHubCopilot）
- [x] 2.3 撰寫 `inputGitHubCopilotToken` 的 helpMarkDown，包含：Token 類型說明、取得方式、權限要求、互斥說明
- [x] 2.4 更新 `inputGitHubCopilotServerAddress` 的 helpMarkDown，補充互斥說明和選填說明
- [x] 2.5 確認所有 GitHub Copilot 相關欄位的 visibleRule 正確（移除對 NetworkType 的依賴）

## 3. 更新 index.ts

- [x] 3.1 新增讀取 `inputGitHubCopilotToken` 參數（Pipeline 模式）
- [x] 3.2 新增讀取 `GitHubCopilotToken` 環境變數（Debug 模式）
- [x] 3.3 實作參數互斥驗證邏輯（在讀取參數後立即驗證）
- [x] 3.4 更新 AIProviderService.registerService 呼叫，傳遞 githubToken 參數
- [x] 3.5 移除對 `inputGitHubCopilotNetworkType` 的讀取和處理邏輯

## 4. 更新 AIProviderService

- [x] 4.1 擴充 AIProviderService.registerService 的 config 參數型別，新增 `githubToken?: string`
- [x] 4.2 更新 GithubCopilotService 實例化邏輯，傳遞 githubToken 參數
- [x] 4.3 確認工廠模式的參數傳遞順序正確

## 5. 更新 README.md（英文文件）

- [x] 5.1 移除 GitHub Copilot Network Type 相關段落
- [x] 5.2 新增 GitHub Token 參數說明（GitHub Copilot Token 欄位）
- [x] 5.3 建立三種使用情境對照表（本機 CLI / Token 模式 / 遠端 CLI Server）
- [x] 5.4 補充 Fine-grained Personal Access Token 取得步驟和截圖
- [x] 5.5 說明 Token 所需權限（Account permissions > Copilot > Access: Read-only）
- [x] 5.6 標註 Token 和 CLI Server Address 的互斥關係
- [x] 5.7 更新 Task 參數表格，移除 Network Type 欄位，新增 Token 欄位

## 6. 更新 README.zh-TW.md（繁體中文文件）

- [x] 6.1 移除 GitHub Copilot 網路類型相關段落
- [x] 6.2 新增 GitHub Token 參數說明（GitHub Copilot Token 欄位）
- [x] 6.3 建立三種使用情境對照表（本機 CLI / Token 模式 / 遠端 CLI Server）
- [x] 6.4 補充 Fine-grained Personal Access Token 取得步驟和截圖
- [x] 6.5 說明 Token 所需權限（帳戶權限 > Copilot > 存取權: 唯讀）
- [x] 6.6 標註 Token 和 CLI Server Address 的互斥關係
- [x] 6.7 更新 Task 參數表格，移除網路類型欄位，新增 Token 欄位

## 7. 更新 README-Dev.md（開發者文件）

- [x] 7.1 新增 GitHub Token 認證機制說明章節
- [x] 7.2 補充支援的 Token 類型清單（gho_, ghu_, github_pat_）和不支援類型（ghp_）
- [x] 7.3 說明三種模式的 SDK 配置差異
- [x] 7.4 補充參數互斥驗證的三層設計說明
- [x] 7.5 更新環境變數設定範例，新增 `GitHubCopilotToken` 變數
- [x] 7.6 更新測試工具使用說明（test-pr-review.ts 的 --github-token 參數）
- [x] 7.7 補充 Token 安全性最佳實踐（使用 Secret Variables、最小權限原則）

## 8. 更新測試工具 - test-pr-review.ts

- [x] 8.1 新增 `--github-token` 命令行參數解析
- [x] 8.2 新增從環境變數讀取 `GITHUB_COPILOT_TOKEN` 的邏輯
- [x] 8.3 實作參數互斥驗證（githubToken 和 serverAddress 不能同時提供）
- [x] 8.4 更新 AIProviderService.registerService 呼叫，傳遞 githubToken
- [x] 8.5 更新 help 訊息，說明 --github-token 參數用法
- [x] 8.6 更新使用範例，展示 Token 模式的測試指令

## 9. 更新測試工具 - ai-comment.ts

- [x] 9.1 新增從環境變數讀取 `GitHubCopilotToken` 的邏輯
- [x] 9.2 更新 AIProviderService.registerService 呼叫，傳遞 githubToken
- [x] 9.3 確認 githubcopilot provider 的 registerConfig 包含 githubToken

## 10. 建置與打包

- [x] 10.1 執行 `npm run build` 驗證 TypeScript 編譯成功
- [x] 10.2 檢查 dist/task.json 是否包含正確的欄位定義
- [x] 10.3 更新 vss-extension.json 版本號（例如：1.3.6 → 1.4.0）
- [x] 10.4 執行 `npm run packaging:package` 建立 VSIX 檔案
- [x] 10.5 驗證 VSIX 檔案大小合理（確認 SDK 依賴正確打包）

## 11. 文件審查與最終確認

- [x] 11.1 審查所有文件的 Token 類型和權限說明是否一致
- [x] 11.2 審查所有錯誤訊息是否清楚且一致
- [x] 11.3 審查參數互斥驗證是否在三層都正確實作
- [x] 11.4 確認向後相容性：現有使用者的配置不受影響
- [x] 11.5 準備 Marketplace 發佈說明（Release Notes）

