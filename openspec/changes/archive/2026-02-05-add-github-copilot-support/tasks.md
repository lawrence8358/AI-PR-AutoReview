# 實作任務清單

> 本文件列出實作 GitHub Copilot 支援的所有任務，按執行順序排列。每個任務都是可驗證的小步驟。

## 階段 1：依賴與介面準備

### Task 1.1：安裝 GitHub Copilot SDK
**目標**：新增必要的套件依賴

**步驟**：
1. 在 `package.json` 中新增 `@github/copilot-sdk` 依賴
2. 執行 `npm install`
3. 驗證套件正確安裝

**驗證**：
```bash
npm list @github/copilot-sdk
```

**預期時間**：15 分鐘

---

### Task 1.2：擴充 AIServiceConfig 介面
**目標**：支援 serverAddress 參數

**檔案**：`src/interfaces/ai-service.interface.ts`

**變更**：
```typescript
export interface AIServiceConfig {
    apiKey: string;
    modelName: string;
    apiEndpoint?: string;
    serverAddress?: string;  // 新增
}
```

**驗證**：TypeScript 編譯無錯誤

**預期時間**：10 分鐘

---

### Task 1.3：擴充 PipelineInputs 介面
**目標**：支援從 Pipeline 傳入 serverAddress

**檔案**：`src/interfaces/pipeline-inputs.interface.ts`

**變更**：
```typescript
export interface PipelineInputs {
    // ... 現有欄位 ...
    serverAddress?: string;  // 新增
}
```

**驗證**：TypeScript 編譯無錯誤

**預期時間**：10 分鐘

---

## 階段 2：UI 欄位定義

### Task 2.1：新增 GitHub Copilot 到 Provider 選項
**目標**：在 AI Provider 下拉選單中新增 GitHub Copilot

**檔案**：`src/task.json`（第 21-32 行）

**變更**：在 `inputAiProvider` 的 options 中新增：
```json
"GitHubCopilot": "GitHub Copilot"
```

**驗證**：
- JSON 語法正確
- 執行 `npm run build` 成功
- `dist/task.json` 包含新選項

**預期時間**：10 分鐘

---

### Task 2.2：新增網路類型選擇欄位
**目標**：讓使用者選擇內部網路或網際網路模式

**檔案**：`src/task.json`（插入於 Claude 欄位之後）

**變更**：新增 input：
```json
{
    "name": "inputGitHubCopilotNetworkType",
    "type": "pickList",
    "label": "GitHub Copilot Network Type",
    "defaultValue": "Intranet",
    "required": true,
    "helpMarkDown": "選擇 GitHub Copilot 連接類型。",
    "visibleRule": "inputAiProvider == GitHubCopilot",
    "options": {
        "Intranet": "內部網路 (Intranet)",
        "Internet": "網際網路 (Internet - 即將推出)"
    }
}
```

**驗證**：
- 選擇 GitHub Copilot 後，此欄位顯示
- 選擇其他 Provider 後，此欄位隱藏

**預期時間**：15 分鐘

---

### Task 2.3：新增 Server 位址欄位
**目標**：讓使用者輸入 CLI Server 的位址

**檔案**：`src/task.json`

**變更**：新增 input：
```json
{
    "name": "inputGitHubCopilotServerAddress",
    "type": "string",
    "label": "CLI Server Address",
    "defaultValue": "",
    "required": true,
    "helpMarkDown": "輸入 GitHub Copilot CLI Server 位址（IP 或 Domain + Port）。範例：192.168.1.100:8080",
    "visibleRule": "inputAiProvider == GitHubCopilot && inputGitHubCopilotNetworkType == Intranet"
}
```

**驗證**：
- 選擇 GitHub Copilot + Intranet 後，此欄位顯示且必填
- 選擇 Internet 後，此欄位隱藏

**預期時間**：15 分鐘

---

### Task 2.4：新增模型名稱欄位（可選）
**目標**：允許使用者自訂模型名稱

