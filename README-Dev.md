## AI PR AutoReview — 本地開發 & 發佈說明

此文件說明如何在本機環境測試與開發本專案（AI PR 自動 Code Review），包含 package.json 中常用的 scripts 使用情境、`devscripts/.env` 的用途以及打包與發佈（Marketplace）的 SOP。


## 專案資料夾結構
```
d:\Project\AiPrCodeReview
├── devscripts/              # 本地測試腳本
│   ├── .env                 # 環境變數設定檔（請勿提交正式環境的金鑰）
│   ├── ai-comment.ts        # 測試 AI 服務 (Google/OpenAI/Grok/Claude)
│   ├── pr-changes.ts        # 測試取得 PR 變更
│   ├── pr-comment.ts        # 測試新增 PR 評論
│   └── test-copilot-cli.ts  # 測試 GithHub Copilot CLI
├── images/                  # 擴充功能圖示
│   ├── extension-icon.png
│   └── extension-icon-small.png
├── packages/                # 打包輸出資料夾（VSIX 檔案）
├── screenshots/             # 說明文件截圖
├── scripts/                 # 建置腳本
│   └── sync-taskjson.js     # 同步版本號至 task.json 和 package.json
├── src/                     # 主要程式碼
│   ├── interfaces/          # TypeScript 介面定義
│   │   ├── ai-service.interface.ts           # AI 服務介面定義
│   │   ├── devops-service.interface.ts       # DevOps 服務介面定義
│   │   └── pipeline-inputs.interface.ts      # Pipeline 輸入參數介面定義
│   ├── services/            # 服務實作
│   │   ├── ai-provider.service.ts            # AI 服務進入點，AI 服務提供者管理器（統一管理所有 AI 服務）
│   │   ├── base-ai.service.ts                # AI 服務抽象基礎類別（提供共用邏輯）
│   │   ├── base-http-ai.service.ts           # HTTP AI 服務基礎類別（提供共用 Axios 邏輯）
│   │   ├── base-openai-compatible.service.ts # OpenAI 相容服務基礎類別
│   │   ├── base-devops.service.ts            # DevOps 服務抽象基礎類別（提供共用邏輯）
│   │   ├── azure-devops.service.ts           # Azure DevOps 服務實作
│   │   ├── github-devops.service.ts          # GitHub 服務實作
│   │   ├── devops-provider.service.ts        # DevOps 服務進入點，DevOps 服務提供者管理器（統一管理 Azure/GitHub）
│   │   ├── google-ai.service.ts              # Google Gemini AI 服務實作
│   │   ├── openai.service.ts                 # OpenAI 服務實作
│   │   ├── grok.service.ts                   # Grok (xAI) 服務實作
│   │   ├── claude.service.ts                 # Claude (Anthropic) 服務實作
│   │   └── github-copilot.service.ts         # GitHub Copilot 服務實作
│   ├── index.ts             # 主程式進入點
│   └── task.json            # Azure Pipeline Task 定義檔
├── package.json             # npm 套件設定
├── tsconfig.json            # TypeScript 編譯設定
├── tsconfig.devscripts.json # devscripts 編譯設定
├── vss-extension.json       # Azure DevOps 擴充功能清單
├── README.md                # 專案說明文件(英文版)
├── README.zh-TW.md          # 專案說明文件(繁體中文版)
├── README-Dev.md            # 開發者說明文件
└── LICENSE.txt              # 授權條款
``` 


## 主要 Scripts
- 使用 `npm run build` 執行完整建置流程（同步版本號、型別檢查、打包、複製檔案）。
- 使用 `npm run packaging:package` 建置 Marketplace 套件。
- `devscripts/.env`，此環境變數主要用於本地開發測試。
- `devscripts` 內有多個測試腳本和工具
  + `npm run devscripts:ai` - 測試 AI 服務
  + `npm run devscripts:pr-changes` - 測試取得 PR 變更
  + `npm run devscripts:pr-comment` - 測試新增 PR 評論
  + `npx ts-node DEVSCRIPTS/test-pr-review.ts` - 完整 PR 審查測試工具（詳見下方說明）
  + `npx ts-node devscripts/inline-comment.ts` - 行內評論（精準行號標註）整合測試（詳見下方說明）
- 本地開發模擬 pipeline 執行，請修改好 `devscripts/.env` 後，執行 `npm run debug`。
- 執行單元測試：`npm test` (使用 `mocha` 和 `ts-node` 執行 `test/**/*.spec.ts`)。


