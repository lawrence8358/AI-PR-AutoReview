# GitHub Copilot Provider 規格

> 定義 GitHub Copilot 作為 AI Provider 的功能需求和行為規範

## 概述

本規格定義 AI-PR-AutoReview 支援 GitHub Copilot CLI Server 作為 AI Provider 的完整需求，包括 UI 設定、服務實作、連接管理和錯誤處理。

---

## ADDED Requirements

### Requirement: Provider 選項擴充
**ID**: `github-copilot-provider-option`
**優先級**: 高
**類別**: UI / Configuration

The AI Provider selection list SHALL include a GitHub Copilot option. AI Provider 選擇清單必須包含 GitHub Copilot 選項。

#### Scenario: 使用者在 Pipeline Task 中選擇 GitHub Copilot
**Given** 使用者正在配置 AI-PR-AutoReview Task
**When** 使用者點擊 "AI Provider" 下拉選單
**Then** 選單中應包含 "GitHub Copilot" 選項
**And** 選項顯示為 "GitHub Copilot"（使用者友善名稱）

#### Scenario: 選擇 GitHub Copilot 後顯示相關設定欄位
**Given** 使用者選擇 "GitHub Copilot" 作為 AI Provider
**When** 選擇完成後
**Then** 應顯示 "GitHub Copilot Network Type" 欄位
**And** 應隱藏其他 Providers 的設定欄位（如 Gemini API Key、OpenAI API Key 等）

---

### Requirement: 網路類型選擇
**ID**: `github-copilot-network-type`
**優先級**: 高
**類別**: UI / Configuration

Users SHALL be able to select the GitHub Copilot connection type: intranet or internet. 使用者必須能選擇 GitHub Copilot 的連接類型:內部網路或網際網路。

#### Scenario: 顯示網路類型選項
**Given** 使用者選擇 "GitHub Copilot" 作為 AI Provider
**When** UI 渲染完成
**Then** 應顯示 "Network Type" 下拉選單
**And** 預設值為 "內部網路 (Intranet)"
**And** 選項包含：
  - "內部網路 (Intranet)"
  - "網際網路 (Internet - 即將推出)"

#### Scenario: 選擇內部網路模式
**Given** 使用者在 "Network Type" 選擇 "內部網路"
**When** 選擇完成後
**Then** 應顯示 "CLI Server Address" 欄位
**And** 該欄位標記為必填
**And** 應隱藏網際網路模式的相關欄位

#### Scenario: 選擇網際網路模式
**Given** 使用者在 "Network Type" 選擇 "網際網路"
**When** 選擇完成後
**Then** 應顯示 "網際網路模式（即將推出）" 唯讀欄位
**And** 顯示訊息："網際網路模式將在未來版本中提供，包含 MCP Server 整合與授權機制。"
**And** 應隱藏內部網路模式的 Server Address 欄位

---

### Requirement: CLI Server 位址設定
**ID**: `github-copilot-server-address`
**優先級**: 高
**類別**: UI / Configuration

In intranet mode, users SHALL be able to specify the GitHub Copilot CLI Server address. 在內部網路模式下，使用者必須能指定 GitHub Copilot CLI Server 的位址。

#### Scenario: 輸入 Server 位址
**Given** 使用者選擇 GitHub Copilot + 內部網路模式
**When** UI 顯示 "CLI Server Address" 欄位
**Then** 該欄位類型為文字輸入框
**And** 該欄位標記為必填
**And** Placeholder 或 helpText 顯示格式範例："192.168.1.100:8080"

#### Scenario: Server 位址格式驗證
**Given** 使用者輸入 Server 位址
**When** Pipeline 執行時
**Then** 系統必須驗證格式為 `host:port`
**And** 如果格式錯誤，應拋出清晰的錯誤訊息："Invalid server address format: {input}. Expected format: host:port"

#### Scenario: 支援的位址格式
**Given** 使用者輸入 Server 位址
**When** 位址格式為以下任一種
**Then** 應接受並正確解析：
  - IPv4 + Port：`192.168.1.100:8080`
  - Domain + Port：`copilot.internal.company.com:8080`
  - Localhost + Port：`localhost:8080`

---

### Requirement: 模型名稱設定（可選）
**ID**: `github-copilot-model-name`
**優先級**: 中
**類別**: UI / Configuration