**檔案**：`src/task.json`

**變更**：新增 input：
```json
{
    "name": "inputGitHubCopilotModelName",
    "type": "string",
    "label": "Model Name",
    "defaultValue": "gpt-4o",
    "required": false,
    "helpMarkDown": "選填。預設為 gpt-4o。",
    "visibleRule": "inputAiProvider == GitHubCopilot && inputGitHubCopilotNetworkType == Intranet"
}
```

**驗證**：欄位正確顯示，有預設值

**預期時間**：10 分鐘

---

### Task 2.5：新增網際網路模式佔位欄位
**目標**：顯示網際網路模式即將推出的訊息

**檔案**：`src/task.json`

**變更**：新增唯讀 input：
```json
{
    "name": "inputGitHubCopilotInternetNote",
    "type": "string",
    "label": "網際網路模式（即將推出）",
    "defaultValue": "網際網路模式將在未來版本中提供，包含 MCP Server 整合與授權機制。",
    "required": false,
    "helpMarkDown": "此功能保留給未來實作。",
    "visibleRule": "inputAiProvider == GitHubCopilot && inputGitHubCopilotNetworkType == Internet",
    "properties": {
        "readOnly": true
    }
}
```

**驗證**：選擇 Internet 模式後顯示此訊息

**預期時間**：10 分鐘

---

## 階段 3：核心服務實作

### Task 3.1：建立 GithubCopilotService 骨架
**目標**：建立類別檔案和基本結構

**檔案**：`src/services/github-copilot.service.ts`（新建）

**步驟**：
1. 建立檔案
2. 實作 constructor（參數驗證）
3. 實作 AIService 介面簽名（空方法）

**驗證**：TypeScript 編譯無錯誤

**預期時間**：30 分鐘

---

### Task 3.2：實作 Server 位址解析
**目標**：解析 host:port 格式的位址

**檔案**：`src/services/github-copilot.service.ts`

**步驟**：
1. 實作 `parseServerAddress()` 方法
2. 加入格式驗證（必須是 host:port）
3. 加入錯誤處理

**驗證**：
```typescript
// 單元測試範例
parseServerAddress('192.168.1.100:8080') // ['192.168.1.100', '8080']
parseServerAddress('invalid') // 拋出錯誤
```

**預期時間**：20 分鐘

---

### Task 3.3：實作 Client 初始化
**目標**：連接到 GitHub Copilot CLI Server

**檔案**：`src/services/github-copilot.service.ts`

**步驟**：
1. 實作 `initializeClient()` 方法
2. 動態引入 @github/copilot-sdk
3. 建立 CopilotClient 並連接到指定 Server
4. 加入錯誤處理和日誌

**驗證**：
- 連接成功時顯示成功訊息
- 連接失敗時拋出有意義的錯誤

**預期時間**：1 小時（需實測 SDK API）

---

### Task 3.4：實作 generateComment 主邏輯
**目標**：發送 PR 差異到 Copilot 並取得回應

**檔案**：`src/services/github-copilot.service.ts`

**步驟**：
1. 實作 `generateComment()` 方法
2. 呼叫 `initializeClient()` 確保連接
3. 建立 Session 並設定參數（model, systemMessage, temperature, maxTokens）
4. 發送 prompt 並等待回應
5. 提取回應內容

**驗證**：
- 能成功發送請求
- 能正確接收並提取回應內容

**預期時間**：1 小時（需實測 SDK API）

---

### Task 3.5：實作 Token 使用情況追蹤
**目標**：提取或估算 Token 使用量

**檔案**：`src/services/github-copilot.service.ts`

**步驟**：
1. 實作 `extractTokenUsage()` 方法
2. 嘗試從 SDK 回應提取 usage 資訊
3. 實作 `estimateTokenUsage()` 作為備案
4. 加入日誌輸出

