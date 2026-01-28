# 專案背景 (Project Context)

## 目的 (Purpose)
AI PR AutoReview 是一個 Azure DevOps Pipeline 任務，利用 AI 自動為 Pull Request 產生程式碼審查。
它支援多種 AI 提供者，包括 Google Gemini、OpenAI、xAI Grok 和 Anthropic Claude。

## 技術堆疊 (Tech Stack)
- **語言**: TypeScript
- **執行環境**: Node.js (目標版本 node22)
- **框架/函式庫**:
  - `azure-devops-node-api`: 用於與 Azure DevOps 互動
  - `openai`: 用於 OpenAI 相容的 API SDK
  - `@octokit/rest`: 用於 GitHub 互動
- **建置工具**: esbuild (打包成 CJS)
- **打包工具**: tfx-cli (用於 Azure DevOps Extension)

## 專案慣例 (Project Conventions)

### 程式碼風格 (Code Style)
- 使用 TypeScript 並啟用嚴格型別檢查 (`npm run typecheck`)
- 使用 `src/task.json` 定義任務，並嚴格與 `dist/task.json` 同步

### 架構模式 (Architecture Patterns)
- **進入點**: `src/index.ts`
- **服務層**: AI 互動邏輯封裝在服務中 (例如 `GeminiService`, `OpenAIService`)
- **開發腳本**: 用於模擬 Azure 環境的本地測試腳本位於 `devscripts/`

### 測試策略 (Testing Strategy)
- **型別檢查**: `npm run typecheck`
- **本地除錯**: `npm run debug` (搭配 `devscripts/.env` 環境變數)
- **模擬**: 使用 `npm run devscripts:ai` 在本地測試 AI 回應，無需執行完整的 Pipeline

### Git 工作流程 (Git Workflow)
- 功能分支 (Feature branches)
- PR 審查 (PRs for review)

## 領域背景 (Domain Context)
- **Azure Pipelines**: 理解 VSS Task 結構 (`task.json`) 和輸入參數
- **LLM 整合**: 處理 Token 限制、Prompt Engineering 和 API 錯誤處理

## 重要限制 (Important Constraints)
- 擴充功能必須打包成單一 JS 檔案 (`dist/index.js`) 才能在 Azure DevOps 執行
- 擴充功能套件的大小限制

## 外部相依性 (External Dependencies)
- Azure DevOps API
- OpenAI API / Gemini API / Claude API / Grok API
