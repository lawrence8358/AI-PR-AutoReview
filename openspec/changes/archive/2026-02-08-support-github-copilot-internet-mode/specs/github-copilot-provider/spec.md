# github-copilot-provider Delta Specification

此規格定義 GitHub Copilot Provider 的認證機制變更，新增 GitHub Token 支援並移除網路類型選項。

## REMOVED Requirements

### Requirement: 網路類型選擇
**Reason**: 網路類型選項（內部網路/網際網路）造成介面複雜且容易混淆，改為根據使用者提供的參數自動判斷使用情境
**Migration**:
- 原本選擇「內部網路」模式：現在直接提供 CLI Server Address（選填）
- 原本計劃使用「網際網路」模式：現在提供 GitHub Token（選填）
- 系統會根據提供的參數自動判斷連接模式

---

## ADDED Requirements

### Requirement: GitHub Token 輸入欄位
The system **SHALL** provide a GitHub Token input field for users to authenticate with GitHub Copilot service. 系統必須提供 GitHub Token 輸入欄位，讓使用者可以透過 Token 認證 GitHub Copilot 服務。

#### Scenario: 顯示 GitHub Token 欄位
**GIVEN** 使用者選擇 "GitHub Copilot" 作為 AI Provider
**WHEN** UI 渲染完成
**THEN** 應顯示 "GitHub Token" 輸入欄位
**AND** 該欄位標記為選填
**AND** 欄位說明應標註與 CLI Server Address 互斥

#### Scenario: GitHub Token 格式說明
**GIVEN** 使用者查看 "GitHub Token" 欄位
**WHEN** 閱讀 helpMarkDown
**THEN** 應包含以下說明：
  - Token 用途：「用於直接連接 GitHub Copilot 雲端服務」
  - 取得方式：「可從 GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens 取得」
  - Token 類型：「必須使用 Fine-grained personal access token（格式：github_pat_xxx）」
  - 互斥說明：「注意：GitHub Token 和 CLI Server Address 不能同時使用」
  - 權限要求：「需要 Copilot 的 Read 權限（Account permissions > Copilot > Access: Read-only）」
  - 不支援類型：「不支援 Classic personal access token（ghp_）」

#### Scenario: 使用者提供 GitHub Token
**GIVEN** 使用者在 "GitHub Token" 欄位輸入有效 Token
**AND** 未提供 CLI Server Address
**WHEN** Pipeline 執行時
**THEN** 系統應使用 Token 模式連接 GitHub Copilot 服務

---

### Requirement: 參數互斥驗證
The system **MUST** validate that GitHub Token and CLI Server Address are not used simultaneously. 系統必須驗證 GitHub Token 和 CLI Server Address 不會同時使用。

#### Scenario: 互斥驗證於 task.json 層級
**GIVEN** task.json 定義
**WHEN** 使用者查看輸入欄位
**THEN** 兩個欄位的 helpMarkDown 都應標註互斥關係
**AND** 說明使用者只能選擇其中一種認證方式

#### Scenario: 互斥驗證於程式端（index.ts）
**GIVEN** Pipeline 執行時
**AND** 使用者同時提供 GitHub Token 和 CLI Server Address
**WHEN** index.ts 讀取輸入參數
**THEN** 應立即拋出錯誤：「⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式」
**AND** Pipeline 應失敗並顯示錯誤訊息

#### Scenario: 互斥驗證於服務層級（GithubCopilotService）
**GIVEN** GithubCopilotService 建構子被呼叫
**AND** 同時傳入 githubToken 和 serverAddress 參數（兩者都非空）
**WHEN** 建構子執行
**THEN** 應拋出錯誤：「⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式」

#### Scenario: 允許的參數組合 - 本機 CLI 模式
**GIVEN** 使用者未提供 GitHub Token
**AND** 使用者未提供 CLI Server Address
**WHEN** Pipeline 執行
**THEN** 驗證應通過
**AND** 系統使用本機 CLI 模式

#### Scenario: 允許的參數組合 - Token 模式
**GIVEN** 使用者提供 GitHub Token
**AND** 使用者未提供 CLI Server Address
**WHEN** Pipeline 執行
**THEN** 驗證應通過
**AND** 系統使用 Token 模式