The system SHALL support optional model name specification for GitHub Copilot. If not specified, the system SHALL use a default model. 系統必須支援使用者選擇性地指定 GitHub Copilot 使用的模型名稱，若未指定則使用預設模型。

#### Scenario: 預設模型名稱
**Given** 使用者選擇 GitHub Copilot + 內部網路模式
**And** 未明確指定模型名稱
**When** Pipeline 執行時
**Then** 應使用預設模型："gpt-4o"

#### Scenario: 自訂模型名稱
**Given** 使用者在 "Model Name" 欄位輸入 "gpt-4"
**When** Pipeline 執行時
**Then** 應使用使用者指定的模型："gpt-4"

---

### Requirement: GithubCopilotService 實作
**ID**: `github-copilot-service-implementation`
**優先級**: 高
**類別**: Service / Core

The system MUST implement a GithubCopilotService class to support the GitHub Copilot AI Provider. 必須實作 GithubCopilotService 類別以支援 GitHub Copilot AI Provider。

#### Scenario: 服務實例化
**Given** AIProviderService 收到建立 GitHub Copilot 服務的請求
**And** 配置包含 serverAddress 和 modelName
**When** 呼叫 `getService('githubcopilot')`
**Then** 應成功建立 GithubCopilotService 實例
**And** 實例包含正確的 serverAddress 和 modelName

#### Scenario: 實作 AIService 介面
**Given** GithubCopilotService 類別
**When** 檢查類別定義
**Then** 必須實作 AIService 介面
**And** 實作 `generateComment(systemInstruction, prompt, config)` 方法
**And** 回傳型別為 `Promise<AIResponse>`

#### Scenario: 不繼承 BaseAIService
**Given** GithubCopilotService 類別
**When** 檢查繼承關係
**Then** 不應繼承 BaseAIService
**And** 直接實作 AIService 介面
**Rationale**: GitHub Copilot 不需要 API Key，BaseAIService 的 constructor 會強制驗證 API Key

---

### Requirement: CLI Server 連接管理
**ID**: `github-copilot-connection-management`
**優先級**: 高
**類別**: Service / Connection

The service SHALL correctly manage connections to the GitHub Copilot CLI Server. 服務必須正確管理與 GitHub Copilot CLI Server 的連接。

#### Scenario: 延遲初始化連接
**Given** GithubCopilotService 實例已建立
**When** constructor 執行完成
**Then** 不應立即建立與 CLI Server 的連接
**And** 連接應在首次呼叫 `generateComment()` 時建立

#### Scenario: 成功連接到 CLI Server
**Given** 呼叫 `generateComment()` 方法
**And** CLI Server 在指定位址可用
**When** 初始化連接
**Then** 應成功建立 CopilotClient 實例
**And** 應輸出日誌："✅ Connected to GitHub Copilot CLI Server at {serverAddress}"

#### Scenario: 連接失敗處理
**Given** 呼叫 `generateComment()` 方法
**And** CLI Server 在指定位址不可用
**When** 嘗試初始化連接
**Then** 應拋出錯誤："⛔ Failed to connect to CLI Server at {serverAddress}: {error details}"

#### Scenario: 重用已建立的連接
**Given** GithubCopilotService 已成功連接到 CLI Server
**When** 再次呼叫 `generateComment()` 方法
**Then** 應重用現有連接
**And** 不應建立新連接

---

### Requirement: AI 評論生成
**ID**: `github-copilot-generate-comment`
**優先級**: 高
**類別**: Service / Core

The service MUST be able to send PR diffs to GitHub Copilot and receive comment responses. 服務必須能夠發送 PR 差異到 GitHub Copilot 並取得評論回應。

#### Scenario: 發送請求到 Copilot
**Given** GithubCopilotService 已連接到 CLI Server
**And** 收到 systemInstruction、prompt 和 config 參數
**When** 呼叫 `generateComment(systemInstruction, prompt, config)`
**Then** 應建立 Copilot Session
**And** Session 配置應包含：
  - model: 使用者指定或預設的模型名稱
  - systemMessage: systemInstruction 參數
  - temperature: config.temperature（如果提供）
  - maxTokens: config.maxOutputTokens（如果提供）

