# AI PR AutoReview — 審核模式參數排列組合說明

本文件專注於審核行為相關的參數設定，AI 模型選擇、DevOps 連線、系統提示詞等非審核判斷參數請參考 README.md。

本文件說明各參數之間的相依關係、互斥限制，以及不同組合下的實際行為。

---

## 目錄

1. [參數總覽](#1-參數總覽)
2. [互斥參數（不能同時設定）](#2-互斥參數不能同時設定)
3. [條件生效參數（依賴其他參數）](#3-條件生效參數依賴其他參數)
4. [diff 格式說明與行號標註機制](#4-diff-格式說明與行號標註機制)
5. [所有審查模式場景](#5-所有審查模式場景)
6. [完整排列組合矩陣](#6-完整排列組合矩陣)
7. [建議配置快速選擇指南](#7-建議配置快速選擇指南)

---

## 1. 參數總覽

### 審查內容控制

| 參數 | 預設值 | 說明 |
|------|:------:|------|
| `enableThrottleMode` | `true` | `true`：僅送 diff；`false`：送完整檔案內容 |
| `enableIncrementalDiff` | `true` | `true`：僅審查最新 push 的變更；`false`：審查全部 PR 變更（只在 throttle=true 時 UI 顯示）（Azure DevOps Only） |

### 評論發佈模式

| 參數 | 預設值 | 說明 |
|------|:------:|------|
| `enableInlineComments` | `true` | `true`：精準行號標註行內評論；`false`：單一摘要評論 |
| `groupInlineCommentsByFile` | `false` | 合併同檔案問題（**只在 enableInlineComments=true 時 UI 顯示**） |
| `inlineStrictMode` | `false` | 是否回報 suggestion 級別（**只在 enableInlineComments=true 時 UI 顯示**） |
| `showReviewContent` | `true` | `true`：在審查評論中以可收合區塊顯示送給 AI 的內容；`false`：隱藏 |

### AI 回應控制

| 參數 | 預設值 | 說明 |
|------|:------:|------|
| `maxOutputTokens` | （未設定） | AI 回應的最大輸出 token 數，留空使用模型預設限制 |
| `temperature` | `0.2` | AI 取樣溫度（0.0–1.0），數值越低輸出越確定性 |
| `responseLanguage` | `Taiwanese (zh-TW)` | AI 審查回應的語言 |

### 系統指令

| 參數 | 預設值 | 說明 |
|------|:------:|------|
| `systemInstructionSource` | `Built-in` | 系統指令來源：`Built-in`（內建預設提示詞）、`Inline`（使用者提供的行內文字）、`File`（從檔案路徑載入） |

### 檔案過濾

| 參數 | 預設值 | 說明 |
|------|:------:|------|
| `fileExtensions` | 空（全部） | 以逗號分隔的副檔名白名單，僅審查符合的檔案（例如：`.ts,.cs,.py`），空值表示審查所有非二進位檔案 |
| `binaryExtensions` | 空（使用內建清單） | 以逗號分隔的二進位副檔名黑名單，強制排除這些檔案，空值使用內建預設清單（.jpg, .png, .pdf, .zip... 等） |

---

## 2. 互斥參數（不能同時設定）

### GitHub Copilot 認證三選一

> **規則**：`githubToken` 與 `serverAddress` **不能同時填寫**，否則拋出 `⛔ Error`

| 模式 | githubToken | serverAddress | copilotCliPath | 說明 |
|------|:-----------:|:-------------:|:--------------:|------|
| **Token 模式** | ✅ 填寫 | ❌ 留空 | 可選 | 雲端 CI，透過 GitHub API 認證 |
| **遠端 CLI Server** | ❌ 留空 | ✅ 填寫 | 可選 | 連接內網 Copilot CLI Server |
| **本機 CLI** | ❌ 留空 | ❌ 留空 | 可選 | 使用 Build Agent 本機 CLI |

> ❗ `githubToken` 和 `serverAddress` 都留空 → 自動使用本機 CLI 模式

---

## 3. 條件生效參數（依賴其他參數）

```
enableThrottleMode = true
  └─ enableIncrementalDiff 有效（UI 顯示）
       ├─ true：只審查最新 push 的 diff（Azure DevOps 實際過濾；GitHub 效果有限）
       └─ false：審查所有 PR 的 diff

enableThrottleMode = false（UI 隱藏 enableIncrementalDiff）
  └─ enableIncrementalDiff=true（Azure DevOps）：仍過濾檔案清單至最新 push，但送完整內容
  └─ enableIncrementalDiff=true（GitHub）：等同 false（全 PR 完整內容）

enableInlineComments = false（UI 隱藏 groupByFile 和 strictMode）
  └─ 發單一摘要評論到 PR 討論串

enableInlineComments = true（UI 顯示 groupByFile 和 strictMode）
  └─ groupInlineCommentsByFile
       ├─ true：同一檔案的所有 issues 合併為一則行內評論
       └─ false：每個 issue 各自一則行內評論（更精確的行號錨定）
  └─ inlineStrictMode
       ├─ true：AI 回報 critical + warning + suggestion
       └─ false：AI 只回報 critical + warning（預設，雜訊少）
  └─ systemInstruction：內容【保留】，自動在尾端附加 JSON 格式需求指令
```

---

## 4. diff 格式說明與行號標註機制

當 `enableThrottleMode=true` 時，程式使用 `git diff --no-index` 比較新舊版本，並透過 `processDiffOutput` 處理成帶行號標註的格式。

### 送給 AI 的 diff 格式範例（實際 debug 輸出）

```
@@ -39,6 +39,8 @@ public class GetDevOpsWorkItemListCommandHandler
-var result = await devopsApi.GetWorkItemsAsync(queryModel);
+[L39] DevopsWorkItemListResult result;
+[L40] try
+[L41] {
+[L42]     result = await devopsApi.GetWorkItemsAsync(queryModel);
+[L43] }
+[L44] catch (HttpRequestException ex)
+[L45] {
+[L46]     throw new CusException(...);
+[L47] }
```

### 行號標示規則

| 前綴 | 說明 |
|------|------|
| `+[LN]` | 新增行，`N` 為該行在**新版本檔案**中的實際行號（AI 用此決定 lineStart/lineEnd） |
| `-content` | 刪除行（顯示舊內容，不帶行號） |
| `@@` | 區塊標頭，標示此 hunk 在新檔案中的起始行號 |
| ` `（空格）| Context 行（上下文）：不輸出，但正確計入行號偏移 |

> **重要**：Context 行（舊版有、新版也有的未修改行）不會出現在送給 AI 的 diff 中，但行號仍正確計算，確保 `+[LN]` 永遠對應新版本實際行號。

---

## 5. 所有審查模式場景

### 場景一：全量 Diff 摘要評論（摘要模式）

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=false
```

**日誌輸出**：
```
📍 Full Diff Mode: Reviewing all PR changes from base branch
+ Throttle Mode: Enabled (diff only)
✅ Completed diff comparison for 14 matching files
```

**PR 討論串結果示意**：
```
🤖 AI Code Review (Google - gemini-2.5-flash)

AI Review Status: 🟡 Needs Human Review
新增 DevOps 查詢功能，整體結構清晰，但部分錯誤處理需加強。

---

### /Ap/.../DownloadDevOpsExcelCommand.cs
- 🔴 [Reliability]: `result.Items` 未檢查 null，可能引發 NullReferenceException
- ⚠️ [Convention]: `PageSize = int.MaxValue` 建議限制最大筆數避免 OOM

### /Lib/.../DevopsApi.cs
- ⚠️ [Robustness]: WIQL 日期格式硬編碼，未考慮 locale 差異
```

#### 實際執行結果（2026-04-03）
- **執行狀態**：✅ 成功（Comment ID: 464）
- **AI 回應摘要**：❗ Needs Human Review — 小心 null/response 驗證與回傳 Content-Type；涵蓋 14 個檔案，重點指出 result.Items null 未檢查、PageSize=int.MaxValue 記憶體風險、回傳 MIME type 不正確、批次查詢靜默略過失敗批次
- **issues 數量**：N/A（摘要模式，無行內評論）
- **執行日誌片段**：
  ```
  📍 Full Diff Mode: Reviewing all PR changes from base branch
  + Throttle Mode: Enabled (diff only)
  ✅ Completed diff comparison for 14 matching files
  ⏱️ GitHub Copilot response completed in 47.58 seconds
  📊 Token Usage - Output: 931 (估算)
  ✅ Successfully added comment, ID: 464
  🎉 AI Pull Request Code Review completed successfully!
  ```
#### 實際執行結果（2026-04-04）
- **執行狀態**：✅ 成功（Comment ID: 677）
- **AI 回應摘要**：⚠️ Needs Human Review — 7 個 warning（result.Items、summaryData、WorkItemTypes/States null reference 等）、5+ 個 suggestion
- **issues 數量**：N/A（摘要模式，無行內評論）
- **執行日誌片段**：
  ```
  + Throttle Mode: Enabled (diff only)
  ⏱️ 回應完成，耗時 61.98 秒
  📊 Token 使用量 - 輸出：900
  ✅ Successfully added comment, ID: 677
  🎉 AI Pull Request Code Review completed successfully!
  ```
---

### 場景二：增量 Diff 摘要評論（節省 token）

```properties
EnableThrottleMode=true
EnableIncrementalDiff=true
EnableInlineComments=false
```

**日誌輸出差異**（與場景一相比）：
```
📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
       (comparing iteration 3 against iteration 2)
ℹ️ Only changes from the latest push will be included
✅ Completed diff comparison for 3 matching files   ← 比場景一少
```

**PR 討論串結果**：格式與場景一相同，但只涵蓋最新 push 的檔案。

#### 實際執行結果（2026-04-03）
- **執行狀態**：✅ 成功（Comment ID: 465）
- **AI 回應摘要**：❗ Needs Human Review — 多項新增功能/例外處理需確認細節與相依性；本次實際審查 14 個檔案（與場景一相同），Azure DevOps Incremental Diff 以 iteration 為基礎，若所有檔案均在最新 iteration 中則效果等同全 PR
- **issues 數量**：N/A（摘要模式，無行內評論）
- **執行日誌片段**：
  ```
  ⏱️ GitHub Copilot response completed in 83.13 seconds
  📊 Token Usage - Output: 902 (估算)
  ✅ Successfully added comment, ID: 465
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### 實際執行結果（2026-04-04）
- **執行狀態**：✅ 成功（Comment ID: 678）
- **AI 回應摘要**：⚠️ Needs Human Review — 6 個 warning、5 個 suggestion、3 個 convention
- **issues 數量**：N/A（摘要模式，無行內評論）
- **執行日誌片段**：
  ```
  + Throttle Mode: Enabled (diff only)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ 回應完成，耗時 68.67 秒
  📊 Token 使用量 - 輸出：771
  ✅ Successfully added comment, ID: 678
  🎉 AI Pull Request Code Review completed successfully!
  ```

---

### 場景三：行內評論 × 同檔合併 × 僅 Critical+Warning

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=true
InlineStrictMode=false
```

**日誌輸出**：
```
📝 Inline comment mode: JSON format requirement appended (strictMode=false)
✅ Posted 7/7 inline comments (covering 9 issue(s), groupByFile=true)
✅ Summary comment posted
```

**Files Changed 頁籤（同檔案問題合併後）**：
```
📌 DownloadDevOpsExcelCommand.cs : 85
  🔴 [Reliability] result.Items 未檢查 null，可能引發 NullReferenceException
  建議: 在 Select 前先驗證 result.Items 不為 null

  ⚠️ [Convention] PageSize = int.MaxValue 建議限制最大筆數
```

**PR 討論串摘要評論**：
```
🤖 AI Code Review (GitHubCopilot - gpt-5-mini)

**🟡 Needs Human Review**
新增 DevOps 查詢/下載功能，部分 null 檢查缺失與錯誤處理需加強

| 🔴 Critical | ⚠️ Warning |
|:-----------:|:----------:|
| 3 | 6 |

_Inline comments posted for 9 issue(s) across 7 file(s) — check the Files Changed tab._
```

#### 實際執行結果（2026-04-03）
- **執行狀態**：✅ 成功
- **AI 回應摘要**：🟡 Needs Human Review — 新增 DevOps 匯出/篩選與錯誤處理，需檢查 Null/邊界與輸出內容；4 critical + 9 warning（共 13 issues）
- **issues 數量**：13 issues，合併後發佈 11/11 則行內評論（groupByFile=true）
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Full Diff Mode: Reviewing all PR changes from base branch
  ✅ Completed diff comparison for 14 matching files
  ⏱️ GitHub Copilot response completed in 51.69 seconds
  📊 Token Usage - Output: 1085 (估算)
  ✅ Posted 11/11 inline comments (covering 13 issue(s), groupByFile=true)
  ✅ Summary comment posted
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### 實際執行結果（2026-04-04）
- **執行狀態**：✅ 成功（Comment ID: 689）
- **AI 回應摘要**：⚠️ Needs Human Review — 4 個問題合併為 3 則檔案層級行內評論；NullReference 與 Performance warning
- **issues 數量**：4 issues，發佈 3/3 則行內評論（groupByFile=true）
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ 回應完成，耗時 97.67 秒
  📊 Token 使用量 - 輸出：517
  ✅ Posted 3/3 inline comments (covering 4 issue(s), groupByFile=true)
  ✅ Successfully added comment, ID: 689
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **問題列表**：`DownloadDevOpsExcelCommand.cs` lines 85–96 NullReference（warning）、`GetDevOpsWorkItemSummaryQuery.cs` lines 51–75 NullReference（warning）、`DownloadDevOpsExcelCommand.cs` lines 54–56 Performance（warning）、`DevOpsController.cs` lines 78–79 Compatibility（warning）

---

### 場景四：行內評論 × 每問題獨立 × 僅 Critical+Warning（預設配置）

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=false
InlineStrictMode=false
```

**日誌輸出**（實際 debug 執行結果）：
```
🚀 Starting AI Pull Request Code Review Task... (Debug Mode: ON)
📝 Inline comment mode: JSON format requirement appended (strictMode=false)
📍 Full Diff Mode: Reviewing all PR changes from base branch
🔍 Total changed files: 16, after filtering, 14 file changes remaining
✅ Completed diff comparison for 14 matching files
⏳ Generating response using GitHub Copilot...
⏱️ GitHub Copilot response completed in 37.45 seconds
📌 Inline comment mode: parsing JSON response...
✅ Posted 9/9 inline comments (covering 9 issue(s), groupByFile=false)
✅ Summary comment posted
🎉 AI Pull Request Code Review completed successfully!
```

**AI 回傳 JSON 格式範例**（實際輸出，經整理）：
```json
{
  "summary": {
    "status": "🟡 Needs Human Review",
    "conclusion": "新增 DevOps 查詢/下載功能，部分 null 檢查缺失與錯誤處理需加強"
  },
  "issues": [
    {
      "file": "/Ap/PrimeEagleX.Application/Commands/DevOps/DownloadDevOpsExcelCommand.cs",
      "lineStart": 85,
      "lineEnd": 96,
      "severity": "critical",
      "category": "Reliability",
      "description": "result.Items 未檢查 null，直接呼叫 Select 可能引發 NullReferenceException",
      "suggestion": "在 Select 前先驗證 result.Items 不為 null，或改用 null-conditional operator"
    },
    {
      "file": "/Ap/PrimeEagleX.Application/Commands/DevOps/GetDevOpsWorkItemListCommand.cs",
      "lineStart": 49,
      "lineEnd": 61,
      "severity": "critical",
      "category": "Reliability",
      "description": "try/catch 後拋出 CusException，但錯誤訊息直接暴露內部異常細節",
      "suggestion": "統一 CusException 的錯誤碼格式，避免在生產環境暴露 ex.Message"
    },
    {
      "file": "/Lib/PrimeEagleX.Lib.DevOps/DevopsApi.cs",
      "lineStart": 387,
      "lineEnd": 391,
      "severity": "warning",
      "category": "Correctness",
      "description": "ClosedDate 日期過濾條件僅做 yyyy-MM-dd 格式轉換，未考慮時區差異"
    }
  ]
}
```

**Files Changed 頁籤（每問題獨立一則）**：
```
📌 DownloadDevOpsExcelCommand.cs : 85-96
  🔴 [Reliability] result.Items 未檢查 null，直接呼叫 Select 可能引發 NullReferenceException
  建議: 在 Select 前先驗證 result.Items 不為 null

📌 GetDevOpsWorkItemListCommand.cs : 49-61
  🔴 [Reliability] try/catch 後拋出 CusException，錯誤訊息暴露內部異常細節

📌 DevopsApi.cs : 387-391
  ⚠️ [Correctness] ClosedDate 日期過濾未考慮時區差異

... (共 9 則)
```

**PR 討論串摘要評論**：
```
🤖 AI Code Review (GitHubCopilot - gpt-5-mini)

**🟡 Needs Human Review**
新增 DevOps 查詢/下載功能，部分 null 檢查缺失與錯誤處理需加強

| 🔴 Critical | ⚠️ Warning |
|:-----------:|:----------:|
| 3 | 6 |

_Inline comments posted for 9 issue(s) across 9 file(s) — check the Files Changed tab._
```

#### 實際執行結果（2026-04-03）
- **執行狀態**：✅ 成功（Comment ID: 481）
- **AI 回應摘要**：🟡 Needs Human Review；本次 AI 只回報 3 issues（相比場景三的 13 issues 明顯減少），反映 AI 輸出的隨機性——`groupByFile` 本身不影響 AI 回報問題數量，但本次 Token 用量僅 293，顯示 AI 自行精簡了回應
- **issues 數量**：3 issues，發佈 3/3 則行內評論（groupByFile=false）
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Full Diff Mode: Reviewing all PR changes from base branch
  ✅ Completed diff comparison for 14 matching files
  📊 Token Usage - Output: 293 (估算)
  ✅ Posted 3/3 inline comments (covering 3 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 481
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### 實際執行結果（2026-04-04）
- **執行狀態**：✅ 成功（Comment ID: 685）
- **AI 回應摘要**：⚠️ Needs Human Review — 6 個 warning 級別問題（Performance 與 API 類別），全部 6 則行內評論成功發佈
- **issues 數量**：6 issues，發佈 6/6 則行內評論（groupByFile=false）
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ 回應完成，耗時 114.11 秒
  📊 Token 使用量 - 輸出：626
  ✅ Posted 6/6 inline comments (covering 6 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 685
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **問題列表**：`DownloadDevOpsExcelCommand.cs:55` Performance（warning）、`GetDevOpsWorkItemSummaryQuery.cs:46` Performance（warning）、`DevOpsController.cs:79` API（warning）、`DevOpsController.cs:103` API（warning）、`DevOpsCommandTest.cs:426` Testing（warning）、`DevOpsCommandTest.cs:443` Testing（warning）

---

### 場景五：行內評論 × 同檔合併 × 含 Suggestion

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=true
InlineStrictMode=true
```

**日誌輸出差異**：
```
📝 Inline comment mode: JSON format requirement appended (strictMode=true)
✅ Posted 7/7 inline comments (covering 14 issue(s), groupByFile=true)
```

**PR 討論串摘要評論（含 Suggestion 欄）**：
```
**🟡 Needs Human Review**
...

| 🔴 Critical | ⚠️ Warning | 💡 Suggestion |
|:-----------:|:----------:|:-------------:|
| 3 | 6 | 5 |

_Inline comments posted for 14 issue(s) across 7 file(s) — check the Files Changed tab._
```

#### 實際執行結果（2026-04-03）
- **執行狀態**：✅ 成功（Comment ID: 483）
- **AI 回應摘要**：🟡 Needs Human Review — DevopsApi 批次查詢未回傳結果，可能導致執行時例外；AI 本次聚焦在 1 個最關鍵的 critical bug，回應極為精簡
- **issues 數量**：1 issue（即使 StrictMode=true 應包含 suggestion，AI 仍只回報 1 critical），發佈 1/1 則行內評論（groupByFile=true）
- **⚠️ 觀察**：StrictMode=true 擴充了可回報範圍，但 AI 不一定會產出更多 issues；Token 用量僅 124，顯著低於其他場景
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  ⏱️ GitHub Copilot response completed in ~37 seconds
  📊 Token Usage - Output: 124 (估算)
  ✅ Posted 1/1 inline comments (covering 1 issue(s), groupByFile=true)
  ✅ Successfully added comment, ID: 483
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### 實際執行結果（2026-04-04）
- **執行狀態**：✅ 成功（Comment ID: 702）
- **AI 回應摘要**：❌ 建議拒絕合併 — 發現 critical 等級測試問題；6 個問題（1 critical、2 warning、3 suggestion）合併為 5 則行內評論
- **issues 數量**：6 issues，發佈 5/5 則行內評論（groupByFile=true）
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ 回應完成，耗時 117.32 秒
  📊 Token 使用量 - 輸出：731
  ✅ Posted 5/5 inline comments (covering 6 issue(s), groupByFile=true)
  ✅ Successfully added comment, ID: 702
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **問題列表**：`DevOpsCommandTest.cs:424-426` critical（Tests）、`DownloadDevOpsExcelCommand.cs:55` warning（Performance）、`GetDevOpsOrganizationsQuery.cs:39-50` suggestion（NullReference）、`DevopsApi.cs:477-495` warning（Logic）、`DevOpsController.cs:79` suggestion（API）、`DownloadDevOpsExcelCommand.cs:65-72` suggestion（ErrorHandling）

---

### 場景六：行內評論 × 每問題獨立 × 含 Suggestion（最詳細）

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=false
InlineStrictMode=true
```

**日誌輸出**：
```
📝 Inline comment mode: JSON format requirement appended (strictMode=true)
✅ Posted 14/14 inline comments (covering 14 issue(s), groupByFile=false)
```

> 若 issue 超過 20 則（上限），多餘的會在摘要說明，不會默默捨棄：
> ```
> ℹ️ 3 issue(s) were omitted (exceeded 20 inline comment limit) — noted in summary comment
> _Note: 3 additional issue(s) exceeded the 20 inline comment limit and were omitted._
> ```

#### 實際執行結果（2026-04-03）
- **執行狀態**：✅ 成功（Comment ID: 488）
- **AI 回應摘要**：🟡 Needs Human Review — 部分處理未驗證 null，可能導致 NullReference 或異常；2 critical（result.Items null 未防護）+ 2 warning（request.Model null、CusException 未保留 InnerException）
- **issues 數量**：4 issues（即使 StrictMode=true，AI 只回報 critical+warning，未見 suggestion 級別），發佈 4/4 則行內評論（groupByFile=false）
- **⚠️ 觀察**：StrictMode=true 的系統提示允許 severity="suggestion"，但本次 AI 選擇不包含，代表 StrictMode 只是擴充允許範圍，不強制 AI 輸出 suggestion
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  ⏱️ GitHub Copilot response completed in 37.01 seconds
  📊 Token Usage - Output: 487 (估算)
  ✅ Posted 4/4 inline comments (covering 4 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 488
  🎉 AI Pull Request Code Review completed successfully!
  ```
#### 實際執行結果（2026-04-04）
- **執行狀態**：✅ 成功（Comment ID: 696）
- **AI 回應摘要**：⚠️ Needs Human Review — 6 個問題（2 warning、4 suggestion），涵蓋 Robustness、Convention、Testing 等面向，全部 6 則行內評論成功發佈
- **issues 數量**：6 issues，發佈 6/6 則行內評論（groupByFile=false）
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ 回應完成，耗時 87.59 秒
  📊 Token 使用量 - 輸出：757
  ✅ Posted 6/6 inline comments (covering 6 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 696
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **問題列表**：`DownloadDevOpsExcelCommand.cs:55` suggestion（Performance）、`DownloadDevOpsExcelCommand.cs:85-94` warning（Robustness）、`DevopsApi.cs:477-486` suggestion（Reliability）、`DevOpsController.cs:78-79` suggestion（Convention）、`DevOpsCommandTest.cs:424-426` warning（Testing）、`GetDevOpsOrganizationsQuery.cs:38-50` suggestion（Robustness）
---

### 場景七：增量 Diff × 行內評論 × 每問題獨立

```properties
EnableThrottleMode=true
EnableIncrementalDiff=true
EnableInlineComments=true
GroupInlineCommentsByFile=false
InlineStrictMode=false
```

**日誌輸出**：
```
📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
📝 Inline comment mode: JSON format requirement appended (strictMode=false)
✅ Posted 4/4 inline comments (covering 4 issue(s), groupByFile=false)
```

> ⚠️ **注意（Azure DevOps）**：行內評論的 `iterationContext` 固定使用 `firstComparingIteration=1`（全量 diff 視圖），即使使用增量 diff 模式審查，評論仍正確顯示在 Files Changed 頁籤的最終版本行號上。

#### 實際執行結果（2026-04-03）
- **執行狀態**：✅ 成功（Comment ID: 493）
- **AI 回應摘要**：🟡 Needs Human Review；本次審查使用 IncrementalDiff=true，Azure DevOps 應只比對最新 iteration 的變更，但因 terminal 截斷無法確認具體過濾了幾個檔案
- **issues 數量**：4 issues（含 critical/warning，因 terminal 截斷僅看到最後 2 個 warning issue），發佈 4/4 則行內評論（groupByFile=false）
- **執行日誌片段**：
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📊 Token Usage - Output: 368 (估算)
  ✅ Posted 4/4 inline comments (covering 4 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 493
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### 實際執行結果（2026-04-04）
- **備註**：本場景於 2026-04-04 未單獨執行。最相近的對應為**場景四** 2026-04-04 的執行結果（EnableThrottleMode=true、**EnableIncrementalDiff=true**、EnableInlineComments=true、GroupByFile=false、StrictMode=false），兩者共享相同的 IncrementalDiff=true + 每問題獨立行內評論配置，可參考場景四的 2026-04-04 結果（Comment ID: 685）。

---

### 場景八：完整檔案摘要審查（最大上下文）

```properties
EnableThrottleMode=false
EnableIncrementalDiff=false
EnableInlineComments=false
```

**日誌輸出**：
```
+ Throttle Mode: Disabled (full content)
✅ Retrieved full content for 14 matching files
```

**PR 討論串結果**：格式與場景一相同，但 AI 看到的是完整程式碼而非 diff，上下文最充分。

#### 實際執行結果（2026-04-03）
- **執行狀態**：❌ 失敗（GitHub Copilot SDK Timeout）
- **AI 回應摘要**：N/A（逾時前無回應）
- **issues 數量**：N/A
- **⚠️ 重要發現**：`EnableThrottleMode=false` 會將所有 14 個變更檔案的**完整內容**送給 AI，prompt 過大導致 GitHub Copilot SDK 在 120 秒後回應逾時。建議此模式僅在檔案數量少、變更規模小時使用，或配合 `FileExtensions` 嚴格過濾檔案數量。
- **執行日誌片段**：
  ```
  + Throttle Mode: Disabled (full content)
  ⏳ Sending request to GitHub Copilot (timeout: 120000ms)...
  📨 Receiving streamed response...
  😡 Task failed with error: ⛔ GitHub Copilot SDK error: Timeout after 120000ms waiting for session.idle
  ##vso[task.complete result=Failed;]Task failed with error: ⛔ GitHub Copilot SDK error: Timeout after 120000ms waiting for session.idle
  ```

#### 實際執行結果（2026-04-04）
- **執行狀態**：✅ 成功（Comment ID: 676）
- **AI 回應摘要**：❌ 建議拒絕合併 — `GetProjectsAsync` 使用 `return []`（C#13 語法錯誤）；`GetFileAsync` URL 分隔符 `&` 應為 `?`；2 Critical、2 Warning、多個 Suggestion
- **issues 數量**：N/A（摘要模式，無行內評論）
- **⚠️ 注意**：task.json 中的 timeout 已從 120000ms 更新為 300000ms，本次在延長後的 timeout 限制內成功完成（耗時 94.44 秒）
- **執行日誌片段**：
  ```
  + Throttle Mode: Disabled (full content)
  ⏳ Sending request to GitHub Copilot (timeout: 300000ms)...
  ⏱️ 回應完成，耗時 94.44 秒
  📊 Token 使用量 - 輸出：696
  ✅ Successfully added comment, ID: 676
  🎉 AI Pull Request Code Review completed successfully!
  ```

---

## 6. 完整排列組合矩陣

### 6.1 `enableThrottleMode` × `enableIncrementalDiff`

| throttle | incremental | Azure DevOps 行為 | GitHub 行為 |
|:--------:|:-----------:|:-----------------|:-----------|
| `true` | `false` | 全 PR diff（所有 iterations 與 base branch 的差異） | 全 PR patch（所有檔案） |
| `true` | `true` | **只有最新 push 的 diff**（最新 iteration vs 前一 iteration） | 全 PR patch（GitHub 無 iteration 概念，等同 false） |
| `false` | `false` | 全 PR 變更檔案完整內容 | 全 PR 變更檔案完整內容 |
| `false` | `true` | **最新 push 的檔案**清單 + 完整內容（仍會過濾檔案範圍） | 全 PR 變更檔案完整內容（等同 false, false） |

### 6.2 `enableInlineComments` × `groupInlineCommentsByFile` × `inlineStrictMode`

| inline | groupByFile | strictMode | 行內評論數 | 嚴重程度 | 摘要統計表 |
|:------:|:-----------:|:----------:|:--------:|:--------:|:----------:|
| `false` | 無作用 | 無作用 | 0 則 | 不限制 | 無 |
| `true` | `true` | `false` | ≤ 依檔案數 | critical + warning | 2 欄（C/W） |
| `true` | `true` | `true` | ≤ 依檔案數 | critical + warning + suggestion | 3 欄（C/W/S） |
| `true` | `false` | `false` | ≤ 20 則 | critical + warning | 2 欄（C/W） |
| `true` | `false` | `true` | ≤ 20 則 | critical + warning + suggestion | 3 欄（C/W/S） |

> **行內評論上限**：最多 20 則（以 issue 數計）。超過時，超出部分在摘要評論中標注，不會默默捨棄。

### 6.3 完整 8 場景 × 5 參數一覽

| 場景 | throttle | incremental | inline | groupByFile | strictMode | 特點 |
|:----:|:--------:|:-----------:|:------:|:-----------:|:----------:|------|
| 一 | `true` | `false` | `false` | — | — | 摘要模式，全 PR diff |
| 二 | `true` | `true` | `false` | — | — | 只審最新 push，節省 token |
| 三 | `true` | `false` | `true` | `true` | `false` | 行內合併，輕量 |
| **四** | **`true`** | **`false`** | **`true`** | **`false`** | **`false`** | **預設 — 每問題獨立行內評論** |
| 五 | `true` | `false` | `true` | `true` | `true` | 行內合併，含建議 |
| 六 | `true` | `false` | `true` | `false` | `true` | 每問題獨立，最詳細 |
| 七 | `true` | `true` | `true` | `false` | `false` | 增量 + 行號，最省 token |
| 八 | `false` | `false` | `false` | — | — | 完整內容，最大上下文 |

---

## 7. 建議配置快速選擇指南

```
你的需求是？
│
├─ 只需要「整體摘要」審查？
│   ├─ 第一次審（全量）？ → 場景一
│   └─ PR 已多次 push，只想看新改動？ → 場景二
│
├─ 需要「精準行號標註」到 Files Changed？
│   ├─ 問題數量少，希望同檔案合併？ → 場景三
│   ├─ 希望每個問題有各自精確行號？ → 場景四 ← 預設配置
│   ├─ 希望包含 suggestion 建議？
│   │   ├─ 同檔合併版 → 場景五
│   │   └─ 各自獨立版 → 場景六
│   └─ PR 仍在迭代中，只審最新 push + 行號？ → 場景七
│
└─ AI 需要完整檔案上下文（非 diff）？
    └─ 場景八（token 消耗最高）
```

### 互斥設定快速參考

```
GitHub Copilot 認證（三選一，不可混用）：
  ✅ githubToken 填寫      → Token 模式
  ✅ serverAddress 填寫    → 遠端 CLI Server 模式
  ✅ 兩者都留空            → 本機 CLI 模式
  ❌ 兩者都填寫            → 程式拋出錯誤！

行內評論依賴（需先啟用 enableInlineComments）：
  enableInlineComments=false → groupInlineCommentsByFile / inlineStrictMode 無作用
  enableInlineComments=true  → 以上兩個才生效，並自動附加 JSON 格式指令

增量 Diff 跨平台差異：
  enableThrottleMode=false + enableIncrementalDiff=true（Azure DevOps）
    → 仍過濾至最新 push 的檔案清單，但送完整內容（≠ false, false）
  enableThrottleMode=false + enableIncrementalDiff=true（GitHub）
    → 等同 false, false（GitHub API 無 iteration 概念）
```