#### Scenario: 允許的參數組合 - 遠端 CLI Server 模式
**GIVEN** 使用者未提供 GitHub Token
**AND** 使用者提供 CLI Server Address
**WHEN** Pipeline 執行
**THEN** 驗證應通過
**AND** 系統使用遠端 CLI Server 模式

---

### Requirement: GitHub Token 認證模式
When GitHub Token is provided, the system **SHALL** use token-based authentication to connect to GitHub Copilot service. 當提供 GitHub Token 時，系統必須使用基於 Token 的認證方式連接 GitHub Copilot 服務。

#### Scenario: 使用 GitHub Token 初始化 Client
**GIVEN** GithubCopilotService 收到 githubToken 參數
**AND** serverAddress 為空或未提供
**WHEN** initializeClient 方法執行
**THEN** 應建立 CopilotClient 實例，配置為：
  - githubToken: 使用者提供的 Token
  - useLoggedInUser: false
**AND** 不應設定 cliUrl

#### Scenario: Token 模式連接成功日誌
**GIVEN** 使用 GitHub Token 初始化
**WHEN** 連接成功
**THEN** 應輸出日誌：「✅ Connected to GitHub Copilot using provided token」

#### Scenario: Token 無效或過期
**GIVEN** 使用者提供的 GitHub Token 無效或已過期
**WHEN** 嘗試連接 GitHub Copilot 服務
**THEN** 應拋出錯誤：「⛔ Invalid or expired GitHub Token. Please check your token and try again.」

#### Scenario: Token 類型不支援
**GIVEN** 使用者提供的是 Classic personal access token（ghp_）
**WHEN** 嘗試連接 GitHub Copilot 服務
**THEN** 應拋出錯誤：「⛔ Classic personal access tokens (ghp_) are not supported. Please use Fine-grained personal access token (github_pat_).」

#### Scenario: Token 缺少必要權限
**GIVEN** 使用者提供的 GitHub Token 缺少 Copilot Read 權限
**WHEN** 嘗試連接 GitHub Copilot 服務
**THEN** 應拋出錯誤：「⛔ GitHub Token does not have required 'Copilot' Read permission. Please update token permissions in Account permissions > Copilot > Access: Read-only.」

---

## MODIFIED Requirements

### Requirement: CLI Server 位址設定
In remote CLI server mode, users **SHALL** be able to specify the GitHub Copilot CLI Server address optionally. 在遠端 CLI Server 模式下，使用者可以選擇性地指定 GitHub Copilot CLI Server 的位址。

#### Scenario: CLI Server Address 為選填欄位
**GIVEN** 使用者選擇 GitHub Copilot + 未提供 GitHub Token
**WHEN** UI 顯示 "CLI Server Address" 欄位
**THEN** 該欄位類型為文字輸入框
**AND** 該欄位標記為選填（非必填）
**AND** helpMarkDown 顯示：
  - 格式範例：「192.168.1.100:8080」
  - 說明：「選填。若提供則連接遠端 CLI Server；若不提供則使用本機 CLI（需預先設定授權）」
  - 互斥說明：「注意：CLI Server Address 和 GitHub Token 不能同時使用」

#### Scenario: Server 位址格式驗證
**GIVEN** 使用者輸入 Server 位址
**WHEN** Pipeline 執行時
**THEN** 系統必須驗證格式為 `host:port`
**AND** 如果格式錯誤，應拋出清晰的錯誤訊息：「⛔ Invalid server address format: {input}. Expected format: host:port」

#### Scenario: 支援的位址格式
**GIVEN** 使用者輸入 Server 位址
**WHEN** 位址格式為以下任一種
**THEN** 應接受並正確解析：
  - IPv4 + Port：`192.168.1.100:8080`
  - Domain + Port：`copilot.internal.company.com:8080`
  - Localhost + Port：`localhost:8080`

#### Scenario: 未提供 CLI Server Address 且無 Token
**GIVEN** 使用者未提供 CLI Server Address
**AND** 使用者未提供 GitHub Token
**WHEN** Pipeline 執行時
**THEN** 系統應使用本機 CLI 模式
**AND** 應輸出日誌：「✅ Connected to GitHub Copilot CLI (local agent)」