## Scripts 與使用情境
- `npm run clean`：清理 `dist/` 輸出資料夾。
- `npm run typecheck`：執行 TypeScript 型別檢查（不產生檔案）。
- `npm run copy`：將 `src/task.json` 和 `images/extension-icon-small.png` 複製至 `dist/`。
- `npm run bundle`：使用 `esbuild` 將 TypeScript 打包至 `dist/index.js`。
- `npm run build`：執行完整建置流程，包含同步版本號（`sync-taskjson.js`）、清理、型別檢查、打包與複製檔案。
- `npm run debug`：編譯後以 debug 模式執行（package.json 內為 `esbuild src/index.ts --bundle ... && node --env-file=./devscripts/.env ./dist/index.js --debug`），會改為從環境變數讀取輸入值（方便本地模擬）。
- `npm run devscripts:ai`：編譯 devscripts（使用 `tsconfig.devscripts.json`）並執行 `dist/devscripts/ai-comment.js`，執行呼叫 AI 服務並印出回應。
- `npm run devscripts:pr-changes`：執行取得 PR 變更檔案並列印內容（需有效的 DevOps env 設定）。
- `npm run devscripts:pr-comment`：執行 DevOps API 新增 PR 評論（需有效的 DevOps env 設定）。
- `npm run packaging:install-tool`：安裝 `tfx-cli`（全域）以便打包與上傳。
- `npm run packaging:package`：建立 VSIX 包（使用 `vss-extension.json`）。

### test-pr-review.ts 測試工具

`test-pr-review.ts` 是一個完整的 PR 審查測試工具，用於本地快速測試完整的 PR 審查流程（包括取得 PR 變更和調用 AI 服務）。各審查模式參數的排列組合說明，請參考 [PARAMETER-COMBINATIONS.zh-TW.md](./PARAMETER-COMBINATIONS.zh-TW.md)。

**使用方式**：
```bash
npx ts-node DEVSCRIPTS/test-pr-review.ts [參數]
```

**必要參數**：
- `--provider <azure|github>` - DevOps 提供者（Azure DevOps 或 GitHub）
- `--pr <PR_ID>` - Pull Request ID

**Azure DevOps 參數**（當 provider=azure 時必填）：
- `--org <URL>` - Organization URL（例如：https://dev.azure.com/yourorg）
- `--project <PROJECT>` - 專案名稱
- `--repo-id <ID>` - Repository ID
- `--token <TOKEN>` - Personal Access Token（或使用環境變數 SYSTEM_ACCESSTOKEN）

**GitHub 參數**（當 provider=github 時必填）：
- `--owner <USER>` - Repository owner
- `--repo <REPO>` - Repository name
- `--token <TOKEN>` - GitHub token

**GitHub Copilot 參數**（三種模式擇一使用）
- `--github-token <TOKEN>` - GitHub Fine-grained Personal Access Token（Token 模式）
- `--server-address <ADDRESS>` - GitHub Copilot CLI Server 位址（遠端 Server 模式）
- 不提供以上參數 - 使用本機 CLI（Local 模式）
- `--timeout` - GitHub Copilot CLI 請求超時時間 (毫秒)

**注意**：`--github-token` 和 `--server-address` 不能同時使用 

**AI 提供者參數**：
- `--ai <PROVIDER>` - AI 提供者：'claude', 'openai', 'grok', 'google'（預設：claude）
- `--model <MODEL_NAME>` - 模型名稱（例如：claude-haiku-4-5、gpt-5-mini、gemini-2.5-flash）
- `--key <API_KEY>` - API Key（或使用環境變數）

**功能開關參數**：
- `--throttle <true|false>` - 啟用節流模式（預設：true，僅送差異）
- `--incremental <true|false>` - 啟用增量 Diff 模式（預設：false）
- `--verbose <true|false>` - 顯示詳細日誌（預設：true）
- `--inline <true|false>` - 啟用行內評論模式驗證（預設：false；true 時使用 JSON 系統指令並驗證解析結果，但**不**發佈評論；若要實際發佈請使用 `inline-comment.ts`）

**使用範例**：

1. **Azure DevOps + Claude，啟用增量 Diff**
```bash
npx ts-node DEVSCRIPTS/test-pr-review.ts \
  --provider azure \
  --pr 16 \
  --org https://dev.azure.com/myorg \
  --project MyProject \
  --repo-id 9efec7a7-ef7f-4c2b-8bb8-e3e4f9c2e0ca \
  --ai claude \
  --model claude-haiku-4-5 \
  --throttle true \
  --incremental true
```

2. **Azure DevOps + Google Gemini，全量 Diff**
```bash
npx ts-node DEVSCRIPTS/test-pr-review.ts \
  --provider azure \
  --token Your_AzureDevops_Token
  --pr 20 \
  --org https://dev.azure.com/myorg \
  --project MyProject \
  --repo-id 94408af5-6c38-45d2-a5d3-cbcfd38b8ae7 \
  --ai google \
  --model gemini-2.5-flash \
  --throttle true \
  --incremental false
```

