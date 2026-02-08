# GitHub Copilot Token 認證支援 - 技術設計文件

## Context

### 背景
目前 GitHub Copilot Provider 僅支援兩種認證方式：
1. **本機 CLI 模式**：使用 Build Agent 預先設定的 GitHub 授權
2. **遠端 CLI Server 模式**：連接到指定的 CLI Server（該 Server 需預先設定授權）

這兩種方式都需要預先在環境中設定 GitHub 授權，對於雲端 CI 環境（如 Azure DevOps Hosted Agents）來說不夠彈性。

### 發現
查閱 [GitHub Copilot SDK 文件](https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md#environment-variables)後發現，SDK 支援透過以下配置使用 GitHub Token 進行認證：
```typescript
new CopilotClient({
    githubToken: 'user-provided-token',
    useLoggedInUser: false
})
```

這使得使用者可以直接在 Pipeline 參數中提供 GitHub Token，無需預先在 CI Agent 設定授權。

### 現有架構
- `GithubCopilotService` 直接實作 `AIService` 介面（不繼承 `BaseAIService`）
- 原因：GitHub Copilot 不使用傳統 API Key，`BaseAIService` 會強制驗證 API Key
- `task.json` 中有 `inputGitHubCopilotNetworkType` 欄位讓使用者選擇「內部網路/網際網路」
- 目前 `GithubCopilotService` 建構子參數：`constructor(serverAddress?: string, model: string, timeout?: number)`

### 限制條件
- 必須維持向後相容，不能破壞現有使用者的設定
- 不能新增套件依賴，繼續使用現有的 `@github/copilot-sdk`
- SDK 仍處於 Technical Preview，API 可能變動

## Goals / Non-Goals

**Goals:**
- ✅ 支援透過 GitHub Token 認證，適用於雲端 CI 環境
- ✅ 簡化 UI，移除「內部網路/網際網路」選項
- ✅ 實作參數互斥驗證，防止使用者同時提供 Token 和 Server Address
- ✅ 根據使用者提供的參數自動判斷使用情境
- ✅ 保持向後相容，不影響現有使用者

**Non-Goals:**
- ❌ 不支援同時使用 Token 和 Server Address（技術上可行但語意不清）
- ❌ 不修改 SDK 本身的行為
- ❌ 不支援其他認證方式（如 OAuth flow）

## Decisions

### 決策 1：移除 Network Type 選項，改為自動判斷模式

**決策**：移除 `inputGitHubCopilotNetworkType` 欄位，根據使用者提供的參數自動判斷使用情境。

**理由**：
- 「內部網路/網際網路」用詞容易混淆，使用者不清楚差異
- 實際上使用情境取決於提供的參數，不需要使用者額外選擇
- 簡化 UI，減少使用者的認知負擔

**替代方案 A**：保留 Network Type 選項，新增「Token」模式
- ❌ 拒絕原因：UI 會有三個選項（內部網路/網際網路/Token），更複雜且容易混淆

**替代方案 B**：使用 Radio Button 讓使用者選擇三種模式
- ❌ 拒絕原因：增加 UI 複雜度，且與其他 AI Provider 的設計不一致

**自動判斷邏輯**：
```
if (有 Token && 無 Server Address) → Token 模式
else if (無 Token && 有 Server Address) → 遠端 CLI Server 模式
else if (無 Token && 無 Server Address) → 本機 CLI 模式
else → 拋出錯誤（互斥）
```

---

### 決策 2：三層參數互斥驗證

**決策**：在三個層級實作參數互斥驗證：
1. **UI 層（task.json）**：helpMarkDown 標註互斥關係
2. **主程式層（index.ts）**：讀取參數後立即驗證
3. **服務層（GithubCopilotService）**：建構子驗證

**理由**：
- **深度防禦（Defense in Depth）**：多層驗證確保不會因單點失敗而允許錯誤配置
- **早期失敗（Fail Fast）**：在 index.ts 層級驗證可以在 Pipeline 早期階段失敗，節省執行時間
- **清楚的錯誤訊息**：不同層級可以提供不同程度的錯誤訊息

**替代方案 A**：僅在 GithubCopilotService 驗證
- ❌ 拒絕原因：錯誤發現太晚，使用者已經浪費 Pipeline 執行時間

**替代方案 B**：僅在 index.ts 驗證
- ❌ 拒絕原因：無法防止直接使用 GithubCopilotService 的測試程式碼繞過驗證

**實作細節**：
```typescript
// index.ts 驗證
if (githubToken && serverAddress) {
    throw new Error('⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式');
}

// GithubCopilotService 建構子驗證
if (this.githubToken && this.serverAddress) {
    throw new Error('⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式');
}
```

---

### 決策 3：GithubCopilotService 建構子簽章

**決策**：修改建構子簽章為：
```typescript
constructor(
    githubToken?: string,
    serverAddress?: string,
    model: string = 'gpt-4o',
    timeout?: number
)
```

**理由**：
- `githubToken` 放在第一個參數位置，因為它是新增的核心功能
- 保持 `model` 和 `timeout` 參數不變，維持向後相容
- 所有參數都是可選的，支援三種模式

**替代方案 A**：使用 options 物件
```typescript
constructor(options: {
    githubToken?: string;
    serverAddress?: string;
    model?: string;
    timeout?: number;
})
```
- ❌ 拒絕原因：需要修改所有呼叫處，破壞向後相容

**替代方案 B**：建立新的工廠方法
```typescript
static createWithToken(token: string, model?: string)
static createWithServer(address: string, model?: string)
```
- ❌ 拒絕原因：增加 API 複雜度，且與 AIProviderService 的工廠模式不一致

---

### 決策 4：SDK Client 配置策略

**決策**：根據參數組合在 `initializeClient` 中動態配置 CopilotClient：

```typescript
if (this.githubToken) {
    // Token 模式
    this.client = new CopilotClient({
        githubToken: this.githubToken,
        useLoggedInUser: false
    });
} else if (this.serverAddress) {
    // 遠端 CLI Server 模式
    this.client = new CopilotClient({
        cliUrl: this.serverAddress
    });
} else {
    // 本機 CLI 模式
    this.client = new CopilotClient();
}
```

**理由**：
- 清楚的條件判斷，易於理解和維護
- 延遲初始化（Lazy Initialization）模式保持不變
- 每種模式的配置獨立，不會互相干擾

**替代方案 A**：建立三個不同的 Service 類別
- ❌ 拒絕原因：過度設計，增加程式碼複雜度

**替代方案 B**：使用策略模式（Strategy Pattern）
- ❌ 拒絕原因：當前情境不需要動態切換策略，簡單的條件判斷即可

---

### 決策 5：日誌輸出格式

**決策**：在日誌中清楚標示使用的認證模式：
```
Token 模式：
🚩 Generating response using GitHub Copilot...
+ Authentication: Token
+ Model: gpt-4o
...

遠端 CLI Server 模式：
🚩 Generating response using GitHub Copilot...
+ Server: 192.168.1.100:8080
+ Model: gpt-4o
...

本機 CLI 模式：
🚩 Generating response using GitHub Copilot...
+ Server: local agent
+ Model: gpt-4o
...
```

**理由**：
- 使用者可以從日誌中清楚看到使用的認證模式
- 方便除錯，快速定位問題
- 與現有 Providers 的日誌格式保持一致

**替代方案 A**：不顯示認證模式，僅顯示參數
- ❌ 拒絕原因：使用者需要自己推斷使用的模式，不夠直觀

---

### 決策 6：task.json 欄位設計

**決策**：
- 移除 `inputGitHubCopilotNetworkType` 欄位
- 新增 `inputGitHubCopilotToken` 欄位（type: string, required: false）
- `inputGitHubCopilotServerAddress` 維持選填
- 兩個欄位都在選擇 GitHub Copilot 時顯示（visibleRule: `inputAiProvider == GitHubCopilot`）

**helpMarkDown 內容**：
```json
{
    "name": "inputGitHubCopilotToken",
    "helpMarkDown": "GitHub Fine-grained Personal Access Token (github_pat_xxx) for authenticating with GitHub Copilot service. Required permissions: Account permissions > Copilot > Access: Read-only. Get from GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens. **Note: Classic tokens (ghp_) are not supported. Cannot be used together with CLI Server Address.**"
}
```

**理由**：
- 清楚的說明文字，告知使用者如何取得 Token 和必要權限
- 明確標註互斥關係，防止使用者誤用
- 與其他 AI Provider 的欄位設計保持一致（如 API Key 欄位）

---

### 決策 7：AIProviderService 工廠整合

**決策**：擴充 `registerService` 方法的 config 參數：
```typescript
aiProvider.registerService('GitHubCopilot', {
    githubToken: inputGitHubCopilotToken,
    serverAddress: inputGitHubCopilotServerAddress,
    modelName: inputGitHubCopilotModelName,
    timeout: inputGitHubCopilotTimeout
});
```

**理由**：
- 保持 AIProviderService 的統一介面
- 不需要為 GitHub Copilot 建立特殊邏輯
- 工廠模式處理所有 Provider 的實例化

**實作細節**：
```typescript
// ai-provider.service.ts
case 'githubcopilot':
case 'GitHubCopilot':
    return new GithubCopilotService(
        config.githubToken,
        config.serverAddress,
        config.modelName,
        config.timeout
    );
```

---

### 決策 8：錯誤處理策略

**決策**：為不同的錯誤情境提供明確的錯誤訊息：

| 錯誤情境 | 錯誤訊息 |
|---------|---------|
| 參數互斥 | ⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式 |
| Token 類型不支援 | ⛔ Classic personal access tokens (ghp_) are not supported. Please use Fine-grained personal access token (github_pat_). |
| Token 無效 | ⛔ Invalid or expired GitHub Token. Please check your token and try again. |
| Token 缺少權限 | ⛔ GitHub Token does not have required 'Copilot' Read permission. Please update token permissions in Account permissions > Copilot > Access: Read-only. |
| Token 認證失敗 | ⛔ Failed to authenticate with GitHub Token: {error details} |
| Server 連接失敗 | ⛔ Failed to connect to CLI Server at {serverAddress}: {error details} |

**理由**：
- 清楚的錯誤訊息幫助使用者快速定位問題
- 統一的錯誤訊息格式（⛔ 前綴）與現有程式碼一致
- 包含足夠的診斷資訊但不洩漏敏感資訊

**安全考量**：
- 不在錯誤訊息中輸出完整 Token 內容
- 僅輸出 Token 的前 8 個字元（如需 debug）：`ghp_abc123...`

---

## Risks / Trade-offs

### Risk 1: SDK API 變動
**風險**：GitHub Copilot SDK 處於 Technical Preview，API 可能在未來版本變動

**緩解措施**：
- 鎖定 SDK 版本號，避免自動更新造成破壞
- 在 package.json 使用 `~` 範圍：`"@github/copilot-sdk": "~0.1.21"`
- 建立單元測試覆蓋 SDK 整合點
- 定期追蹤 SDK 更新日誌

---

### Risk 2: Token 安全性
**風險**：使用者可能在 Pipeline 日誌中洩漏 Token

**緩解措施**：
- 在文件中強調使用 Secret Variables 儲存 Token
- 在日誌輸出中遮罩 Token（使用 Azure DevOps 的自動遮罩功能）
- 建議使用具有最小權限的 Token（僅 copilot 權限）
- 在 README 中提供最佳實踐指引

---

### Risk 3: 參數互斥驗證遺漏
**風險**：測試覆蓋不足，導致某些情境下互斥驗證失效

**緩解措施**：
- 三層驗證（task.json、index.ts、GithubCopilotService）
- 建立完整的單元測試，覆蓋所有參數組合
- 在測試工具（test-pr-review.ts）中驗證互斥邏輯
- Code Review 時特別注意驗證邏輯

---

### Risk 4: 向後相容性
**風險**：現有使用者的配置可能受到影響

**緩解措施**：
- 移除 `inputGitHubCopilotNetworkType` 欄位不影響現有使用者，因為該欄位當前僅用於 UI 顯示邏輯
- 保持 `inputGitHubCopilotServerAddress` 的行為不變
- 新增的 `inputGitHubCopilotToken` 為選填，不影響現有配置
- 在文件中提供移轉指引（雖然實際上不需要移轉）

**驗證**：
- 測試現有配置（僅提供 Server Address）仍能正常運作
- 測試現有配置（不提供任何參數）仍能正常運作

---

### Trade-off 1: 不支援同時使用 Token 和 Server Address
**權衡**：技術上 SDK 可能支援同時提供兩者，但我們選擇互斥

**理由**：
- 語意不清：哪一個優先？
- 增加複雜度：需要定義優先順序規則
- 實際使用情境中不需要同時提供

**影響**：使用者必須明確選擇一種認證方式

---

### Trade-off 2: 移除 Network Type 欄位
**權衡**：使用者失去明確選擇「模式」的 UI

**理由**：
- 自動判斷更直觀，減少認知負擔
- 「內部網路/網際網路」用詞容易混淆
- 實際使用情境由參數組合決定，不需要額外選擇

**影響**：使用者需要透過文件了解參數組合與使用情境的對應關係

---

## Migration Plan

### 部署步驟

**步驟 1：程式碼變更**
1. 修改 `src/services/github-copilot.service.ts`
   - 更新建構子簽章
   - 新增參數互斥驗證
   - 修改 `initializeClient` 方法
   - 更新日誌輸出
2. 修改 `src/index.ts`
   - 讀取 `inputGitHubCopilotToken`
   - 新增參數互斥驗證
   - 傳遞參數到 AIProviderService
3. 修改 `src/task.json`
   - 移除 `inputGitHubCopilotNetworkType` 欄位
   - 新增 `inputGitHubCopilotToken` 欄位
   - 更新 helpMarkDown

**步驟 2：更新文件**
1. README.md 和 README.zh-TW.md
   - 更新 GitHub Copilot 章節
   - 說明三種使用情境
   - 提供參數組合表格
2. README-Dev.md
   - 補充 Token 認證機制
   - 更新測試指令

**步驟 3：更新測試工具**
1. 修改 `devscripts/test-pr-review.ts`
   - 新增 `--github-token` 參數
   - 驗證互斥邏輯
2. 修改 `devscripts/ai-comment.ts`
   - 從環境變數讀取 `GitHubCopilotToken`

**步驟 4：建置與打包**
1. 執行 `npm run build` 驗證編譯成功
2. 執行 `npm run packaging:package` 建立 VSIX 檔案
3. 測試 VSIX 安裝和執行

**步驟 5：發佈**
1. 更新 `vss-extension.json` 版本號
2. 上傳至 Azure DevOps Marketplace
3. 更新 Marketplace 說明頁面

### Rollback 策略

**如果發現嚴重問題**：
1. 從 Marketplace 下架新版本
2. 推薦使用者使用前一個穩定版本
3. 修正問題後重新發佈

**向後相容性保證**：
- 現有使用者不需要修改任何配置
- 不提供新參數時行為與之前完全相同

---

## Open Questions

### Q1: Token 權限範圍
**問題**：GitHub Token 需要哪些具體權限？

**狀態**：✅ 已確認

**答案**：
- 必須使用 **Fine-grained personal access token**（格式：`github_pat_`）
- 權限要求：**Account permissions > Copilot > Access: Read-only**
- 不支援 Classic personal access token（`ghp_`，已廢棄）
- 支援的 Token 類型：
  - `gho_` - OAuth user access tokens
  - `ghu_` - GitHub App user access tokens
  - `github_pat_` - Fine-grained personal access tokens

**參考文件**：https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md#environment-variables

---

### Q2: Token 有效期限
**問題**：GitHub Token 過期後的行為如何？SDK 是否會提供明確的錯誤訊息？

**狀態**：需要實際測試驗證

**行動**：
- 測試過期 Token 的錯誤訊息
- 確保錯誤處理邏輯能正確識別並回報

---

### Q3: SDK 的 useLoggedInUser 預設值
**問題**：當不提供 `useLoggedInUser` 時，SDK 的預設行為是什麼？

**狀態**：需要查閱 SDK 文件或原始碼

**行動**：
- 查閱官方文件
- 或者在實作時明確設定 `useLoggedInUser: false`（建議）

---

### Q4: 效能影響
**問題**：Token 認證模式的效能是否與 CLI Server 模式相同？

**狀態**：需要實際測試驗證

**行動**：
- 在測試階段記錄回應時間
- 比較三種模式的效能差異
- 如有明顯差異，在文件中說明

---
