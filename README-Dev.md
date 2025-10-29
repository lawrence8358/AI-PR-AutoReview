## AI PR AutoReview — 本地開發 & 發佈說明

此文件說明如何在本機環境測試與開發本專案（AI PR 自動 Code Review），包含 package.json 中常用的 scripts 使用情境、`devscripts/.env` 的用途以及打包與發佈（Marketplace）的 SOP。


## 專案資料夾結構
```
d:\Project\AiPrCodeReview
├── devscripts/              # 本地測試腳本
│   ├── .env                 # 環境變數設定檔（請勿提交正式環境的金鑰）
│   ├── ai-comment.ts        # 測試 AI 服務
│   ├── pr-changes.ts        # 測試取得 PR 變更
│   └── pr-comment.ts        # 測試新增 PR 評論
├── images/                  # 擴充功能圖示
│   ├── extension-icon.png
│   └── extension-icon-small.png
├── packages/                # 打包輸出資料夾（VSIX 檔案）
├── screenshots/             # 說明文件截圖
├── scripts/                 # 建置腳本
│   └── sync-taskjson.js     # 同步版本號至 task.json 和 package.json
├── src/                     # 主要程式碼
│   ├── interfaces/          # TypeScript 介面定義
│   │   ├── ai-service.interface.ts
│   │   └── pipeline-inputs.interface.ts
│   ├── services/            # 服務實作
│   │   ├── ai-provider.service.ts
│   │   ├── devops.service.ts
│   │   └── google-ai.service.ts
│   ├── index.ts             # 主程式進入點
│   └── task.json            # Azure Pipeline Task 定義檔
├── package.json             # npm 套件設定
├── tsconfig.json            # TypeScript 編譯設定
├── tsconfig.devscripts.json # devscripts 編譯設定
├── vss-extension.json       # Azure DevOps 擴充功能清單
├── README.md                # 專案說明文件
├── README-Dev.md            # 開發者說明文件
└── LICENSE.txt              # 授權條款
``` 


## 主要 Scripts 
- 使用 `npm run build` 執行完整建置流程（同步版本號、型別檢查、打包、複製檔案）。
- 使用 `npm run packaging:package` 建置 Marketplace 套件。
- `devscripts/.env`，此環境變數主要用於本地開發測試。
- `devscripts` 內有三個測試腳本
  + `npm run devscripts:ai`
  + `npm run devscripts:pr-changes`
  + `npm run devscripts:pr-comment`
- 本地開發模擬 pipeline 執行，請修改好 `devscripts/.env` 後，執行 `npm run debug`。


## Scripts 與使用情境
- `npm run clean`：清理 `dist/` 輸出資料夾。
- `npm run typecheck`：執行 TypeScript 型別檢查（不產生檔案）。
- `npm run copy`：將 `src/task.json` 和 `images/extension-icon-small.png` 複製至 `dist/`。
- `npm run bundle`：使用 `esbuild` 將 TypeScript 打包至 `dist/index.js`。
- `npm run build`：執行完整建置流程，包含同步版本號（`sync-taskjson.js`）、清理、型別檢查、打包與複製檔案。
- `npm run debug`：編譯後以 debug 模式執行（package.json 內為 `tsc && node --env-file=./devscripts/.env ./dist/index.js --debug`），會改為從環境變數讀取輸入值（方便本地模擬）。
- `npm run devscripts:ai`：編譯 devscripts（使用 `tsconfig.devscripts.json`）並執行 `dist/devscripts/ai-comment.js`，執行呼叫 AI 服務並印出回應。
- `npm run devscripts:pr-changes`：執行取得 PR 變更檔案並列印內容（需有效的 DevOps env 設定）。
- `npm run devscripts:pr-comment`：執行 DevOps API 新增 PR 評論（需有效的 DevOps env 設定）。
- `npm run packaging:install-tool`：安裝 `tfx-cli`（全域）以便打包與上傳。
- `npm run packaging:package`：建立 VSIX 包（使用 `vss-extension.json`）。
 