3. **GitHub + OpenAI，禁用節流模式**
```bash
npx ts-node DEVSCRIPTS/test-pr-review.ts \
  --provider github \
  --pr 42 \
  --owner myuser \
  --repo myrepo \
  --ai openai \
  --model gpt-5-mini \
  --throttle false
```

4. **Azure DevOps + GitHub Copilot (Token 模式)**
```bash
npx ts-node DEVSCRIPTS/test-pr-review.ts \
  --provider azure \
  --token Your_AzureDevops_Token \
  --pr 20 \
  --org https://dev.azure.com/myorg \
  --project MyProject \
  --repo-id 94408af5-6c38-45d2-a5d3-cbcfd38b8ae7 \
  --ai githubcopilot \
  --model gpt-5-mini \
  --github-token github_pat_YOUR_TOKEN_HERE \
  --throttle true
```

5. **Azure DevOps + GitHub Copilot (遠端 Server 模式)**
```bash
npx ts-node DEVSCRIPTS/test-pr-review.ts \
  --provider azure \
  --token Your_AzureDevops_Token \
  --pr 20 \
  --org https://dev.azure.com/myorg \
  --project MyProject \
  --repo-id 94408af5-6c38-45d2-a5d3-cbcfd38b8ae7 \
  --ai githubcopilot \
  --model gpt-5-mini \
  --server-address 10.10.10.111:8080 \
  --timeout 300000 \
  --throttle true
```

6. **Azure DevOps + GitHub Copilot (本機 CLI 模式)**
```bash
npx ts-node DEVSCRIPTS/test-pr-review.ts \
  --provider azure \
  --token Your_AzureDevops_Token \
  --pr 20 \
  --org https://dev.azure.com/myorg \
  --project MyProject \
  --repo-id 94408af5-6c38-45d2-a5d3-cbcfd38b8ae7 \
  --ai githubcopilot \
  --model gpt-5-mini \
  --throttle true
```

**輸出說明**：
- 顯示當前配置設定
- 取得 PR 變更檔案（顯示檔案數量、檔案大小、Token 數量）
- 調用 AI 服務進行審查
- 印出 AI 的審查結果

**常見用途**：
- 測試特定 PR 的增量 Diff 功能
- 驗證 AI 審查結果品質
- 測試不同 AI 提供者的表現
- 調試 Token 計算和節流模式設定


### inline-comment.ts 整合測試工具

`inline-comment.ts` 是行內評論（精準行號標註）功能的專用整合測試工具，用於驗證完整的行內標註流程：取得 PR 變更 → AI 回傳 JSON → 解析 → 發佈摘要 + 行內評論。

> **行內評論模式原理**：啟用後，系統指令會自動切換為 JSON 格式指令，要求 AI 回傳包含 `file`、`lineStart`、`lineEnd`、`severity` 等欄位的結構化 JSON（`InlineReviewResult`）。解析後，工具會先發佈一則統計摘要評論，再逐一發佈錨定至特定行號的行內評論（Azure DevOps 使用 `threadContext`，GitHub 使用 Review Comment API）。

**使用方式**：
```bash
npx ts-node devscripts/inline-comment.ts [參數]
```

**重要參數**：
- `--pr <ID>` - Pull Request ID（必填，或在 `.env` 設定 `DevOpsPRId`）
- `--provider <azure|github>` - DevOps 提供者（預設 azure）
- `--ai <PROVIDER>` - AI 提供者（預設 claude）
- `--dry-run` - 只驗證 JSON 解析，不實際發佈評論（**建議先用此模式確認格式正確**）

**使用範例**：

1. **Dry-run 驗證（僅驗證 AI 是否回傳正確 JSON，不發佈）**
```bash
npx ts-node devscripts/inline-comment.ts \
  --provider azure \
  --pr 123 \
  --ai claude \
  --dry-run
```

2. **實際發佈行內評論至 Azure DevOps PR**
```bash
npx ts-node devscripts/inline-comment.ts \
  --provider azure \
  --pr 123 \
  --org https://dev.azure.com/myorg \
  --project MyProject \
  --repo-id 9efec7a7-ef7f-4c2b-8bb8-e3e4f9c2e0ca \
  --ai claude \
  --model claude-haiku-4-5
```

3. **GitHub PR 行內評論**
```bash
npx ts-node devscripts/inline-comment.ts \
  --provider github \
  --owner myuser \
  --repo myrepo \
  --pr 456 \
  --ai openai \
  --model gpt-5-mini
```

**輸出說明**：
- 印出 AI 的原始 JSON 回應
- 顯示解析後的問題清單（檔案、行號、嚴重程度）
- Dry-run：只列印，不發佈
- 正式模式：先發統計摘要評論，再逐一發行內評論

