# [English](./README.md) | [繁體中文](./README.zh-TW.md)
# 🤖 AI Code Review for Azure DevOps

這是一個 Azure DevOps Pipeline 擴充套件，主要目的是讓 AI 自動針對 Pull Request (PR) 的程式碼變更（Diff）進行 Code Review，並將結果評論（Comment）回 PR。

目前支援：**Google Gemini**、**OpenAI**、**Grok (xAI)**、**Claude (Anthropic)**、**GitHub Copilot**。

> 本套件亦支援針對 GitHub 儲存庫的 Pull Request CI 情境進行抓取與回寫評論。


## ✨ 主要功能
+ **自動化 PR 審查**：在 PR 建置驗證 (Build Validation) 過程中自動觸發。
+ **支援多個 AI 平台**：支援 Google Gemini、OpenAI、Grok (xAI)、Claude (Anthropic)、GitHub Copilot (預覽版) 進行程式碼分析。
+ **GitHub Copilot CLI 整合**：支援連接企業內部部署的 GitHub Copilot CLI Server，重用現有基礎設施。
+ **直接回饋**：將 AI 的審查建議直接以評論形式發佈到 PR 中。
+ **高度可自訂**：可自訂 AI 的系統提示 (System Prompt)、模型參數 (Temperature 等)。
+ **檔案過濾**：可指定要包含或排除的檔案副檔名。


