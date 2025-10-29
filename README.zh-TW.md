# [English](./README.md) | [繁體中文](./README.zh-TW.md)
# 🤖 AI Code Review for Azure DevOps

這是一個 Azure DevOps Pipeline 擴充套件，主要目的是讓 AI 自動針對 Pull Request (PR) 的程式碼變更（Diff）進行 Code Review，並將結果評論（Comment）回 PR。

本版本目前優先支援 `Google Gemini`，未來將陸續支援其他 AI 平台。


## ✨ 主要功能
+ **自動化 PR 審查**：在 PR 建置驗證 (Build Validation) 過程中自動觸發。
+ **整合 AI 模型**：目前支援 Google Gemini (預設 gemini-2.5-flash) 進行程式碼分析。
+ **直接回饋**：將 AI 的審查建議直接以評論形式發佈到 PR 中。
+ **高度可自訂**：可自訂 AI 的系統提示 (System Prompt)、模型參數 (Temperature 等)。
+ **檔案過濾**：可指定要包含或排除的檔案副檔名。


## 安裝
您可以從 [Azure DevOps Marketplace](https://marketplace.visualstudio.com/items?itemName=LawrenceShen.ai-pr-autoreview) 安裝此擴充套件。


## 🛠️ 設定步驟
在使用此 Task 之前，您需要完成以下設定：

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

| 參數名稱 (Name) | 標籤 (Label) | 類型 (Type) | 必要 | 預設值 | 說明 |
|---|---|---:|:---:|---|---|
| `inputAiProvider` | AI Provider | pickList | 是 | Google | 選擇要用於產生評論的 AI 平台。選項: Google (Google Gemini)。 |
| `inputModelName` | AI Model Name | string | 是 | gemini-2.5-flash | 輸入所選 AI 平台的模型名稱。（可見規則: inputAiProvider == Google） |
| `inputModelKey` | AI Model API Key | string | 是 | (空) | 輸入所選 AI 平台的 API Key。（可見規則: inputAiProvider == Google） |
| `inputSystemInstruction` | System Instruction | multiLine | 否 | You are a senior software engineer. Please help... (詳見 Task 預設) | 用於指導 AI 模型行為的系統級指令。 |
| `inputPromptTemplate` | Prompt Template | multiLine | 是 | {code_changes} | AI 模型的自訂提示模板。`{code_changes}` 將被替換為實際的程式碼變更內容。 |
| `inputMaxOutputTokens` | Max Output Tokens | string | 否 | 4096 | AI 模型回應的最大輸出 Token 數量。 |
| `inputTemperature` | Temperature | string | 否 | 1.0 | AI 模型的溫度設定，用於控制回應的隨機性。 |
| `inputFileExtensions` | File Extensions to Include | string | 否 | (空) | 要納入 Code Review 分析的副檔名列表（以逗號分隔）。若為空，預設包含所有非二進位檔案。 |
| `inputBinaryExtensions` | Binary File Extensions to Exclude | string | 否 | (空) | 要從 Code Review 分析中排除的二進位副檔名列表（以逗號分隔）。預設已包含常見的二進位類型。 |


## 結果展示
![](screenshots/CI6.png?raw=true) 