**注意事項**：
- 行號必須對應到 diff 的新版本（右側，`+` 行），若 AI 回傳的行號不在 diff 範圍內，DevOps API 可能拒絕並跳過該則評論（系統不會失敗，只會印 warning）
- GitHub 行內評論要求行號必須存在於 PR diff 中；超出 diff 範圍的行號會被 API 拒絕
- 最多發佈 20 則行內評論（超過的問題會在摘要中說明）


## devscripts/.env：用途與本機測試

> ⚠️ **注意**：`devscripts/.env` 為**本地開發測試專用**，包含敏感資訊（API Key、Token 等），請勿推版或用於正式環境。

`devscripts/.env` 用於在本機快速設定`測試`需要的變數，讓 `devscripts` 下的測試腳本與 `src/index.ts` 的 debug 模式能夠模擬實際 Azure DevOps pipeline 與 AI Provider 的互動，請務必不要把含有真實金鑰或 PAT 的檔案提交到版本控制。

下表列出常用變數及說明：

| 變數名稱 | 必要性 | 範例 | 說明 |
|---|:---:|---|---|
| DevOpsOrgUrl | 必要 | https://dev.azure.com/YourOrganization/ | Azure DevOps collection / 組織 URL |
| DevOpsAccessToken | 必要 | pat... | Personal Access Token (PAT)，需能讀取 PR、發表評論 |
| DevOpsProjectName | 必要 | YourProject | Azure DevOps 專案名稱 |
| DevOpsRepositoryId | 必要 | 00000000-0000-0000-0000-000000000000 | Repository ID（或在某些實作中可用 repo 名稱） |
| DevOpsPRId | 必要 | 4 | 要測試的 Pull Request 編號 |
| AiProvider | 必要 | Google | 在 `AIProviderService` 中註冊的 provider 名稱（例如 `Google`、`OpenAI`、`Grok`） |
| GeminiAPIKey | 選用 | AI_KEY | Gemi API Key，若使用 Google 時，此欄位必填 |
| OpenAIAPIKey | 選用 | sk-... | OpenAI API Key，若使用 OpenAI 時，此欄位必填 |
| GrokAPIKey | 選用 | xai-... | Grok (xAI) API Key，若使用 Grok 時，此欄位必填 |
| ClaudeAPIKey | 選用 | sk-ant-... | Claude API Key，若使用 Claude 時，此欄位必填 |
| GitHubCopilotToken | 選用 | github_pat_xxx | GitHub Fine-grained Personal Access Token（格式：github_pat_xxx），用於 Token 模式認證。**不能與 GitHubCopilotServerAddress 同時使用** |
| GitHubCopilotServerAddress | 選用 | localhost:8080 | GitHub Copilot CLI Server 位址（格式: host:port）。若未提供且未提供 Token，將使用本機的 GitHub Copilot CLI（需先完成 `copilot auth login`）。**不能與 GitHubCopilotToken 同時使用** |
| GitHubCopilotCliPath | 選用 | C:\Tools\copilot\copilot.exe | GitHub Copilot CLI 執行檔的絕對路徑。若為空，依序嘗試環境變數 `COPILOT_CLI_PATH`，再嘗試系統 PATH |
| ModelName | 必要 | gemini-2.5-flash | 要使用的模型名稱（例如 gemini-2.5-flash、gpt-5-mini、grok-beta、claude-haiku-4-5） |
| SystemInstructionSource | 選填 | Built-in | 系統指令來源：Built-in / Inline / File |
| SystemPromptFile | 選用 | ./prompts/review.md | 系統指令檔案路徑（當 SystemInstructionSource=File 時使用）。若檔案不存在或為空，自動回退到 SystemInstruction |
| SystemInstruction | 選用 | 你是一位資深工程師... | 傳給 AI 的 system 指令。啟用行內評論模式時，此內容會自動附加 JSON 格式需求（而非被取代） |
| ResponseLanguage | 必要 | Taiwanese (zh-TW) | AI 回應語言，例如 Taiwanese (zh-TW)、English (en-US) |
| MaxOutputTokens | 選用 | （未設定） | AI 回應最大 token 數量，留空則使用模型預設限制 |
| Temperature | 選用 | 0.2 | AI 生成隨機性 |
| FileExtensions | 選用 | .cs,.ts,.js | 要納入的檔案副檔名（逗號分隔） |
| BinaryExtensions | 選用 | .exe,.dll,.jpg | 要排除的二進位檔副檔名 |
| EnableThrottleMode | 選用 | true | 啟用 AI 節流模式（true：僅送差異；false：送整個檔案） |
| EnableIncrementalDiff | 選用 | true | 啟用增量 Diff 模式（true：僅審查最新 push 的檔案；false：審查所有 PR 變更）。**注意（Azure DevOps）**：確實根據最新 push 過濾檔案清單。**注意（GitHub）**：GitHub API 始終回傳全部 PR 檔案，作用有限。此選項在 UI 中，只有 `EnableThrottleMode=true` 時才顯示 |
| ShowReviewContent | 選用 | true | 顯示審核內容（true：印出送給 AI 的程式碼內容、System Instruction、Prompt 以及 AI 回應；false：不顯示） |
| EnableInlineComments | 選用 | true | 啟用行內評論模式（true：AI 回傳 JSON，發佈精準行號標註的行內評論；false：AI 回傳 Markdown，發佈單一摘要評論）。啟用時系統指令會自動**附加** JSON 格式需求（原有 SystemInstruction 內容保留） |
| GroupInlineCommentsByFile | 選用 | false | 合併同一檔案的行內評論（true：同檔案問題合併為一則；false：每個問題各自一則）。僅 EnableInlineComments=true 時有效 |
| InlineStrictMode | 選用 | false | 嚴厲模式（true：AI 額外回報 suggestion 級別問題；false：僅回報 critical / warning）。僅 EnableInlineComments=true 時有效 |

