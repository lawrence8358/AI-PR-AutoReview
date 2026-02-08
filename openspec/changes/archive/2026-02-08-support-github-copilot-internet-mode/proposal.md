## Why

原本 GitHub Copilot 功能僅支援兩種情境：本機 CLI（需預先在 CI Agent 設定授權）或遠端 CLI Server。透過查閱 GitHub Copilot SDK 文件發現，SDK 支援透過 `githubToken` 和 `useLoggedInUser: false` 配置來使用使用者提供的 Token 進行認證。這使得在雲端 CI 環境中，使用者可以直接透過 Pipeline 參數提供 GitHub Token，無需預先在 CI Agent 設定授權，大幅提升彈性並簡化雲端 CI 的配置流程。

## What Changes

- 新增 GitHub Token 認證支援，允許使用者透過 Pipeline 參數提供 Token（適用於雲端 CI 環境）
- 移除 `task.json` 中的「Network Type」選項，改為根據使用者提供的參數自動判斷使用情境：
  - **情境 1 - 本機 CLI 模式**（無 Token、無 CLI Server Address）：使用 CI Agent 預先設定的 GitHub 授權，適用於地端 CI
  - **情境 2 - Token 模式**（有 Token、無 CLI Server Address）：使用使用者提供的 Token，適用於雲端 CI 環境
  - **情境 3 - 遠端 CLI Server 模式**（有 CLI Server Address、不允許 Token）：連接遠端 CLI Server（該 Server 需預先設定授權），適用於集中式架構
- 修改 `GithubCopilotService` 建構子，新增 `githubToken` 參數
- 更新 `initializeClient` 方法，根據參數組合自動選擇連接模式：
  - 當提供 `githubToken` 時，傳遞 `githubToken` 和 `useLoggedInUser: false` 給 SDK
  - 當提供 `serverAddress` 時，傳遞 `cliUrl` 給 SDK
  - 當都不提供時，使用預設配置（本機 CLI）
- 新增參數互斥驗證邏輯（`task.json` 和程式端都要檢查）：
  - 當使用者同時提供 `githubToken` 和 `serverAddress` 時，必須拋出錯誤
  - 錯誤訊息：「GitHub Token 和 CLI Server Address 不能同時使用，請選擇其中一種認證方式」
- 更新 `task.json`：
  - 移除 `inputGitHubCopilotNetworkType` 欄位
  - 新增 `inputGitHubCopilotToken` 欄位（選填）
  - `inputGitHubCopilotServerAddress` 維持選填
  - 兩個欄位都在選擇 GitHub Copilot 時顯示，並在說明文字中標註互斥關係
- 更新使用者文件（`README.md`、`README.zh-TW.md`），說明三種使用情境的參數組合和適用場景
- 更新開發者文件（`README-Dev.md`），補充 GitHub Token 認證機制、參數互斥邏輯和測試方法
- 更新測試工具（`test-pr-review.ts`、`ai-comment.ts`），支援 `--github-token` 參數並驗證互斥邏輯

## Capabilities

### New Capabilities
無新增功能項目（此變更為現有功能的擴充）

### Modified Capabilities
- `github-copilot-provider`: 簡化認證機制，移除網路類型選項，改為根據使用者提供的參數（GitHub Token 或 CLI Server Address）自動判斷使用情境，並新增 GitHub Token 認證支援。同時新增參數互斥驗證，確保 Token 和 CLI Server Address 不會同時使用。

## Impact

**受影響的程式碼檔案**：
- `src/services/github-copilot.service.ts` - 新增 githubToken 參數、修改 Client 初始化邏輯、新增參數互斥驗證
- `src/task.json` - 移除 Network Type 欄位、新增 GitHub Token 輸入欄位、更新說明文字
- `src/index.ts` - 讀取 GitHub Token 參數、新增參數互斥驗證邏輯、傳遞參數到服務

**受影響的文件檔案**：
- `README.md` - 補充網際網路模式使用說明（英文）
- `README.zh-TW.md` - 補充網際網路模式使用說明（繁體中文）
- `README-Dev.md` - 補充 GitHub Token 認證機制和測試方法

**受影響的測試工具**：
- `devscripts/test-pr-review.ts` - 支援 `--github-token` 參數
- `devscripts/ai-comment.ts` - 從環境變數讀取 GitHub Token

**相依性**：
- 無新增套件依賴（繼續使用現有的 `@github/copilot-sdk`）

**破壞性變更**：
- 無破壞性變更，此為向後相容的擴充功能
- 現有使用內部網路模式的使用者不受影響