---

### Requirement: GithubCopilotService 實作
The system **MUST** implement a GithubCopilotService class to support the GitHub Copilot AI Provider with token-based authentication. 必須實作 GithubCopilotService 類別以支援 GitHub Copilot AI Provider，並支援基於 Token 的認證。

#### Scenario: 服務實例化（含 Token）
**GIVEN** AIProviderService 收到建立 GitHub Copilot 服務的請求
**AND** 配置包含 githubToken、modelName，但不包含 serverAddress
**WHEN** 呼叫 `getService('githubcopilot')`
**THEN** 應成功建立 GithubCopilotService 實例
**AND** 實例包含正確的 githubToken 和 modelName

#### Scenario: 服務實例化（含 Server Address）
**GIVEN** AIProviderService 收到建立 GitHub Copilot 服務的請求
**AND** 配置包含 serverAddress、modelName，但不包含 githubToken
**WHEN** 呼叫 `getService('githubcopilot')`
**THEN** 應成功建立 GithubCopilotService 實例
**AND** 實例包含正確的 serverAddress 和 modelName

#### Scenario: 服務實例化（本機 CLI 模式）
**GIVEN** AIProviderService 收到建立 GitHub Copilot 服務的請求
**AND** 配置不包含 githubToken 和 serverAddress
**WHEN** 呼叫 `getService('githubcopilot')`
**THEN** 應成功建立 GithubCopilotService 實例
**AND** 實例使用預設配置（本機 CLI）

#### Scenario: 建構子參數互斥驗證
**GIVEN** 嘗試建立 GithubCopilotService 實例
**AND** 同時提供 githubToken 和 serverAddress（兩者都非空）
**WHEN** 呼叫建構子
**THEN** 應拋出錯誤：「⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式」

#### Scenario: 實作 AIService 介面
**GIVEN** GithubCopilotService 類別
**WHEN** 檢查類別定義
**THEN** 必須實作 AIService 介面
**AND** 實作 `generateComment(systemInstruction, prompt, config)` 方法
**AND** 回傳型別為 `Promise<AIResponse>`

#### Scenario: 不繼承 BaseAIService
**GIVEN** GithubCopilotService 類別
**WHEN** 檢查繼承關係
**THEN** 不應繼承 BaseAIService
**AND** 直接實作 AIService 介面
**Rationale**: GitHub Copilot 的 Token 認證機制與傳統 API Key 不同，BaseAIService 的 constructor 會強制驗證 API Key，不適用於此情境

---

### Requirement: CLI Server 連接管理
The service **SHALL** correctly manage connections to the GitHub Copilot service based on the authentication mode. 服務必須根據認證模式正確管理與 GitHub Copilot 服務的連接。

#### Scenario: 延遲初始化連接
**GIVEN** GithubCopilotService 實例已建立
**WHEN** constructor 執行完成
**THEN** 不應立即建立連接
**AND** 連接應在首次呼叫 `generateComment()` 時建立

#### Scenario: Token 模式連接初始化
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 實例配置為 Token 模式（有 githubToken，無 serverAddress）
**WHEN** 初始化連接
**THEN** 應成功建立 CopilotClient 實例，配置為：
  - githubToken: 提供的 Token
  - useLoggedInUser: false
**AND** 應輸出日誌：「✅ Connected to GitHub Copilot using provided token」

#### Scenario: 遠端 CLI Server 模式連接初始化
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 實例配置為遠端 CLI Server 模式（有 serverAddress，無 githubToken）
**AND** CLI Server 在指定位址可用
**WHEN** 初始化連接
**THEN** 應成功建立 CopilotClient 實例，配置為：
  - cliUrl: 指定的 Server 位址
**AND** 應輸出日誌：「✅ Connected to GitHub Copilot CLI Server at {serverAddress}」

#### Scenario: 本機 CLI 模式連接初始化
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 實例配置為本機 CLI 模式（無 githubToken，無 serverAddress）
**WHEN** 初始化連接
**THEN** 應成功建立 CopilotClient 實例（使用預設配置）
**AND** 應輸出日誌：「✅ Connected to GitHub Copilot CLI (local agent)」