.env 範例說明（切勿提交含真實金鑰的檔案）：

```properties
# Azure DevOps
DevOpsOrgUrl=https://dev.azure.com/YourOrganization/
DevOpsAccessToken=PASTE_YOUR_PAT_HERE
DevOpsProjectName=YourProject
DevOpsRepositoryId=00000000-0000-0000-0000-000000000000
DevOpsPRId=4

# AI Provider (選擇其一：Google / OpenAI / Grok / Claude / GitHubCopilot)
GeminiAPIKey=PASTE_YOUR_GEMINI_KEY
OpenAIAPIKey=PASTE_YOUR_OPENAI_KEY
GrokAPIKey=PASTE_YOUR_GROK_KEY
ClaudeAPIKey=PASTE_YOUR_CLAUDE_KEY
AiProvider=Google
ModelName=gemini-2.5-flash

# GitHub Copilot 認證模式（三選一，不能同時使用）：
# 模式 1: Token 模式（雲端 CI）
# GitHubCopilotToken=github_pat_YOUR_TOKEN_HERE

# 模式 2: 遠端 CLI Server
# GitHubCopilotServerAddress=localhost:8080

# 模式 3: 本機 CLI（不填寫任何參數，使用已登入的 CLI）

SystemInstruction=你是一位資深軟體工程師，請協助進行程式碼審查與分析。
ResponseLanguage=Taiwanese (zh-TW)
MaxOutputTokens=
Temperature=0.2
# EnableInlineComments=true   # 啟用行內評論模式（啟用後 SystemInstruction 內容保留，但自動附加 JSON 格式需求）
# GroupInlineCommentsByFile=false  # EnableInlineComments=true 時有效：同檔案問題合併
# InlineStrictMode=false        # EnableInlineComments=true 時有效：true 時額外回報 suggestion

# File filters
FileExtensions=.cs,.ts,.js,.aspx,.html
BinaryExtensions=.exe,.dll,.jpg,.png

# Other settings
EnableThrottleMode=true
EnableIncrementalDiff=true
ShowReviewContent=true
```

注意：`src/index.ts` 在 debug 模式會從 `process.env` 讀取（而非 Azure Pipelines 的變數）。

### 環境變數說明

#### EnableThrottleMode（節流模式）
- **預設值**：`true`（啟用）
- **說明**：控制是否僅送程式碼差異給 AI，或送整個檔案內容
  - `true`：節流模式啟用，僅送程式碼 diff
  - `false`：關閉節流模式，送整個新檔案內容

#### EnableIncrementalDiff（增量 Diff 模式）
- **預設值**：`false`（停用）
- **重要提示（Azure DevOps）**：此選項確實根據最新 push 過濾要審查的檔案清單
- **重要提示（GitHub）**：GitHub API 始終回傳全 PR 所有檔案，此選項對 GitHub 的作用有限
- **說明**：控制是否只審查最新 push 的變更，或審查所有 iteration 的變更
  - `true`：增量模式，僅審查最新推送的變更（Azure DevOps 實際過濾檔案清單）
  - `false`：全量模式，審查所有 PR 迭代的變更

**範例場景（Azure DevOps）**：
- PR 有 3 次推送（3 個 iterations）
- Iteration 1：新增檔案 A
- Iteration 2：在檔案 A 中新增方法 B
- Iteration 3：在方法 B 中新增註釋

**不同模式的結果**：
- `EnableThrottleMode=true, EnableIncrementalDiff=false`：審查所有變更（A 新增 + 方法 B 新增 + 註釋新增），以 diff 格式送給 AI
- `EnableThrottleMode=true, EnableIncrementalDiff=true`：只審查最新變更（只有註釋新增），以 diff 格式送給 AI
- `EnableThrottleMode=false, EnableIncrementalDiff=false`：送所有 PR 變更檔案的完整內容給 AI
- `EnableThrottleMode=false, EnableIncrementalDiff=true`：**（Azure DevOps）** 仍根據最新 push 過濾檔案清單，但送完整檔案內容（非 diff）給 AI；**（GitHub）** 等同於 `false, false`


