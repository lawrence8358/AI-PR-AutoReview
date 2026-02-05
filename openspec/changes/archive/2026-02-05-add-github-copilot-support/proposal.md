# 新增 GitHub Copilot CLI Server 支援

## 變更 ID
`add-github-copilot-support`

## 狀態
🟡 提案中 (Proposed)

## 變更類型
✨ 新功能 (Feature)

## 摘要
為 AI-PR-AutoReview 擴充功能新增 GitHub Copilot CLI Server 作為第五個 AI Provider 選項，支援企業內部網路部署的 GitHub Copilot CLI Server 進行 PR Code Review。

## Why

Organizations with GitHub Copilot Enterprise deployments cannot leverage their existing infrastructure for PR reviews. This change enables enterprises to unify their AI tooling by using GitHub Copilot CLI Server for automated code reviews, eliminating the need to manage multiple AI provider API keys and reducing costs while providing a consistent AI experience across development workflows.

## What Changes

This change adds GitHub Copilot as a fifth AI Provider option in AI-PR-AutoReview. The implementation includes:
- UI extensions in task.json for GitHub Copilot selection and configuration fields
- New GithubCopilotService class implementing the AIService interface
- Factory integration in AIProviderService to support the new provider
- Intranet mode support for connecting to specified CLI Server (host:port)
- Documentation updates in Traditional Chinese and English
- Integration of @github/copilot-sdk dependency

## 動機與背景

### 問題陳述
目前 AI-PR-AutoReview 支援四種 AI Providers（Google Gemini、OpenAI、Grok、Claude），但對於已部署 GitHub Copilot 企業版的組織而言，無法利用現有的 Copilot 基礎設施進行 PR 審查。

### 使用情境
- **企業內部部署**：組織已在內部網路部署 GitHub Copilot CLI Server，希望重用此基礎設施
- **統一 AI 體驗**：開發者日常使用 Copilot，希望 PR Review 也使用相同的 AI 模型
- **成本優化**：避免額外申請和管理多個 AI Provider 的 API Key

### 目標使用者
- 已部署 GitHub Copilot 企業版的組織
- DevOps 團隊負責 CI/CD Pipeline 設定
- 需要統一 AI 工具鏈的開發團隊

## 變更範疇

### 包含在此變更中
1. **UI 擴充**：在 task.json 新增 GitHub Copilot 選項和相關設定欄位
2. **服務實作**：新增 GithubCopilotService 類別
3. **工廠整合**：在 AIProviderService 中註冊新 Provider
4. **內部網路模式**：支援連接指定的 CLI Server（host:port）
5. **文件更新**：使用手冊、開發者指南、前置作業說明（繁體中文 + 英文）
6. **依賴套件**：整合 @github/copilot-sdk

### 不包含在此變更中（未來工作）
1. **網際網路模式**：透過 MCP Server 連接雲端 Copilot（Phase 2）
2. **進階認證**：OAuth、Token-based 認證機制（Phase 2）
3. **多 Server 負載平衡**：多個 CLI Server 的負載分散（Phase 2）

## 技術方案概述

### 架構設計決策

#### 1. 不繼承 BaseAIService
**決策**：GithubCopilotService 直接實作 AIService 介面

**理由**：
- GitHub Copilot CLI Server 不需要 API Key（認證由 Server 處理）
- BaseAIService 的 constructor 強制驗證 apiKey 非空
- 避免引入不必要的依賴和驗證邏輯

**權衡**：
- ✅ 職責分離清晰，不影響現有 Providers
- ✅ 程式碼意圖明確
- ⚠️ 需要重新實作日誌輸出等共用方法（可從 BaseAIService 複製參考）

#### 2. 使用 GitHub Copilot SDK
**決策**：使用官方 `@github/copilot-sdk` 套件連接 CLI Server

**理由**：
- 官方支援，符合最佳實踐
- SDK 管理 JSON-RPC 通訊複雜性
- 自動處理連接生命週期

**風險與緩解**：
- ⚠️ SDK 處於 Technical Preview 階段，API 可能變動
- ✅ 設計彈性介面，便於未來調整
- ✅ 實測後根據實際行為調整實作

#### 3. 延遲初始化
**決策**：首次呼叫 generateComment 時才建立 Client 連接

**理由**：
- 避免啟動時連接失敗影響整體服務
- 允許設定驗證在連接前完成
- 符合現有 Providers 的模式

### 關鍵實作細節