**驗證**：
- 如果 SDK 提供 usage，正確提取
- 如果不提供，使用估算且標註

**預期時間**：30 分鐘

---

### Task 3.6：實作日誌輸出方法
**目標**：保持與現有 Providers 一致的日誌格式

**檔案**：`src/services/github-copilot.service.ts`

**步驟**：
1. 實作 `printRequestInfo()` 方法（複製參考 BaseAIService）
2. 實作 `printResponseInfo()` 方法
3. 調整格式以包含 Server 位址

**驗證**：日誌輸出清晰易讀

**預期時間**：20 分鐘

---

### Task 3.7：實作資源清理
**目標**：正確關閉連接

**檔案**：`src/services/github-copilot.service.ts`

**步驟**：
1. 實作 `dispose()` 方法
2. 檢查並呼叫 client.close()（如果 SDK 提供）

**驗證**：無資源洩漏

**預期時間**：15 分鐘

---

## 階段 4：工廠整合

### Task 4.1：引入 GithubCopilotService
**目標**：讓 AIProviderService 可使用新服務

**檔案**：`src/services/ai-provider.service.ts`

**變更**：在檔案頂部新增：
```typescript
import { GithubCopilotService } from './github-copilot.service';
```

**驗證**：TypeScript 編譯無錯誤

**預期時間**：5 分鐘

---

### Task 4.2：修改 registerService 驗證邏輯
**目標**：GitHub Copilot 使用 serverAddress 而非 apiKey

**檔案**：`src/services/ai-provider.service.ts`（第 29-39 行）

**變更**：
```typescript
public registerService(provider: string, config: AIServiceConfig): void {
    const providerLower = provider.toLowerCase();

    // GitHub Copilot 使用 serverAddress，不需要 apiKey
    if (providerLower === 'githubcopilot') {
        if (!config.serverAddress || config.serverAddress.trim() === '') {
            throw new Error('⛔ Server address is required for GitHub Copilot');
        }
    } else {
        if (!config.apiKey || config.apiKey.trim() === '') {
            throw new Error('⛔ API key is required');
        }
    }

    if (!config.modelName || config.modelName.trim() === '') {
        throw new Error('⛔ Model name is required');
    }

    this.configs.set(providerLower, config);
}
```

**驗證**：
- GitHub Copilot 不驗證 apiKey
- 其他 Providers 仍正常驗證

**預期時間**：15 分鐘

---

### Task 4.3：新增工廠建立邏輯
**目標**：在 getService 中處理 GitHub Copilot

**檔案**：`src/services/ai-provider.service.ts`（第 73 行後）

**變更**：在 switch-case 中新增：
```typescript
case 'githubcopilot':
    if (!config.serverAddress) {
        throw new Error('⛔ Server address is required for GitHub Copilot');
    }
    service = new GithubCopilotService(config.serverAddress, config.modelName);
    break;
```

**驗證**：能成功建立 GithubCopilotService 實例

**預期時間**：10 分鐘

---

## 階段 5：主程式整合

### Task 5.1：修改設定讀取邏輯
**目標**：支援從 task input 讀取 serverAddress

**檔案**：`src/index.ts`（第 114-163 行）

**變更**：
1. 修改 `getModelConfigFromTaskInput()` 回傳型別，新增 `serverAddress?: string`
2. 在 configMap 中新增 `githubcopilot` 設定
3. 讀取 `inputGitHubCopilotServerAddress`

**驗證**：Pipeline 執行時能正確讀取 serverAddress

**預期時間**：30 分鐘

---

### Task 5.2：修改服務註冊呼叫
**目標**：傳遞 serverAddress 給 AIProviderService

**檔案**：`src/index.ts`（第 436-439 行）

**變更**：
```typescript
aiProvider.registerService(inputs.aiProvider, {
    apiKey: inputs.modelKey,
    modelName: inputs.modelName,
    serverAddress: inputs.serverAddress  // 新增
});
```