#### EnableInlineComments（行內評論模式）
- **預設值**：`true`（啟用）
- **說明**：控制 AI 回傳格式與評論發佈方式
  - `false`：AI 回傳 Markdown，發佈單一摘要評論到 PR 討論串
  - `true`：AI 回傳結構化 JSON，逐一發佈精準行號標註的行內評論，並附上摘要評論
- **重要**：啟用時，`SystemInstruction` 內容**保留**，但自動附加 JSON 格式需求指令（`buildInlineJsonAppend`）

#### GroupInlineCommentsByFile（合併行內評論）
- **預設值**：`false`
- **前提**：僅 `EnableInlineComments=true` 時有效
- `true`：同一檔案的多個問題合併為一則行內評論（減少評論數量）
- `false`：每個問題各自發佈一則行內評論（更精確的行號錨定）

#### InlineStrictMode（嚴厲模式）
- **預設值**：`false`
- **前提**：僅 `EnableInlineComments=true` 時有效
- `false`：AI 僅回報 critical 和 warning 問題（雜訊較少）
- `true`：AI 額外回報 suggestion 級別問題（更全面但評論更多）


## 快速開始（PowerShell 範例）
1. 安裝相依套件

```powershell
npm install
```

2. 建置(非必要)

```powershell
npm run build
```

3. 本地執行（使用 devscripts/.env 作為範例）

```powershell
# 執行完整流程
npm run debug

# 或執行 devscripts 測試：
npm run devscripts:ai
npm run devscripts:pr-changes
npm run devscripts:pr-comment
```


## 增量 Diff 模式實作詳解

### 核心概念

增量 Diff 模式用於處理多次推送（iterations）的 PR 場景。Azure DevOps 中的 PR iteration 代表每次 `git push` 的操作，每次推送都會產生一個新的 iteration。

### 實作位置

主要實作在 `src/services/azure-devops.service.ts` 中：

1. **方法：`verifyPullRequestChanges()`** - 取得 PR 變更
   - 根據 `enableIncrementalDiff` 參數決定要比較的 iteration
   - 啟用時：取得最後一個 iteration 和前一個 iteration，進行比較
   - 禁用時：取得最後一個 iteration（與基礎分支的完整差異）

2. **方法：`calculateIncrementalChanges()`** - 計算增量變更
   - 透過比較 objectId 判斷檔案是否在最新 iteration 中被修改
   - 只保留新增或修改的檔案

3. **方法：`getChangeDetails()`** - 取得檔案變更詳情
   - 核心修改：當啟用增量模式時，從 **前一個 iteration** 獲取舊版本檔案
   - 而非使用基礎分支版本，這樣產生的 diff 才是真正的增量變更

### 工作流程

```
啟用增量 Diff 時的流程：
PR 有 3 個 iterations （i1, i2, i3）

1. verifyPullRequestChanges()：
   └─ 比較 iteration 3 vs iteration 2
   └─ 取出在 iteration 3 中有變更的檔案清單

2. calculateIncrementalChanges()：
   └─ 過濾檔案：只保留 objectId 不同的檔案
   └─ 輸出：只有在 i3 中修改過的檔案

3. getChangeDetails()：
   ├─ 對於每個修改的檔案
   ├─ 取得 i3 版本（sourceContent）
   ├─ 從前一個 iteration（i2）取得舊版本（targetContent）
   └─ 生成 diff：i3 版本 vs i2 版本

結果：diff 只顯示 i3 中實際修改的內容
```

禁用增量 Diff 時的流程：

```
禁用時的流程：
PR 有 3 個 iterations

1. verifyPullRequestChanges()：
   └─ 取得 iteration 3 的所有變更（最終狀態）

2. calculateIncrementalChanges()：
   └─ 跳過此步驟

3. getChangeDetails()：
   ├─ 對於每個檔案
   ├─ 取得 i3 版本（sourceContent）
   ├─ 取得基礎分支版本（targetContent 來自 originalObjectId）
   └─ 生成 diff：i3 版本 vs 基礎分支版本

結果：diff 顯示所有從基礎分支開始的所有變更（包含 i1, i2, i3）
```

### 重要特性

1. **依賴節流模式**：增量 Diff 只有在 `enableThrottleMode=true` 時才有效
   - 節流模式負責決定是送 diff 還是整個檔案
   - 增量模式負責決定 diff 的範圍

2. **自動回退**：PR 只有 1 個 iteration 時
   - 增量模式自動變成全量模式
   - 因為沒有「前一個」iteration 可以比較