#### UI 欄位設計
```
AI Provider
├─ [選擇] GitHub Copilot
    ├─ Network Type (pickList)
    │   ├─ 內部網路 (Intranet) ← 實作此選項
    │   └─ 網際網路 (Internet)  ← 保留給未來
    │
    └─ [當選擇 Intranet] CLI Server Address (string, 必填)
        └─ 格式：host:port（例如：192.168.1.100:8080）
```

**visibleRule 邏輯**：
- Network Type：`inputAiProvider == GitHubCopilot`
- Server Address：`inputAiProvider == GitHubCopilot && inputGitHubCopilotNetworkType == Intranet`

#### Token 追蹤策略
1. **優先**：使用 SDK 回應中的 usage 資訊
2. **備案**：若不可用，使用估算（字元數 / 4）
3. **日誌**：明確標註是實際值或估算值

## 影響分析

### 對現有功能的影響
- ✅ **無破壞性變更**：完全向後相容
- ✅ **現有 Providers 不受影響**：獨立實作
- ✅ **使用者體驗一致**：遵循相同的日誌和錯誤處理模式

### 對效能的影響
- ✅ **啟動時無額外成本**：延遲初始化
- ⚠️ **首次請求稍慢**：需建立 Server 連接
- ✅ **後續請求正常**：重用已建立的連接

### 對維護的影響
- ⚠️ **新增 SDK 依賴**：需追蹤 @github/copilot-sdk 更新
- ⚠️ **SDK 處於 Preview**：API 可能變動，需要更新適配
- ✅ **文檔完整**：包含前置作業、測試指南

## 驗證計劃

### 功能驗證
- [ ] CLI Server 連接成功
- [ ] System instruction 正確傳遞到 Copilot
- [ ] PR 差異分析正確發送
- [ ] 回應內容正確提取和顯示
- [ ] Token usage 正確追蹤或估算
- [ ] 評論成功發佈到 PR

### 錯誤處理驗證
- [ ] 無效 Server Address 格式
- [ ] Server 無法連接（網路錯誤）
- [ ] Server 連接逾時
- [ ] 無效或空回應
- [ ] SDK 拋出例外

### 相容性驗證
- [ ] 與現有四個 Providers 並存無衝突
- [ ] Debug 模式正常運作
- [ ] 環境變數讀取正確

### 文件驗證
- [ ] 使用手冊清晰易懂
- [ ] 前置作業步驟可執行
- [ ] 開發者文檔完整

## 相依性

### 外部依賴
- `@github/copilot-sdk`：GitHub Copilot SDK (Technical Preview)
- GitHub Copilot CLI Server：需由組織獨立部署

### 內部依賴
- `src/interfaces/ai-service.interface.ts`：AIService 介面
- `src/services/ai-provider.service.ts`：Provider 工廠
- `src/task.json`：UI 定義

## 時程估計
- **開發**：6-8 小時
- **測試**：3-4 小時
- **文件**：2-3 小時
- **總計**：11-15 小時

## 替代方案考量

### 方案 A：繼承 BaseAIService + 特殊標記
允許傳入特殊 API Key（如 'MANAGED_BY_SERVER'）繞過驗證

**優點**：重用 BaseAIService 的共用方法
**缺點**：程式碼意圖不清晰，hack 感重

**決策**：❌ 不採用

### 方案 B：修改 BaseAIService 使 apiKey 可選
調整 BaseAIService constructor，允許 apiKey 為可選參數

**優點**：未來其他無需 API Key 的 Provider 可直接使用
**缺點**：影響現有四個 Providers，需要完整回歸測試

**決策**：❌ 不採用（影響範圍過大）

### 方案 C：直接實作 AIService（已採用）
**決策**：✅ 採用（見技術方案概述）

## 後續工作

### Phase 2：網際網路模式
- 透過 MCP Server 連接雲端 Copilot
- 實作 OAuth 或 Token-based 認證
- 更新 UI 和文件

### Phase 3：進階功能
- 多 CLI Server 負載平衡
- Server 健康檢查
- 連接池管理

## 參考資料
- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [Copilot SDK Technical Preview](https://github.blog/changelog/2026-01-14-copilot-sdk-in-technical-preview/)
- [Getting Started Guide](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- 專案計劃：`C:\Users\lawrence\.claude\plans\iridescent-growing-hennessy.md`

## 變更作者
- 提案者：Claude Sonnet 4.5
- 審查者：待指定
- 核准者：待指定

## 變更歷史
- 2026-02-04：初始提案
