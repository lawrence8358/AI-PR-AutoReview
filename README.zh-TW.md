[English](./README.md) | [繁體中文](./README.zh-TW.md)
# AI Code Review for Azure DevOps

這是一個 Azure DevOps Pipeline 擴充套件，利用大型語言模型 (LLM) 的能力，自動針對 Pull Request (PR) 的程式碼變更（Diff）進行智慧化 Code Review，並將審查建議直接留言在 PR 中。

**全面支援主流 AI 平台：**
+ **GitHub Copilot** (支援所有版本訂閱)
+ **OpenAI** (gpt-5-mini 等)
+ **Google Gemini**
+ **Anthropic Claude**
+ **xAI Grok**

> **特色亮點**：現已支援 **GitHub Copilot**！您可以直接利用現有的 GitHub Copilot 訂閱（不分版本），將 AI 審查能力無縫整合進 Azure DevOps 流程中。本套件亦支援針對 GitHub 儲存庫的 Pull Request CI 情境。


## ✨ 主要功能
+ **自動化 PR 審查**：在 PR 建置驗證 (Build Validation) 過程中自動觸發，提供 24/7 的程式碼把關。
+ **多模型支援**：單一套件完整支援 Google Gemini、OpenAI、Grok、Claude 與 GitHub Copilot，可依需求彈性切換。
+ **GitHub Copilot 深度整合**：支援連接 GitHub Copilot CLI Server，直接重用現有的訂閱 (Individual/Business/Enterprise)，兼顧成本與隱私。
+ **直接回饋**：將 AI 的審查建議直接以評論形式發佈到 PR 中，與開發團隊無縫協作。
+ **高度可自訂**：可詳盡自訂 AI 的系統提示 (System Prompt)、模型參數 (Temperature 等)，打造專屬的 AI Reviewer。
+ **智慧過濾**：可精確指定要包含或排除的檔案副檔名，專注於核心程式碼。
+ **精準行號標註（行內評論）**：AI 評論直接錨定至修改行號，顯示在 Files Changed 頁籤，便於精確定位問題所在。


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
| **GitHub Copilot** | GitHub Token 或 CLI 設定 | 請參考下方 [GitHub Copilot 前置作業](#github-copilot-前置作業) |

### GitHub Copilot 前置作業

若您或您的組織擁有 GitHub Copilot 訂閱（個人版/商業版/企業版），可使用 GitHub Copilot 進行 PR Code Review，本套件提供三種使用模式。

#### 三種使用模式

本套件會根據您提供的參數自動判斷使用哪種模式：

| 模式 | 適用情境 | 參數配置 | 前置需求 |
|------|----------|----------|----------|
| **Token 模式** | 雲端 CI（Azure Pipelines 託管代理程式） | 僅提供 **GitHub Token** | • GitHub Copilot 訂閱<br>• Fine-grained Personal Access Token 且具備 Copilot 唯讀權限<br>• CLI 由 Task **自動安裝** |
| **遠端 CLI Server** | 集中式架構 | 僅提供 **CLI Server Address** | • GitHub Copilot 訂閱<br>• 伺服器已安裝 GitHub Copilot CLI（`npm install -g @github/copilot`）<br>• 已完成身份驗證（`copilot auth login`）<br>• Agent 與 Server 之間的網路連通性 |
| **本機 CLI** | 地端 CI，已預先設定好的 Build Agent | 不提供 Token 或 Server Address | • GitHub Copilot 訂閱<br>• Build Agent 已完成身份驗證（`copilot auth login`）<br>• CLI 由 Task **自動安裝** |

**重要**：GitHub Token 和 CLI Server Address **不能同時使用**，請僅選擇其中一種認證方式。

#### Token 模式設定（建議用於雲端 CI）

1. **取得 Fine-grained Personal Access Token**

   前往 [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)

   建立新 Token 並設定：
   - **權限**：帳戶權限 → Copilot Requests → 存取權：**唯讀**
   - **Token 格式**：`github_pat_`（Fine-grained）或 `gho_`、`ghu_`（其他支援類型）
   - **不支援**：Classic token（`ghp_`）

2. **將 Token 儲存為 Secret Variable**

   在 Azure DevOps Pipeline 中將 Token 新增為秘密變數，避免在日誌中曝光。

3. **設定 Pipeline Task**
   - **AI Provider**：選擇 `GitHub Copilot`
   - **GitHub Copilot Token**：輸入您的 Fine-grained Personal Access Token（或使用秘密變數）
   - **CLI Server Address**：留空
   - **Model Name**：（選填）預設為 `gpt-5-mini`

#### 遠端 CLI Server 與本機 CLI 模式設定

**遠端 CLI Server 模式** 需要在伺服器上安裝並完成身份驗證：

1. **安裝 GitHub Copilot CLI**（在伺服器上）
   ```bash
   npm install -g @github/copilot
   ```
   參考文件：[GitHub Copilot CLI 安裝指南](https://docs.github.com/en/copilot/how-tos/copilot-cli/install-copilot-cli)

2. **進行 GitHub 身份驗證**（在伺服器上）
   ```bash
   copilot auth login
   ```

**僅限遠端 CLI Server 模式：**

3. **啟動 CLI Server**

   在內部網路伺服器上啟動 CLI Server：
   ```bash
   copilot --headless --port 8080
   ```

4. **設定 Pipeline Task**
   - **AI Provider**：選擇 `GitHub Copilot`
   - **GitHub Copilot Token**：留空
   - **CLI Server Address**：輸入 `your-server-ip:8080` 或 `your-domain:8080`
   - **Model Name**：（選填）預設為 `gpt-5-mini`

**本機 CLI 模式**，Task 會自動安裝 CLI，您只需預先在 Build Agent 完成身份驗證：

1. **進行 GitHub 身份驗證**（在 Build Agent 上，一次性設定）
   ```bash
   npx @github/copilot auth login
   ```

2. **設定 Pipeline Task**
   - **AI Provider**：選擇 `GitHub Copilot`
   - **GitHub Copilot Token**：留空
   - **CLI Server Address**：留空
   - **Model Name**：（選填）預設為 `gpt-5-mini`

#### 安全性最佳實踐
- 務必使用 **Secret Variables** 儲存 GitHub Token
- 使用 **最小必要權限**Copilot Requests 唯讀）
- 定期輪替 Token
- 切勿將 Token 提交至原始碼控管

---

在使用此 Task 之前，您還需要完成以下設定：

### ⚠️（僅 GitHub 儲存庫）設定 GitHub 存取 Token

> **此步驟僅適用於 Azure DevOps Pipeline 的原始碼來自 GitHub 儲存庫的情況。**
> 若您使用的是 Azure DevOps Git 儲存庫，請直接跳至 Step 1。

當 Pipeline 的原始碼託管於 **GitHub** 時，Azure DevOps 的內建身份識別（`SystemVssConnection`）無法用來呼叫 GitHub API。本擴充套件透過 **GitHub REST API** 讀取 PR Diff 並發佈審查評論，因此需要手動設定 GitHub 個人存取權杖（PAT）。

**錯誤原因**：未設定此項時，擴充套件無法取得存取憑證，並會出現以下錯誤：
> `Task failed with error: ⛔ Unable to get DevOps access token`

#### 設定步驟

1. **建立 GitHub 個人存取權杖（PAT）**

   **方案 A — Classic Token（建議，設定較簡單）**

   前往 [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)

   建立新 Token，並依據儲存庫類型勾選對應範圍：

   ![Classic Token 權限設定](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/CI7.png)

   - **公開儲存庫**：勾選 `public_repo` — Access public repositories（提供公開儲存庫的讀寫存取，包含 PR 評論）
   - **私有儲存庫**：勾選 `repo` — Full control of private repositories（需勾選最上層的 `repo`；**僅勾選子項目**如 `public_repo` 或 `repo:status` 對私有儲存庫**不足以**寫入 PR 評論）

   > **重要提示**：若目標為**私有 GitHub 儲存庫**，必須勾選最上層的 `repo` 完整範圍。僅勾選子項目（如 `repo:status`、`public_repo`）不會授予寫入 PR 評論所需的權限。

   **方案 B — Fine-grained Token**

   前往 [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)

   建立 Token 並設定範圍至目標**儲存庫**，需要以下權限：
   - **Repository permissions → Pull requests**：Read and write（允許套件發佈評論）
   - **Repository permissions → Contents**：Read-only（允許套件讀取檔案內容）

2. **將 Token 新增為 Pipeline 密碼變數**

   在您的 Azure DevOps Pipeline 中：
   - 點選 **Edit** 編輯您的 Pipeline
   - 點選右上角的 **Variables**
   - 點選 **+ Add** 並設定：
     - **Name**：`AccessToken`
     - **Value**：您的 GitHub PAT
     - ✅ 勾選 **Keep this value secret**，防止 Token 出現在建置日誌中
   - 點選 **Save** 儲存

   ![Pipeline 變數設定](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/CI6.png)

3. **注意事項**
   - 變數名稱 `AccessToken` **區分大小寫**，請確保大小寫完全一致。
   - 完成以上設定後，擴充套件便會使用此 Token 對 GitHub 讀取 PR Diff 並發佈審查評論。**GitHub 儲存庫不需要**再進行下方 Step 1 至 Step 3 的 Azure DevOps 服務權限設定。

---

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

詳細審核模式參數排列組合說明，請參考 [PARAMETER-COMBINATIONS.zh-TW.md](./PARAMETER-COMBINATIONS.zh-TW.md)。

| 標籤 (Label) | 類型 (Type) | 必要 | 預設值 | 說明 |
|---|---:|:---:|---|---|
| AI Provider | pickList | 是 | Google | 選擇要用於產生評論的 AI 平台。選項: Google (Google Gemini)、OpenAI、Grok (xAI)、Claude (Anthropic)、GitHub Copilot。 |
| Gemini Model Name | string | 條件式 | gemini-2.5-flash | 輸入 Google Gemini 的模型名稱，選擇 Google 時必填。 |
| Gemini API Key | string | 條件式 | 無 | 輸入 Google Gemini 的 API Key，選擇 Google 時必填。 |
| OpenAI Model Name | string | 條件式 | gpt-5-mini | 輸入 OpenAI 的模型名稱（例如 gpt-5、gpt-5-mini），選擇 OpenAI 時必填。 |
| OpenAI API Key | string | 條件式 | 無 | 輸入 OpenAI 的 API Key，選擇 OpenAI 時必填。 |
| Grok Model Name | string | 條件式 | grok-3-mini | 輸入 Grok 的模型名稱（例如 grok-3-mini），選擇 Grok 時必填。 |
| Grok (xAI) API Key | string | 條件式 | 無 | 輸入 Grok (xAI) 的 API Key，選擇 Grok 時必填。 |
| Claude Model Name | string | 條件式 | claude-haiku-4-5 | 輸入 Claude 的模型名稱（例如 claude-haiku-4-5），選擇 Claude 時必填。 |
| Claude API Key | string | 條件式 | 無 | 輸入 Claude (Anthropic) 的 API Key，選擇 Claude 時必填。 |
| **GitHub Copilot Token** | string | 否 | 無 | **（選填）GitHub Fine-grained Personal Access Token**（格式：`github_pat_xxx`），用於向 GitHub Copilot 服務認證。從 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens 取得。**必要權限**：帳戶權限 → Copilot Requests → 存取權：唯讀。**注意**：不支援 Classic token（`ghp_`）。**不能與 CLI Server Address 同時使用**。選擇 GitHub Copilot 時顯示。 |
| GitHub Copilot CLI Server Address | string | 否 | 無 | （選填）輸入 GitHub Copilot CLI Server 位址（IP 或 Domain + Port）。範例：192.168.1.100:8080 或 copilot.internal.company.com:8080。若未填寫且未提供 Token，則使用 Build Agent 內的 GitHub Copilot CLI。**不能與 GitHub Token 同時使用**。選擇 GitHub Copilot 時顯示。 |
| GitHub Copilot Model Name | string | 否 | gpt-5-mini | 輸入 GitHub Copilot 使用的模型名稱。選填，預設為 gpt-5-mini。選擇 GitHub Copilot 時顯示。 |
| GitHub Copilot Request Timeout (ms) | string | 否 | 300000 | GitHub Copilot 的請求逾時時間（毫秒）。預設值：300000 ms（5 分鐘）。選擇 GitHub Copilot 時顯示。 |
| GitHub Copilot CLI Path | string | 否 | 無 | （選填）Build Agent 上 Copilot CLI 執行檔的絕對路徑。範例（Windows）：`C:\Tools\copilot\copilot.exe`。若為空，依序嘗試環境變數 `COPILOT_CLI_PATH`，再嘗試系統 PATH。選擇 GitHub Copilot 時顯示。 |
| System Instruction Source | pickList | 是 | Built-in | 選擇系統指令的來源。選項: Built-in (內建), Inline (行內), File (檔案)。 |
| System Prompt File | string | 否 | 無 | 系統提示詞檔案的路徑。支援格式: .md, .txt, .json, .yaml, .yml, .xml, .html。選填。如果檔案不存在或為空，會自動回退到行內指令。 |
| System Instruction | multiLine | 否 | You are a senior software engineer. Please help... | 用於指導 AI 模型行為的系統級指令。當 System Instruction Source 選擇 'Inline' 時使用。選填。如果為空，系統會自動使用預設的 Code Review 指令。 |
| Response Language | string | 是 | Taiwanese (zh-TW) | 指定 AI 回應的語言。用於控制 AI 審查評論的輸出語言。 |
| Max Output Tokens | string | 否 | （未設定） | AI 模型回應的最大輸出 Token 數量。留空則使用模型預設限制。 |
| Temperature | string | 否 | 0.2 | AI 模型的溫度設定，用於控制回應的隨機性。 |
| File Extensions to Include | string | 否 | 無 | 要納入 Code Review 分析的副檔名列表（以逗號分隔）。若為空，預設包含所有非二進位檔案。 |
| Binary File Extensions to Exclude | string | 否 | 無 | 要從 Code Review 分析中排除的二進位副檔名列表（以逗號分隔）。若為空值，系統會自動排除常見的二進位檔案類型（例如：.jpg, .jpeg, .png, .gif, .bmp, .ico, .webp, .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .zip, .tar, .gz, .rar, .7z, .exe, .dll, .so, .dylib, .bin, .dat, .class, .mp3, .mp4, .avi, .mov, .flv, .md, .markdown, .txt, .gitignore）。若您提供自訂值，系統會採用您輸入的檔案類型列表。 |
| Enable AI Throttle Mode | boolean | 否 | true | 啟用 AI 節流模式（預設啟用），當啟用時僅送程式碼差異給 AI 審查；停用時則送整個新檔案內容給 AI 審查。 |
| Enable Incremental Diff Mode | boolean | 否 | true | 啟用增量 Diff 模式，當啟用時僅審查最後一次推送（最新 iteration）的變更；停用時則審查所有 iteration 的 PR 變更。**僅在「啟用 AI 節流模式」為開啟時有效**（節流模式關閉時此選項在 UI 自動隱藏）。**注意（Azure DevOps）**：確實根據最新 push 過濾審查檔案範圍。**注意**：`enableIncrementalDiff` 僅在 Azure DevOps 上有效。在 GitHub 上此設定無作用（GitHub API 始終回傳全部 PR 檔案）。 |
| Enable Inline Comments (精準行號標註) | boolean | 否 | true | 啟用時（預設），AI 回傳結構化 JSON，評論以精準行號標註形式（Files Changed 頁籤）發佈。停用時，發佈單一摘要評論到 PR 討論串。**注意**：啟用此模式時，系統指令會自動附加 JSON 格式需求，覆寫 AI 的輸出格式，同時保留您自訂系統指令的語言偏好。 |
| Group Inline Comments by File | boolean | 否 | false | 停用時（預設），每個問題各自發佈一則行內評論；啟用時，同一檔案的多個問題合併為單一行內評論區塊。**僅在啟用行內評論模式時顯示且有效**。 |
| Inline Strict Mode (包含 Suggestion) | boolean | 否 | false | 停用時（預設），AI 僅回報 critical 和 warning 問題；啟用時，額外包含 suggestion 級別的問題，提供更詳盡的審查。**僅在啟用行內評論模式時顯示且有效**。 |
| Show Review Content | boolean | 否 | true | 顯示審核內容（預設啟用），當啟用時會將送給 AI 的程式碼變更內容、System Instruction、Prompt 以及 AI 回應印出到主控台，方便除錯使用。 |


## 🎉 結果展示
### Gemini
![](screenshots/Review_Gemini_TW.png?raw=true) 

### OpenAI
![](screenshots/Review_OpenAI_TW.png?raw=true)

### Grok (xAI)
![](screenshots/Review_Grok_TW.png?raw=true)

### Claude (Anthropic)
![](screenshots/Review_Claude_TW.png?raw=true)