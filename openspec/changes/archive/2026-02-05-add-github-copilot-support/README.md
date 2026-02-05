# 變更提案：新增 GitHub Copilot CLI Server 支援

> **變更 ID**: `add-github-copilot-support`
> **狀態**: 🟡 提案中 (Proposed)
> **類型**: ✨ 新功能 (Feature)
> **提案日期**: 2026-02-04

## 快速概覽

為 AI-PR-AutoReview 新增 GitHub Copilot CLI Server 作為第五個 AI Provider 選項，支援企業內部網路部署的 Copilot 進行 PR Code Review。

### 主要變更
- ✨ 新增 GitHub Copilot 作為 AI Provider 選項
- 🔧 支援內部網路 CLI Server 連接（host:port）
- 📦 整合 @github/copilot-sdk
- 📚 完整的使用者與開發者文件（zh-TW + en）
- 🏗️ 架構設計：直接實作 AIService 介面（不繼承 BaseAIService）

### 目標使用者
- 已部署 GitHub Copilot 企業版的組織
- DevOps 團隊（負責 CI/CD Pipeline 設定）
- 需要統一 AI 工具鏈的開發團隊

---

## 文件結構

```
openspec/changes/add-github-copilot-support/
├── README.md                                    ← 本文件（提案概覽）
├── proposal.md                                  ← 完整提案（動機、範疇、影響）
├── tasks.md                                     ← 實作任務清單（10 階段，30+ 任務）
├── design.md                                    ← 架構設計文件（ADR、設計模式）
└── specs/
    └── github-copilot-provider/
        └── spec.md                              ← 功能規格（Requirements + Scenarios）
```

### 📄 [proposal.md](./proposal.md)
**完整的變更提案文件**

包含內容：
- 變更動機與背景
- 詳細範疇（包含 / 不包含）
- 技術方案概述（架構決策）
- 影響分析（功能、效能、維護）
- 驗證計劃
- 替代方案考量
- 後續工作（Phase 2, 3）

**適合閱讀對象**：決策者、專案經理、技術負責人

---

### ✅ [tasks.md](./tasks.md)
**詳細的實作任務清單**

包含內容：
- 10 個階段，30+ 個具體任務
- 每個任務包含：目標、步驟、驗證方式、預期時間
- 任務依賴關係圖
- 總計預估時間：14-15 小時

**階段概覽**：
1. 依賴與介面準備（35 分鐘）
2. UI 欄位定義（1 小時）
3. 核心服務實作（3.5 小時）
4. 工廠整合（30 分鐘）
5. 主程式整合（55 分鐘）
6. 環境與測試準備（2-3 小時）
7. 文件撰寫（3 小時）
8. 建置與驗證（2 小時）
9. OpenSpec 規格文檔完成（40 分鐘）
10. 歸檔與發佈（30 分鐘）

**適合閱讀對象**：實作工程師、QA 測試人員

---

### 🏗️ [design.md](./design.md)
**架構設計與技術決策文件**

包含內容：
- 系統概覽與架構圖
- 架構決策記錄（ADR）：
  - ADR-001: 為何不繼承 BaseAIService
  - ADR-002: 為何使用 @github/copilot-sdk
  - ADR-003: 延遲初始化策略
- 元件設計（類別結構、狀態機）
- 資料流程（端到端、錯誤路徑）
- 錯誤處理策略
- 效能與安全性考量
- 未來擴充性設計（Phase 2, 3, 4）

**適合閱讀對象**：架構師、資深工程師、程式碼審查者

---

### 📋 [specs/github-copilot-provider/spec.md](./specs/github-copilot-provider/spec.md)
**功能規格文件**

包含內容：
- 13 個 ADDED Requirements
- 每個 Requirement 包含多個 Scenarios（Given-When-Then 格式）
- 驗收標準（功能、品質、文件、效能）
- 非功能性需求（可維護性、可擴充性、相容性、安全性）

**主要 Requirements**：
1. Provider 選項擴充
2. 網路類型選擇（內部網路 / 網際網路）
3. CLI Server 位址設定
4. 模型名稱設定
5. GithubCopilotService 實作
6. CLI Server 連接管理
7. AI 評論生成
8. Token 使用情況追蹤
9. 日誌輸出一致性
10. 錯誤處理與訊息
11. 工廠整合
12. 主程式整合
13. 與現有 Providers 共存
14. 文件完整性
15. 依賴套件管理
16. 建置與打包

**適合閱讀對象**：QA 測試人員、產品經理、合規審查

---

## 關鍵設計決策

### ✅ 決策 1: 直接實作 AIService 介面
**不繼承 BaseAIService**