#### Scenario: 接收並提取回應
**Given** 已發送請求到 Copilot
**When** 收到 Copilot 回應
**Then** 應正確提取回應內容
**And** 回應內容不為空
**And** 回傳 AIResponse 物件，包含 content 欄位

#### Scenario: 處理空回應
**Given** 已發送請求到 Copilot
**When** 收到空或無效回應
**Then** 應回傳預設訊息："No response generated"
**And** 不應拋出例外

---

### Requirement: Token 使用情況追蹤
**ID**: `github-copilot-token-usage`
**優先級**: 中
**類別**: Service / Monitoring

The service SHALL track or estimate token usage. 服務必須追蹤或估算 Token 使用情況。

#### Scenario: 提取 SDK 提供的 Token Usage
**Given** Copilot SDK 回應包含 usage 資訊
**When** 處理回應
**Then** 應正確提取 inputTokens 和 outputTokens
**And** AIResponse 應包含這些值
**And** 應輸出日誌："📊 Token Usage - Input: {inputTokens}, Output: {outputTokens}"

#### Scenario: SDK 不提供 Token Usage 時的估算
**Given** Copilot SDK 回應不包含 usage 資訊
**When** 處理回應
**Then** 應使用簡易估算：outputTokens = ceil(content.length / 4)
**And** inputTokens 為 undefined
**And** 應輸出日誌標註為估算值

#### Scenario: Token Usage 格式相容性
**Given** SDK 回應可能使用不同的欄位名稱
**When** 提取 Token Usage
**Then** 應嘗試以下欄位名稱（優先順序）：
  - inputTokens / outputTokens
  - promptTokens / completionTokens
  - input_tokens / output_tokens

---

### Requirement: 日誌輸出一致性
**ID**: `github-copilot-logging`
**優先級**: 中
**類別**: Service / Observability

The service's log output SHALL be consistent with existing Providers. 服務的日誌輸出必須與現有 Providers 保持一致。

#### Scenario: 生成開始日誌
**Given** 呼叫 `generateComment()` 方法
**When** 開始生成評論
**Then** 應輸出日誌：
  - "🚩 Generating response using GitHub Copilot..."
  - "+ Server: {serverAddress}"
  - "+ Model: {model}"
  - "+ Max Output Tokens: {maxOutputTokens}"
  - "+ Temperature: {temperature}"

#### Scenario: 請求詳情日誌（當啟用時）
**Given** config.showReviewContent 為 true
**When** 發送請求前
**Then** 應輸出完整請求資訊：
  - System Instruction
  - Prompt
  - Generation Config（包含 Server 位址）

#### Scenario: 回應詳情日誌（當啟用時）
**Given** config.showReviewContent 為 true
**When** 收到回應後
**Then** 應輸出完整回應內容

#### Scenario: 成功完成日誌
**Given** 評論生成成功
**When** 方法完成
**Then** 應輸出日誌："✅ Response generated successfully"

---

### Requirement: 錯誤處理與訊息
**ID**: `github-copilot-error-handling`
**優先級**: 高
**類別**: Service / Reliability

The service MUST provide clear error handling and meaningful error messages. 服務必須提供清晰的錯誤處理和有意義的錯誤訊息。

#### Scenario: Server 位址格式錯誤
**Given** 使用者輸入無效的 Server 位址（如 "invalid-address"）
**When** 系統驗證位址格式
**Then** 應拋出錯誤："⛔ Invalid server address format: invalid-address. Expected format: host:port"

#### Scenario: Server 連接失敗
**Given** CLI Server 不可用或網路錯誤
**When** 嘗試連接
**Then** 應拋出錯誤："⛔ Failed to connect to CLI Server at {serverAddress}: {error details}"
**And** 錯誤訊息應包含有助於診斷的資訊

#### Scenario: SDK 操作失敗
**Given** GitHub Copilot SDK 拋出例外
**When** 執行 SDK 操作（createSession、sendAndWait）
**Then** 應捕獲例外並重新拋出："⛔ GitHub Copilot SDK error: {error message}"
**And** 保留原始錯誤訊息以便診斷

#### Scenario: 錯誤訊息前綴一致性
**Given** 任何錯誤發生
**When** 拋出錯誤
**Then** 錯誤訊息必須以 "⛔" emoji 開頭
**And** 遵循格式："⛔ [Component/Context]: [Details]"

---