#### Scenario: 連接失敗處理（Token 模式）
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 實例配置為 Token 模式
**AND** Token 認證失敗
**WHEN** 嘗試初始化連接
**THEN** 應拋出錯誤：「⛔ Failed to authenticate with GitHub Token: {error details}」

#### Scenario: 連接失敗處理（Server 模式）
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 實例配置為遠端 CLI Server 模式
**AND** CLI Server 在指定位址不可用
**WHEN** 嘗試初始化連接
**THEN** 應拋出錯誤：「⛔ Failed to connect to CLI Server at {serverAddress}: {error details}」

#### Scenario: 重用已建立的連接
**GIVEN** GithubCopilotService 已成功建立連接（任何模式）
**WHEN** 再次呼叫 `generateComment()` 方法
**THEN** 應重用現有連接
**AND** 不應建立新連接

---

### Requirement: 主程式整合
The main program (index.ts) **SHALL** support reading GitHub Copilot configuration including GitHub Token from Pipeline inputs. 主程式（index.ts）必須支援從 Pipeline 輸入讀取 GitHub Copilot 配置（包含 GitHub Token）。

#### Scenario: 讀取 GitHub Token（Pipeline 模式）
**GIVEN** Pipeline 執行 AI-PR-AutoReview Task
**AND** 使用者選擇 GitHub Copilot 並提供 GitHub Token
**WHEN** index.ts 讀取 Task 輸入
**THEN** 應正確讀取：
  - inputAiProvider: "GitHubCopilot"
  - inputGitHubCopilotToken: 使用者輸入的 Token
  - inputGitHubCopilotServerAddress: 空值或未提供
  - inputGitHubCopilotModelName: 使用者輸入的模型或預設值

#### Scenario: 讀取 GitHub Token（Debug 模式）
**GIVEN** 開發者在本地執行 Debug 模式
**AND** .env 檔案包含 GitHub Token 配置
**WHEN** index.ts 讀取環境變數
**THEN** 應正確讀取：
  - AiProvider: "GitHubCopilot"
  - GitHubCopilotToken: 環境變數值
  - GitHubCopilotServerAddress: 空值或未提供
  - ModelName: 環境變數值或預設值

#### Scenario: 參數互斥驗證於 index.ts
**GIVEN** index.ts 讀取到 GitHub Copilot 配置
**AND** 同時存在 Token 和 Server Address（兩者都非空）
**WHEN** 驗證輸入參數
**THEN** 應立即拋出錯誤：「⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式」
**AND** Pipeline 應失敗並顯示錯誤訊息

#### Scenario: 傳遞 Token 配置到 AIProviderService
**GIVEN** 已讀取 GitHub Token 配置
**AND** 未提供 Server Address
**WHEN** 呼叫 `aiProvider.registerService()`
**THEN** 應傳遞正確的參數：
  - provider: 'GitHubCopilot'
  - config.githubToken: 讀取的 Token
  - config.serverAddress: undefined 或空字串
  - config.modelName: 讀取的模型名稱

#### Scenario: 傳遞 Server Address 配置到 AIProviderService
**GIVEN** 已讀取 CLI Server Address 配置
**AND** 未提供 GitHub Token
**WHEN** 呼叫 `aiProvider.registerService()`
**THEN** 應傳遞正確的參數：
  - provider: 'GitHubCopilot'
  - config.githubToken: undefined 或空字串
  - config.serverAddress: 讀取的 Server Address
  - config.modelName: 讀取的模型名稱

#### Scenario: 傳遞本機 CLI 配置到 AIProviderService
**GIVEN** 未提供 GitHub Token 和 Server Address
**WHEN** 呼叫 `aiProvider.registerService()`
**THEN** 應傳遞正確的參數：
  - provider: 'GitHubCopilot'
  - config.githubToken: undefined 或空字串
  - config.serverAddress: undefined 或空字串
  - config.modelName: 讀取的模型名稱或預設值

---