3. **Token 優化**：結合使用時效果最佳
   - `enableThrottleMode=true` + `enableIncrementalDiff=true`
   - 最少的內容 → 最少的 token 消耗 → 最低成本


## GitHub Copilot 整合說明

### 架構設計

GitHub Copilot 的整合與其他 AI Providers 有一些不同：

1. **不繼承 BaseAIService**
   - `GithubCopilotService` 直接實作 `AIService` 介面
   - 原因：GitHub Copilot 支援 Token 認證，不使用傳統 API Key
   - BaseAIService 的 constructor 會強制驗證 API Key，不適用於此情境

2. **使用官方 SDK**
   - 使用 `@github/copilot-sdk` 連接到 CLI Server 或使用 Token 認證
   - SDK 版本：0.2.1（Technical Preview）

3. **延遲初始化**
   - Client 連接在首次呼叫 `generateComment()` 時建立
   - 避免啟動時連接失敗影響整體服務

### 認證機制

GitHub Copilot 支援三種認證模式，根據提供的參數自動判斷：

#### 1. Token 模式（適用於雲端 CI）
**參數組合**：提供 `githubToken`，不提供 `serverAddress`

**SDK 配置**：
```typescript
new CopilotClient({
    githubToken: 'user-provided-token',
    useLoggedInUser: false
})
```

**支援的 Token 類型**：
- `gho_` - OAuth user access tokens
- `ghu_` - GitHub App user access tokens
- `github_pat_` - Fine-grained personal access tokens（推薦）

**不支援的 Token 類型**：
- `ghp_` - Classic personal access tokens（已廢棄）

**必要權限**：
- Account permissions → Copilot → Access: **Read-only**