**驗證**：GitHub Copilot 註冊成功

**預期時間**：10 分鐘

---

### Task 5.3：新增環境變數支援（Debug 模式）
**目標**：支援從 .env 讀取 GitHubCopilotServerAddress

**檔案**：`src/index.ts`（getAIProviderConfig 方法）

**變更**：在 debug 模式下讀取環境變數：
```typescript
const serverAddress = process.env.GitHubCopilotServerAddress;
```

**驗證**：Debug 模式能正確讀取環境變數

**預期時間**：15 分鐘

---

## 階段 6：環境與測試準備

### Task 6.1：更新 .env.example
**目標**：提供環境變數範例

**檔案**：`devscripts/.env.example`（如果存在）

**變更**：新增：
```properties
# GitHub Copilot (選擇 GitHubCopilot 時)
# AiProvider=GitHubCopilot
# GitHubCopilotServerAddress=192.168.1.100:8080
# ModelName=gpt-4o
```

**驗證**：文件清晰易懂

**預期時間**：10 分鐘

---

### Task 6.2：本地整合測試
**目標**：驗證完整流程運作

**步驟**：
1. 設定 .env 檔案
2. 執行 `npm run debug`
3. 驗證能連接到 CLI Server
4. 驗證能取得 PR 差異並生成評論

**驗證檢查清單**：
- [ ] CLI Server 連接成功
- [ ] System instruction 正確傳遞
- [ ] PR 差異正確發送
- [ ] 回應內容正確提取
- [ ] Token usage 顯示（實際或估算）
- [ ] 評論成功發佈到 PR

**預期時間**：1-2 小時（含問題排查）

---

## 階段 7：文件撰寫（繁體中文 + 英文）

### Task 7.1：更新 README.zh-TW.md 主要功能
**目標**：在功能列表中新增 GitHub Copilot

**檔案**：`README.zh-TW.md`

**變更**：更新「主要功能」章節，新增 GitHub Copilot CLI 整合說明

**驗證**：文字清晰，格式正確

**預期時間**：20 分鐘

---

### Task 7.2：新增 GitHub Copilot CLI 前置作業章節（中文）
**目標**：提供完整的設定指南

**檔案**：`README.zh-TW.md`

**內容**：
- 適用情境說明
- CLI Server 安裝步驟
- 啟動 Server 模式
- 測試連通性
- Pipeline Task 設定範例
- 注意事項

**驗證**：按照步驟可成功設定

**預期時間**：40 分鐘

---

### Task 7.3：更新 Task 參數表格（中文）
**目標**：新增 GitHub Copilot 相關參數說明

**檔案**：`README.zh-TW.md`

**變更**：在參數表格中新增三列：
- Network Type
- CLI Server Address
- Model Name

**驗證**：表格格式正確，說明清楚

**預期時間**：20 分鐘

---

### Task 7.4：更新 README.md（英文版）
**目標**：同步英文版本的所有更新

**檔案**：`README.md`

**內容**：Task 7.1-7.3 的英文版本

**驗證**：翻譯準確，格式一致

**預期時間**：1 小時

---

### Task 7.5：更新 README-Dev.md
**目標**：新增開發者相關資訊

**檔案**：`README-Dev.md`

**內容**：
- 環境變數設定範例
- 本地測試指令
- 架構設計說明（為何不繼承 BaseAIService）
- SDK 版本和相容性說明
- 實作細節（連接管理、Token 追蹤）
- 已知限制
- 測試檢查清單

**驗證**：開發者能理解設計決策和測試方式

**預期時間**：40 分鐘

---

## 階段 8：建置與驗證

### Task 8.1：執行完整建置
**目標**：確保所有變更能正確編譯和打包

**步驟**：
```bash
npm run build
npm run packaging:package
```

**驗證**：
- [ ] TypeScript 編譯無錯誤
- [ ] dist/ 目錄包含所有必要檔案
- [ ] .vsix 檔案成功生成