### Requirement: 日誌輸出一致性
The service's log output **SHALL** be consistent with existing Providers and clearly indicate the authentication mode. 服務的日誌輸出必須與現有 Providers 保持一致，並清楚標示認證模式。

#### Scenario: 生成開始日誌（Token 模式）
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 使用 Token 模式
**WHEN** 開始生成評論
**THEN** 應輸出日誌：
  - "🚩 Generating response using GitHub Copilot..."
  - "+ Authentication: Token"
  - "+ Model: {model}"
  - "+ Timeout: {timeout}ms"
  - "+ Max Output Tokens: {maxOutputTokens}"
  - "+ Temperature: {temperature}"

#### Scenario: 生成開始日誌（Server 模式）
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 使用遠端 CLI Server 模式
**WHEN** 開始生成評論
**THEN** 應輸出日誌：
  - "🚩 Generating response using GitHub Copilot..."
  - "+ Server: {serverAddress}"
  - "+ Model: {model}"
  - "+ Timeout: {timeout}ms"
  - "+ Max Output Tokens: {maxOutputTokens}"
  - "+ Temperature: {temperature}"

#### Scenario: 生成開始日誌（本機 CLI 模式）
**GIVEN** 呼叫 `generateComment()` 方法
**AND** 使用本機 CLI 模式
**WHEN** 開始生成評論
**THEN** 應輸出日誌：
  - "🚩 Generating response using GitHub Copilot..."
  - "+ Server: local agent"
  - "+ Model: {model}"
  - "+ Timeout: {timeout}ms"
  - "+ Max Output Tokens: {maxOutputTokens}"
  - "+ Temperature: {temperature}"

#### Scenario: 請求詳情日誌（當啟用時）
**GIVEN** config.showReviewContent 為 true
**WHEN** 發送請求前
**THEN** 應輸出完整請求資訊：
  - System Instruction
  - Prompt
  - Generation Config（包含認證模式）

#### Scenario: 回應詳情日誌（當啟用時）
**GIVEN** config.showReviewContent 為 true
**WHEN** 收到回應後
**THEN** 應輸出完整回應內容

#### Scenario: 成功完成日誌
**GIVEN** 評論生成成功
**WHEN** 方法完成
**THEN** 應輸出日誌：「✅ Response generated successfully」

---

### Requirement: 文件完整性
The system **MUST** provide complete usage and development documentation explaining the three authentication modes. 必須提供完整的使用和開發文件（繁體中文 + 英文），說明三種認證模式。

#### Scenario: 使用者手冊包含三種模式說明
**GIVEN** 使用者查閱 README.md 或 README.zh-TW.md
**WHEN** 尋找 GitHub Copilot 使用說明
**THEN** 應包含清楚的表格說明三種模式：
  - 情境 1：本機 CLI（無 Token、無 Server Address）
  - 情境 2：Token 模式（有 Token）
  - 情境 3：遠端 CLI Server（有 Server Address）
**AND** 每種模式應說明：使用情境、參數組合、前置要求

#### Scenario: 使用者手冊說明互斥關係
**GIVEN** 使用者查閱 GitHub Copilot 章節
**WHEN** 尋找參數設定說明
**THEN** 應明確標註：
  - GitHub Token 和 CLI Server Address 不能同時使用
  - 系統會根據提供的參數自動判斷模式

#### Scenario: 開發者文件包含 Token 認證機制
**GIVEN** 開發者查閱 README-Dev.md
**WHEN** 尋找 GitHub Copilot 實作資訊
**THEN** 應包含：
  - Token 認證機制說明（githubToken + useLoggedInUser: false）
  - 三種模式的 SDK 配置差異
  - 參數互斥驗證邏輯
  - 環境變數設定範例（包含 GitHubCopilotToken）
  - 本地測試指令

#### Scenario: 開發者文件說明測試方法
**GIVEN** 開發者查閱 README-Dev.md
**WHEN** 尋找測試工具使用說明
**THEN** 應包含：
  - test-pr-review.ts 新增的 `--github-token` 參數說明
  - ai-comment.ts 環境變數 GitHubCopilotToken 說明
  - 測試三種模式的範例指令

---