**CI Token 模式重要注意事項**：
當使用 Token 模式時，CI Pipeline 必須先安裝 GitHub Copilot CLI：
```yaml
- script: npm install -g @github/copilot
  displayName: 'Install GitHub Copilot CLI'
```
參考：[GitHub Copilot CLI 安裝指南](https://docs.github.com/en/copilot/how-tos/copilot-cli/install-copilot-cli)

#### 2. 遠端 CLI Server 模式（適用於集中式架構）
**參數組合**：不提供 `githubToken`，提供 `serverAddress`

**SDK 配置**：
```typescript
new CopilotClient({
    cliUrl: 'server-address'
})
```

**Server 位址格式**：
- `host:port`
- 範例：`localhost:8080`、`192.168.1.100:8080`、`copilot.internal.company.com:8080`

#### 3. 本機 CLI 模式（適用於預先設定的 Build Agent）
**參數組合**：不提供 `githubToken`，不提供 `serverAddress`

**SDK 配置**：
```typescript
new CopilotClient()  // 使用預設配置
```

**前置需求**：
- Build Agent 已安裝 GitHub Copilot CLI
- 已完成身份驗證（`copilot auth login`）

### 關鍵實作細節

1. **參數互斥驗證（三層設計）**

   為確保 `githubToken` 和 `serverAddress` 不會同時使用，實作了三層驗證：

   **層級 1：task.json（UI 層）**
   - 在 helpMarkDown 中標註互斥關係
   - 提示使用者僅能選擇一種認證方式

   **層級 2：index.ts（主程式層）**
   ```typescript
   if (githubToken && serverAddress) {
       throw new Error('⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式');
   }
   ```
   - 讀取參數後立即驗證
   - 早期失敗（Fail Fast），節省 Pipeline 執行時間

   **層級 3：GithubCopilotService（服務層）**
   ```typescript
   constructor(githubToken?: string, serverAddress?: string, ...) {
       if (githubToken && serverAddress) {
           throw new Error('⛔ GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式');
       }
   }
   ```
   - 防止直接使用 Service 繞過驗證
   - 深度防禦（Defense in Depth）

2. **Token 類型驗證**
   ```typescript
   if (this.githubToken?.startsWith('ghp_')) {
       throw new Error('⛔ Classic personal access tokens (ghp_) are not supported. Please use Fine-grained personal access token (github_pat_).');
   }
   ```
   - 在初始化時檢查 Token 前綴
   - 提供清楚的錯誤訊息指導使用者

3. **Session 管理**
   - 每個請求建立獨立的 session
   - 使用 `systemMessage.content` 傳遞 system instruction
   - 使用 `sendAndWait()` 發送並等待回應
   - 完成後呼叫 `session.destroy()` 清理資源

4. **Token Usage 追蹤**
   - 嘗試從 SDK 回應中提取 usage 資訊
   - 若不可用，使用估算（字元數 / 4）
   - 日誌明確標註是實際值或估算值

5. **日誌輸出**
   - 根據認證模式顯示不同的連接日誌：
     - Token 模式：`+ Authentication: Token`
     - Server 模式：`+ Server: {serverAddress}`
     - Local 模式：`+ Server: local agent`

### 現有限制

1. **SDK 處於 Technical Preview**
   - API 可能變動需要調整
   - 已設計彈性介面便於未來調整

2. **不支援 Temperature 和 MaxTokens**
   - SDK 不直接支援這些參數
   - 未來可能需透過 provider config 設定

### Token 安全性最佳實踐

1. **使用 Secret Variables**
   - 在 Azure DevOps Pipeline 中將 Token 設為秘密變數
   - Pipeline 會自動在日誌中遮罩 Token

2. **最小權限原則**
   - 僅授予 Copilot Read 權限
   - 不要授予不必要的額外權限

3. **定期輪替 Token**
   - 建議每 90 天輪替一次
   - 使用短期 Token 降低風險

4. **切勿提交至版本控制**
   - 確保 .env 檔案在 .gitignore 中
   - 使用環境變數或秘密管理服務

### 測試建議

#### 方案 1：使用 Token 模式（推薦用於 CI 測試）
1. **取得 Fine-grained Personal Access Token**
   - 前往 [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
   - 建立 Token 並授予 Copilot Read 權限

2. **設定 .env**
   ```properties
   AiProvider=GitHubCopilot
   GitHubCopilotToken=github_pat_YOUR_TOKEN_HERE
   ModelName=gpt-5-mini
   ```

3. **執行 debug**
   ```powershell
   npm run devscripts:ai
   ```

#### 方案 2/3：使用本機 CLI 或遠端 CLI Server（推薦用於本地開發）

兩種模式都需要相同的初始設定：

1. **安裝並驗證 GitHub Copilot CLI**
   ```bash
   # 安裝 CLI
   npm install -g @github/copilot

   # 登入 GitHub
   copilot auth login

   # 檢查是否已安裝
   copilot --version
   ```

**方案 2：本機 CLI 模式**

2. **設定 .env**（不需要 Token 或 Server Address）
   ```properties
   AiProvider=GitHubCopilot
   ModelName=gpt-5-mini
   ```

3. **執行 debug**
   ```powershell
   npm run devscripts:ai
   ```

**方案 3：遠端 CLI Server 模式**

2. **設定 .env**
   ```properties
   AiProvider=GitHubCopilot
   GitHubCopilotServerAddress=localhost:8080
   ModelName=gpt-5-mini
   ```

3. **啟動測試 CLI Server**
   ```bash
   copilot --headless --port 8080
   ```

4. **執行 debug**
   ```powershell
   npm run devscripts:ai
   ```


## 打包與上傳 Marketplace（SOP）
首先你需要有 Visual Studio Marketplace 的 Publisher（發佈者），並且在 `vss-extension.json` 中的 `publisher` 欄位是正確的（本 repo 內為 `LawrenceShen`）。

步驟：
1. 確認 `vss-extension.json` 中的 `version` 已經更新（每次發佈請手動遞增版本號，例如 1.0.0 → 1.0.1）。
2. 若尚未安裝 tfx-cli，執行：

```powershell
npm run packaging:install-tool
```

3. 建置並打包：
完成後，會產生新版本的 VSIX 檔案到 packages 資料夾

```powershell 
npm run packaging:package
```

4. 上傳至 marketplace：
登入 MarketPlace 發布平台，並將打包最新的 VSIX 檔案上傳上去，如下圖所示![MarketPlace 發布平台](screenshots/marketplace.png?raw=true) 


注意事項：
- 確保不要在 commit 中包含任何敏感的 API key 或 PAT。
- 每次發佈前務必更新 `vss-extension.json` 的 `version` 欄位。


## 常見問題與除錯建議
- 無法透過 PAT 取得 PR 內容：請檢查 PAT 權限（需要有 Code: Read & Pull Request Read/Write）。
- AI 無回應或回應錯誤：檢查 `GeminiAPIKey` (或 `OpenAIAPIKey`/`GrokAPIKey`/`ClaudeAPIKey`)、`AiProvider`、`ModelName` 是否正確，並確認網路可連至該服務。


## 參考文件
- [Marketplace & 擴充性檔](https://learn.microsoft.com/zh-tw/azure/devops/marketplace-extensibility/?view=azure-devops)
- [新增自定義管線任務擴充功能](https://learn.microsoft.com/zh-tw/azure/devops/extend/develop/add-build-task?view=azure-devops&toc=%2Fazure%2Fdevops%2Fmarketplace-extensibility%2Ftoc.json)
- [Azure 擴充清單參考](https://learn.microsoft.com/en-us/azure/devops/extend/develop/manifest?view=azure-devops)
- [MarketPlace 發布平台](https://marketplace.visualstudio.com/manage)