**理由**：
- GitHub Copilot 不需要 API Key（由 CLI Server 處理認證）
- BaseAIService 的 constructor 強制驗證 apiKey 非空
- 職責分離，不影響現有 Providers

**權衡**：需重新實作約 50 行共用方法（日誌輸出），但程式碼意圖更清晰

---

### ✅ 決策 2: 使用官方 SDK
**採用 @github/copilot-sdk**

**理由**：
- 官方支援，符合最佳實踐
- 自動處理 JSON-RPC 通訊複雜性
- 自動管理連接生命週期

**風險緩解**：
- SDK 處於 Technical Preview，設計彈性介面便於未來調整
- 版本鎖定，定期檢查 breaking changes

---

### ✅ 決策 3: 延遲初始化
**首次呼叫時才建立連接**

**理由**：
- Constructor 保持同步和輕量
- 只在需要時才建立連接
- 錯誤處理更清晰

---

## 實作範疇

### ✅ Phase 1（本次實作）
- [x] 內部網路模式（Intranet）
- [x] CLI Server 連接（host:port）
- [x] UI 欄位和驗證
- [x] 服務實作
- [x] 文件（zh-TW + en）

### 🔜 Phase 2（未來工作）
- [ ] 網際網路模式（Internet）
- [ ] MCP Server 整合
- [ ] OAuth / Token-based 認證

### 🔜 Phase 3（未來工作）
- [ ] 多 CLI Server 負載平衡
- [ ] Server 健康檢查
- [ ] 連接池管理

---

## 驗證與測試

### 功能驗證檢查清單
- [ ] CLI Server 連接成功
- [ ] System instruction 正確傳遞
- [ ] PR 差異正確發送
- [ ] 回應內容正確提取
- [ ] Token usage 正確追蹤或估算
- [ ] 評論成功發佈到 PR

### 錯誤處理驗證
- [ ] 無效 Server Address 格式
- [ ] Server 無法連接
- [ ] 連接逾時
- [ ] 無效或空回應
- [ ] SDK 例外處理

### 相容性驗證
- [ ] 與現有四個 Providers 並存無衝突
- [ ] Debug 模式正常運作
- [ ] 環境變數讀取正確

---

## 預期成果

完成後，使用者可以：
1. ✅ 在 Pipeline Task 中選擇 GitHub Copilot 作為 AI Provider
2. ✅ 設定內部網路 CLI Server 位址（host:port）
3. ✅ 無需 API Key 即可進行 PR Code Review
4. ✅ 體驗與其他 Providers 一致的使用流程
5. ✅ 查閱完整的前置作業文件（CLI Server 設定）

---

## 如何使用這些文件

### 對於決策者
1. 閱讀本 README（快速概覽）
2. 閱讀 [proposal.md](./proposal.md)（完整提案）
3. 檢視影響分析和驗證計劃

### 對於實作工程師
1. 閱讀 [design.md](./design.md)（理解架構設計）
2. 閱讀 [tasks.md](./tasks.md)（按階段執行任務）
3. 參考 [specs/github-copilot-provider/spec.md](./specs/github-copilot-provider/spec.md)（驗證實作符合規格）

### 對於 QA 測試人員
1. 閱讀 [specs/github-copilot-provider/spec.md](./specs/github-copilot-provider/spec.md)（測試案例來源）
2. 參考驗收標準建立測試計劃
3. 使用 Scenarios 作為測試案例（Given-When-Then）

---

## OpenSpec 命令參考

### 驗證提案
```bash
openspec validate add-github-copilot-support --strict
```

### 顯示提案詳情
```bash
openspec show add-github-copilot-support
```

### 顯示規格詳情
```bash
openspec show add-github-copilot-support --json --deltas-only
```

### 歸檔提案（完成實作後）
```bash
openspec archive add-github-copilot-support
```

---

## 參考資料

### 外部文檔
- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [Copilot SDK Technical Preview](https://github.blog/changelog/2026-01-14-copilot-sdk-in-technical-preview/)
- [Getting Started Guide](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)

### 專案文檔
- 專案背景：`openspec/project.md`
- OpenSpec 工作流程：`openspec/AGENTS.md`
- 實作計劃：`C:\Users\lawrence\.claude\plans\iridescent-growing-hennessy.md`

---

## 變更歷史
- **2026-02-04**：初始提案建立
  - 建立 proposal.md、tasks.md、design.md
  - 建立規格文件（specs/github-copilot-provider/spec.md）
  - 建立本 README

---

## 聯絡資訊
- **提案者**: Claude Sonnet 4.5
- **專案**: AI-PR-AutoReview
- **變更 ID**: add-github-copilot-support