**預期時間**：15 分鐘

---

### Task 8.2：回歸測試現有 Providers
**目標**：確保不影響現有功能

**步驟**：測試 Google、OpenAI、Grok、Claude 四個 Providers

**驗證**：
- [ ] 所有現有 Providers 正常運作
- [ ] UI 欄位顯示邏輯正確
- [ ] 無 breaking changes

**預期時間**：1 小時

---

### Task 8.3：錯誤處理測試
**目標**：驗證各種錯誤情境

**測試案例**：
- [ ] 無效 Server Address 格式
- [ ] Server 不存在
- [ ] Server 連接逾時
- [ ] SDK 拋出例外
- [ ] 空回應

**驗證**：所有錯誤都有清晰的錯誤訊息

**預期時間**：1 小時

---

## 階段 9：OpenSpec 規格文檔完成

### Task 9.1：建立規格文件
**目標**：記錄新增的能力和需求

**檔案**：`openspec/changes/add-github-copilot-support/specs/github-copilot-provider/spec.md`

**內容**：使用 ADDED Requirements 記錄 GitHub Copilot Provider 的規格

**驗證**：執行 `openspec validate add-github-copilot-support --strict` 通過

**預期時間**：30 分鐘

---

### Task 9.2：更新 tasks.md 狀態
**目標**：標記所有任務為已完成

**檔案**：`openspec/changes/add-github-copilot-support/tasks.md`

**變更**：更新所有 checkbox 為已完成

**驗證**：所有任務都已執行並驗證

**預期時間**：10 分鐘

---

## 階段 10：歸檔與發佈

### Task 10.1：更新版本號
**目標**：準備新版本發佈

**步驟**：
1. 更新 `vss-extension.json` 版本號（Minor 版本 +1）
2. 執行 `npm run sync:version` 同步到其他檔案

**驗證**：版本號一致更新

**預期時間**：10 分鐘

---

### Task 10.2：建立 Git Commit
**目標**：提交所有變更

**步驟**：
```bash
git add .
git commit -m "feat: Add GitHub Copilot CLI Server support

- Add GitHub Copilot as 5th AI Provider option
- Support intranet CLI Server connection (host:port)
- Implement GithubCopilotService with @github/copilot-sdk
- Add comprehensive documentation (zh-TW + en)
- Include CLI Server setup prerequisites

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**驗證**：Commit 成功

**預期時間**：10 分鐘

---

### Task 10.3：OpenSpec 歸檔
**目標**：將變更歸檔到 specs/

**步驟**：
```bash
openspec archive add-github-copilot-support
```

**驗證**：規格正確歸檔到 `openspec/specs/` 和 `openspec/changes/archive/`

**預期時間**：10 分鐘

---

## 總計預估時間
- **階段 1**：35 分鐘
- **階段 2**：1 小時
- **階段 3**：3.5 小時
- **階段 4**：30 分鐘
- **階段 5**：55 分鐘
- **階段 6**：2-3 小時
- **階段 7**：3 小時
- **階段 8**：2 小時
- **階段 9**：40 分鐘
- **階段 10**：30 分鐘

**總計**：約 14-15 小時

## 任務依賴關係
```
階段 1 → 階段 2 → 階段 3 → 階段 4 → 階段 5 → 階段 6 → 階段 7 → 階段 8 → 階段 9 → 階段 10
   ↓        ↓        ↓        ↓        ↓        ↓        ↓        ↓        ↓
 基礎    UI定義   核心實作   工廠整合  主程式    測試     文件     驗證     規格    發佈
```

**可並行任務**：
- 階段 2 完成後，可同時進行階段 3 和階段 7（文件撰寫）
- 階段 6 和階段 7 可部分並行

## 備註
- 實際時間可能因 SDK API 調整和問題排查而增加
- 建議逐階段完成，每階段完成後進行驗證
- 保持與使用者溝通，特別是 SDK 實測階段