### Requirement: 工廠整合
**ID**: `github-copilot-factory-integration`
**優先級**: 高
**類別**: Service / Integration

The AIProviderService MUST support creating and managing GitHub Copilot service instances. AIProviderService 必須支援建立和管理 GitHub Copilot 服務實例。

#### Scenario: 註冊 GitHub Copilot 配置
**Given** AIProviderService 實例
**When** 呼叫 `registerService('githubcopilot', { serverAddress, modelName })`
**Then** 應成功註冊配置
**And** 不應驗證 apiKey（因為 GitHub Copilot 不需要）
**And** 應驗證 serverAddress 不為空

#### Scenario: 建立 GitHub Copilot 服務實例
**Given** 已註冊 GitHub Copilot 配置
**When** 呼叫 `getService('githubcopilot')`
**Then** 應回傳 GithubCopilotService 實例
**And** 實例使用正確的 serverAddress 和 modelName

#### Scenario: 服務實例快取
**Given** 已建立 GitHub Copilot 服務實例
**When** 再次呼叫 `getService('githubcopilot')`
**Then** 應回傳相同的實例（快取）
**And** 不應建立新實例

---

### Requirement: 主程式整合
**ID**: `github-copilot-main-integration`
**優先級**: 高
**類別**: Integration / Pipeline

The main program (index.ts) SHALL support reading GitHub Copilot configuration from Pipeline inputs. 主程式（index.ts）必須支援從 Pipeline 輸入讀取 GitHub Copilot 配置。

#### Scenario: 讀取 GitHub Copilot 配置（Pipeline 模式）
**Given** Pipeline 執行 AI-PR-AutoReview Task
**And** 使用者選擇 GitHub Copilot + 內部網路模式
**When** index.ts 讀取 Task 輸入
**Then** 應正確讀取：
  - inputAiProvider: "GitHubCopilot"
  - inputGitHubCopilotServerAddress: 使用者輸入的位址
  - inputGitHubCopilotModelName: 使用者輸入的模型或預設值

#### Scenario: 讀取 GitHub Copilot 配置（Debug 模式）
**Given** 開發者在本地執行 Debug 模式
**And** .env 檔案包含 GitHub Copilot 配置
**When** index.ts 讀取環境變數
**Then** 應正確讀取：
  - AiProvider: "GitHubCopilot"
  - GitHubCopilotServerAddress: 環境變數值
  - ModelName: 環境變數值或預設值

#### Scenario: 傳遞配置到 AIProviderService
**Given** 已讀取 GitHub Copilot 配置
**When** 呼叫 `aiProvider.registerService()`
**Then** 應傳遞正確的參數：
  - provider: 'GitHubCopilot'
  - config.serverAddress: 讀取的 Server 位址
  - config.modelName: 讀取的模型名稱
  - config.apiKey: 空字串或任意值（不使用）

---

### Requirement: 與現有 Providers 共存
**ID**: `github-copilot-coexistence`
**優先級**: 高
**類別**: Integration / Compatibility

GitHub Copilot MUST coexist with the existing four Providers without affecting their functionality. GitHub Copilot 必須與現有四個 Providers 並存且不影響其功能。

#### Scenario: 選擇其他 Providers 時隱藏 GitHub Copilot 欄位
**Given** 使用者選擇非 GitHub Copilot 的 Provider（如 Google Gemini）
**When** UI 渲染
**Then** 應隱藏所有 GitHub Copilot 相關欄位
**And** 顯示對應 Provider 的欄位（如 Gemini API Key）

#### Scenario: 現有 Providers 不受影響
**Given** GitHub Copilot 支援已實作
**When** 使用者選擇並執行 Google、OpenAI、Grok 或 Claude
**Then** 所有功能應正常運作
**And** 不應有任何 breaking changes
**And** 日誌、錯誤處理、Token 追蹤等行為保持一致

---

### Requirement: 文件完整性
**ID**: `github-copilot-documentation`
**優先級**: 高
**類別**: Documentation

The system MUST provide complete usage and development documentation (Traditional Chinese + English). 必須提供完整的使用和開發文件（繁體中文 + 英文）。

#### Scenario: 使用者手冊包含 GitHub Copilot 說明
**Given** 使用者查閱 README.md 或 README.zh-TW.md
**When** 尋找 AI Provider 相關資訊
**Then** 應包含 GitHub Copilot 章節
**And** 說明如何選擇和設定 GitHub Copilot