## devscripts/.env：用途與本機測試

`devscripts/.env` 用於在本機快速設定`測試`需要的變數，讓 `devscripts` 下的測試腳本與 `src/index.ts` 的 debug 模式能夠模擬實際 Azure DevOps pipeline 與 AI Provider 的互動，請務必不要把含有真實金鑰或 PAT 的檔案提交到版本控制。

下表列出常用變數及說明：

| 變數名稱 | 必要性 | 範例 | 說明 |
|---|:---:|---|---|
| DevOpsOrgUrl | 必要 | https://dev.azure.com/YourOrganization/ | Azure DevOps collection / 組織 URL |
| DevOpsAccessToken | 必要 | pat... | Personal Access Token (PAT)，需能讀取 PR、發表評論 |
| DevOpsProjectName | 必要 | YourProject | Azure DevOps 專案名稱 |
| DevOpsRepositoryId | 必要 | 00000000-0000-0000-0000-000000000000 | Repository ID（或在某些實作中可用 repo 名稱） |
| DevOpsPRId | 必要 | 4 | 要測試的 Pull Request 編號 |
| AiProvider | 必要 | Google | 在 `AIProviderService` 中註冊的 provider 名稱（例如 `Google`） |
| GeminiAPIKey | 選用 | AI_KEY | Google Generative API Key，若使用 Google 時，此欄位必填 |
| ModelName | 必要 | gemini-2.5-flash | 要使用的模型名稱 |
| SystemInstruction | 選用 | 你是一位資深工程師... | 傳給 AI 的 system 指令 |
| PromptTemplate | 必要 | {code_changes} | Prompt 範本，index.ts 以 `{code_changes}` 作為佔位符 |
| MaxOutputTokens | 選用 | 4096 | AI 回應最大 token 數量 |
| Temperature | 選用 | 1.0 | AI 生成隨機性 |
| FileExtensions | 選用 | .cs,.ts,.js | 要納入的檔案副檔名（逗號分隔） |
| BinaryExtensions | 選用 | .exe,.dll,.jpg | 要排除的二進位檔副檔名 |

.env 範例說明（切勿提交含真實金鑰的檔案）：

```properties
# Azure DevOps
DevOpsOrgUrl=https://dev.azure.com/YourOrganization/
DevOpsAccessToken=PASTE_YOUR_PAT_HERE
DevOpsProjectName=YourProject
DevOpsRepositoryId=00000000-0000-0000-0000-000000000000
DevOpsPRId=4

# AI Provider
GeminiAPIKey=PASTE_YOUR_GEMINI_KEY
AiProvider=Google
ModelName=gemini-2.5-flash
SystemInstruction=你是一位資深軟體工程師，請協助進行程式碼審查與分析。
PromptTemplate={code_changes}
MaxOutputTokens=4096
Temperature=1.0

# File filters
FileExtensions=.cs,.ts,.js,.aspx,.html
BinaryExtensions=.exe,.dll,.jpg,.png
```

注意：`src/index.ts` 在 debug 模式會從 `process.env` 讀取（而非 Azure Pipelines 的變數）。


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
- AI 無回應或回應錯誤：檢查 `GeminiAPIKey`、`AiProvider`、`ModelName` 是否正確，並確認網路可連至該服務。


## 參考文件
- [Marketplace & 擴充性檔](https://learn.microsoft.com/zh-tw/azure/devops/marketplace-extensibility/?view=azure-devops)
- [新增自定義管線任務擴充功能](https://learn.microsoft.com/zh-tw/azure/devops/extend/develop/add-build-task?view=azure-devops&toc=%2Fazure%2Fdevops%2Fmarketplace-extensibility%2Ftoc.json)
- [Azure 擴充清單參考](https://learn.microsoft.com/en-us/azure/devops/extend/develop/manifest?view=azure-devops)
- [MarketPlace 發布平台](https://marketplace.visualstudio.com/manage)