## 安裝
您可以從 [Azure DevOps Marketplace](https://marketplace.visualstudio.com/items?itemName=LawrenceShen.ai-pr-autoreview) 安裝此擴充套件。


## 🛠️ 設定步驟

### 📊 AI Provider 前置作業比較表
不同的 AI Provider 有不同的前置條件：

| AI Provider | 需要前置作業 | 說明 |
|---|---|---|
| Google Gemini | 申請 API Key | 從 [Google AI Studio](https://aistudio.google.com/app/apikey) 獲取 API Key |
| OpenAI | 申請 API Key | 從 [OpenAI Platform](https://platform.openai.com/api-keys) 獲取 API Key |
| Grok (xAI) | 申請 API Key | 從 [xAI Console](https://console.x.ai/) 獲取 API Key |
| Claude (Anthropic) | 申請 API Key | 從 [Anthropic Console](https://console.anthropic.com/) 獲取 API Key |
| **GitHub Copilot** | 部署 CLI Server | 請參考下方 [GitHub Copilot CLI 前置作業](#github-copilot-cli-前置作業) |

### GitHub Copilot CLI 前置作業

若您的組織已部署 GitHub Copilot 企業版，您可以使用內部 CLI Server 進行 PR Code Review。

#### 適用情境
- 企業內部已部署 GitHub Copilot CLI Server
- 希望重用現有 Copilot 基礎設施
- 需要統一 AI 工具鏈體驗

#### CLI Server 設定步驟

1. **安裝 GitHub Copilot CLI**
   ```bash
   npm install -g @github/copilot-sdk
   ```

2. **啟動 CLI Server 模式**
   
   在內部網路中的伺服器上啟動 CLI Server：
   ```bash
   copilot --headless --port 8080
   ```  

3. **在 Pipeline Task 中設定**
   - **AI Provider**: 選擇 `GitHub Copilot`
   - **Network Type**: 選擇 `內部網路 (Intranet)`
   - **CLI Server Address**: (選填) 輸入 `your-server-ip:8080` 或 `your-domain:8080`。若未填寫，將使用 Build Agent 內的 GitHub Copilot CLI
   - **Model Name**: (選填) 預設為 `gpt-4o`

#### 注意事項
- **遠端 Server 模式**：當填寫 CLI Server Address 時，確保 Pipeline Agent 與 CLI Server 在同一內部網路或能夠互相連接。CLI Server 必須在 Pipeline 執行時保持運行。
- **本機 CLI 模式**：若未填寫 CLI Server Address，將會使用 Build Agent 內已登入的 GitHub Copilot CLI。需確保：
  - Build Agent 已安裝 GitHub Copilot CLI
  - 已執行 `copilot auth login` 完成身份驗證
  - Agent 擁有 GitHub Copilot 存取權限
- 目前僅支援內部網路模式，網際網路模式將在未來版本提供

---

在使用此 Task 之前，您還需要完成以下設定：

### Step 1: 設定 CI 服務權限
為了讓 Pipeline 服務能將 AI 的評論寫回 PR，您必須授予它權限，若未設定此權限，Pipeline 將會失敗並顯示 `Error: TF401027: You need the Git 'PullRequestContribute' permission... `錯誤。
+ 設定 CI 建置服務寫回 PR 評論的權限，選擇 `Projects Settings -> Repositories -> Security`。
+ 在使用者清單中找到您的 Project Collection Build Service (YourCollectionName) 帳號（或您 Pipeline 使用的特定服務帳號）。
+ 將 Contribute to pull request 權限設定為 `Allow`。
![](screenshots/RepoSecurity.png?raw=true) 

### Step 2: 建立 Pull Request (PR) Pipeline
設定分支原則 (Branch Policy)，以便在建立 PR 時自動觸發此 Pipeline，另外，本套件僅在 PR 請求的建置中才會觸發 Code Review 流程，一般建置模式下將會跳過不執行。
+ 選擇 `Projects Settings -> Repositories -> YourGitProject -> Policies -> Branch Policies -> 點選目標分支`（例如 main 或 master）。
![](screenshots/CI3.png?raw=true) 
+ 在 Build Validation 中設定建置驗證規則，此處依照 `團隊規範` 設定即可。
![](screenshots/CI4.png?raw=true) 
+ 請先確保 Pipeline 中已包含正常 CI 的 Build Task，接著加入本擴充套件。
![](screenshots/CI1.png?raw=true) 
+ 輸入 Task 參數，請依實際需求調整。
![](screenshots/CI2.png?raw=true) 

### Step 3: (建議) 強制使用 PR 合併程式碼
為確保所有程式碼都經過 Code Review，建議設定分支原則，要求必須透過 PR 才能合併。
+ 選擇 `Projects Settings -> Repositories -> YourGitProject -> Policies -> Branch Policies -> 點選目標分支`（例如 main 或 master）。
![](screenshots/RepoPolicies1.png?raw=true) 
+ 設定分支政策，開啟 `Require a minimum number of reviewers`，這邊為了方便展示，設定了允許自己同意自己的變更，實際請依 `團隊規範` 設定即可。
![](screenshots/RepoPolicies2.png?raw=true) 
 

## 📋 Task 參數詳解
以下是此 Task 支援的所有輸入參數：

| 標籤 (Label) | 類型 (Type) | 必要 | 預設值 | 說明 |
|---|---:|:---:|---|---|
| AI Provider | pickList | 是 | Google | 選擇要用於產生評論的 AI 平台。選項: Google (Google Gemini)、OpenAI、Grok (xAI)、Claude (Anthropic)、GitHub Copilot (預覽版)。 |
| GitHub Copilot Network Type | pickList | 條件式 | 內部網路 (Intranet) | 選擇 GitHub Copilot 連接類型。選項: 內部網路 (Intranet)、網際網路 (Internet - 即將推出)。選擇 GitHub Copilot 時顯示。 |
| Gemini Model Name | string | 條件式 | gemini-2.5-flash | 輸入 Google Gemini 的模型名稱，選擇 Google 時必填。 |
| Gemini API Key | string | 條件式 | 無 | 輸入 Google Gemini 的 API Key，選擇 Google 時必填。 |
| OpenAI Model Name | string | 條件式 | gpt-4o-mini | 輸入 OpenAI 的模型名稱（例如 gpt-4o、gpt-4o-mini），選擇 OpenAI 時必填。 |
| OpenAI API Key | string | 條件式 | 無 | 輸入 OpenAI 的 API Key，選擇 OpenAI 時必填。 |
| Grok Model Name | string | 條件式 | grok-3-mini | 輸入 Grok 的模型名稱（例如 grok-3-mini），選擇 Grok 時必填。 |
| Grok (xAI) API Key | string | 條件式 | 無 | 輸入 Grok (xAI) 的 API Key，選擇 Grok 時必填。 |
| Claude Model Name | string | 條件式 | claude-haiku-4-5 | 輸入 Claude 的模型名稱（例如 claude-haiku-4-5），選擇 Claude 時必填。 |
| Claude API Key | string | 條件式 | 無 | 輸入 Claude (Anthropic) 的 API Key，選擇 Claude 時必填。 |
| GitHub Copilot CLI Server Address | string | 否 | 無 | (選填) 輸入 GitHub Copilot CLI Server 位址（IP 或 Domain + Port）。範例：192.168.1.100:8080 或 copilot.internal.company.com:8080。若未填寫，則使用 Build Agent 內的 GitHub Copilot CLI。選擇 GitHub Copilot + 內部網路時顯示。 |
| Model Name (GitHub Copilot) | string | 否 | gpt-4o | 輸入 GitHub Copilot 使用的模型名稱。選填，預設為 gpt-4o。選擇 GitHub Copilot + 內部網路時顯示。 |
| System Instruction Source | pickList | 是 | Inline | 選擇系統指令的來源。選項: Inline (行內), File (檔案)。 |
| System Prompt File | string | 否 | 無 | 系統提示詞檔案的路徑。支援格式: .md, .txt, .json, .yaml, .yml, .xml, .html。選填。如果檔案不存在或為空，會自動回退到行內指令。 |
| System Instruction | multiLine | 否 | You are a senior software engineer. Please help... | 用於指導 AI 模型行為的系統級指令。當 System Instruction Source 選擇 'Inline' 時使用。選填。如果為空，系統會自動使用預設的 Code Review 指令。 |
| Prompt Template | multiLine | 是 | {code_changes} | AI 模型的自訂提示模板。`{code_changes}` 將被替換為實際的程式碼變更內容。 |
| Max Output Tokens | string | 否 | 4096 | AI 模型回應的最大輸出 Token 數量。 |
| Temperature | string | 否 | 1.0 | AI 模型的溫度設定，用於控制回應的隨機性。 |
| File Extensions to Include | string | 否 | 無 | 要納入 Code Review 分析的副檔名列表（以逗號分隔）。若為空，預設包含所有非二進位檔案。 |
| Binary File Extensions to Exclude | string | 否 | 無 | 要從 Code Review 分析中排除的二進位副檔名列表（以逗號分隔）。若為空值，系統會自動排除常見的二進位檔案類型（例如：.jpg, .jpeg, .png, .gif, .bmp, .ico, .webp, .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .zip, .tar, .gz, .rar, .7z, .exe, .dll, .so, .dylib, .bin, .dat, .class, .mp3, .mp4, .avi, .mov, .flv, .md, .markdown, .txt, .gitignore）。若您提供自訂值，系統會採用您輸入的檔案類型列表。 |
| Enable AI Throttle Mode | boolean | 否 | true | 啟用 AI 節流模式（預設啟用），當啟用時僅送程式碼差異給 AI 審查；停用時則送整個新檔案內容給 AI 審查。**注意**：當此選項關閉時，「啟用增量 Diff 模式」將無作用。 |
| Enable Incremental Diff Mode | boolean | 否 | false | 啟用增量 Diff 模式，當啟用時僅審查最後一次推送（最新 iteration）的變更；停用時則審查所有 iteration 的 PR 變更。**重要提示**：此選項只有在「啟用 AI 節流模式」為開啟時才有效。當節流模式關閉時，此設定將被忽略。 |
| Show Review Content | boolean | 否 | false | 顯示審核內容，當啟用時會將送給 AI 的程式碼變更內容、System Instruction、Prompt 以及 AI 回應印出到主控台，方便除錯使用。 |


## 🎉 結果展示
### Gemini
![](screenshots/Review_Gemini_TW.png?raw=true) 

### OpenAI
![](screenshots/Review_OpenAI_TW.png?raw=true)

### Grok (xAI)
![](screenshots/Review_Grok_TW.png?raw=true)

### Claude (Anthropic)
![](screenshots/Review_Claude_TW.png?raw=true)