#### Scenario: 前置作業文件完整
**Given** 使用者查閱使用手冊
**When** 尋找 GitHub Copilot CLI 前置作業
**Then** 應包含專門章節說明：
  - 適用情境
  - CLI Server 安裝步驟
  - 啟動 Server 模式
  - 測試連通性
  - Pipeline Task 設定範例
  - 注意事項

#### Scenario: 開發者文件包含架構說明
**Given** 開發者查閱 README-Dev.md
**When** 尋找 GitHub Copilot 實作資訊
**Then** 應包含：
  - 為何不繼承 BaseAIService 的說明
  - 環境變數設定範例
  - 本地測試指令
  - 架構設計決策
  - SDK 版本和相容性說明
  - 已知限制

---

### Requirement: 依賴套件管理
**ID**: `github-copilot-dependencies`
**優先級**: 高
**類別**: Infrastructure

The system SHALL correctly manage GitHub Copilot SDK dependencies. 必須正確管理 GitHub Copilot SDK 依賴。

#### Scenario: 安裝 SDK 套件
**Given** package.json 檔案
**When** 執行 `npm install`
**Then** 應成功安裝 @github/copilot-sdk
**And** 版本應鎖定或使用 ~ 範圍（避免破壞性更新）

#### Scenario: SDK 版本追蹤
**Given** GitHub Copilot SDK 處於 Technical Preview
**When** SDK 有新版本發佈
**Then** 應檢查 breaking changes
**And** 必要時更新 GithubCopilotService 實作
**And** 更新 package.json 版本

---

### Requirement: 建置與打包
**ID**: `github-copilot-build`
**優先級**: 高
**類別**: Infrastructure

GitHub Copilot support MUST compile and package correctly. GitHub Copilot 支援必須正確編譯和打包。

#### Scenario: TypeScript 編譯成功
**Given** 所有 GitHub Copilot 相關程式碼已實作
**When** 執行 `npm run build`
**Then** 應無 TypeScript 編譯錯誤
**And** dist/ 目錄包含編譯後的檔案

#### Scenario: Task.json 正確打包
**Given** src/task.json 包含 GitHub Copilot 欄位
**When** 執行建置流程
**Then** dist/task.json 應包含所有 GitHub Copilot 欄位
**And** visibleRule 邏輯正確

#### Scenario: Extension 打包成功
**Given** 所有檔案已編譯
**When** 執行 `npm run packaging:package`
**Then** 應成功生成 .vsix 檔案
**And** 檔案大小合理（包含 SDK 依賴）

---

## 驗收標準

### 功能驗收
- [ ] 使用者能在 Pipeline Task 中選擇 GitHub Copilot
- [ ] 內部網路模式能成功連接到 CLI Server
- [ ] 能正確發送 PR 差異並取得評論回應
- [ ] Token usage 正確追蹤或估算
- [ ] 評論成功發佈到 PR

### 品質驗收
- [ ] 所有錯誤情境都有清晰的錯誤訊息
- [ ] 日誌輸出與現有 Providers 一致
- [ ] TypeScript 編譯無錯誤或警告
- [ ] 與現有 Providers 並存無衝突

### 文件驗收
- [ ] README.md 和 README.zh-TW.md 包含完整說明
- [ ] 前置作業章節清晰可執行
- [ ] README-Dev.md 包含架構說明和測試指南

### 效能驗收
- [ ] 首次請求延遲 < 3 秒（含連接建立）
- [ ] 後續請求延遲 < 1 秒（重用連接）
- [ ] 無記憶體洩漏

---

## 非功能性需求

### 可維護性
- 程式碼清晰易讀，遵循現有風格
- 錯誤處理完善，便於診斷
- 日誌輸出充足，便於追蹤

### 可擴充性
- 設計彈性介面，便於未來支援網際網路模式
- 不影響現有架構，便於新增其他 Providers

### 相容性
- 與現有四個 Providers 完全相容
- 支援 Node.js 16+ 和 Node.js 20+

### 安全性
- Server 位址驗證防止注入攻擊
- 敏感資訊不在日誌中完整顯示

---

## 變更歷史
- 2026-02-04：初始規格建立
