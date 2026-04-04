# AI PR AutoReview — Review Mode Parameter Combinations

This document focuses on parameters that affect review behavior. For AI model selection, DevOps connection settings, system prompts, and other non-review parameters, refer to README.md.

This document explains the dependencies and mutual exclusions between parameters, and the actual behavior under different combinations.

---

## Table of Contents

1. [Parameter Overview](#1-parameter-overview)
2. [Mutually Exclusive Parameters (Cannot Be Set Together)](#2-mutually-exclusive-parameters-cannot-be-set-together)
3. [Conditional Parameters (Depend on Other Parameters)](#3-conditional-parameters-depend-on-other-parameters)
4. [Diff Format and Line Annotation Mechanism](#4-diff-format-and-line-annotation-mechanism)
5. [All Review Mode Scenarios](#5-all-review-mode-scenarios)
6. [Complete Parameter Combination Matrix](#6-complete-parameter-combination-matrix)
7. [Recommended Configuration Quick-Select Guide](#7-recommended-configuration-quick-select-guide)

---

## 1. Parameter Overview

### Review Content Control

| Parameter | Default | Description |
|-----------|:-------:|-------------|
| `enableThrottleMode` | `true` | `true`: Send diff only; `false`: Send full file content |
| `enableIncrementalDiff` | `true` | `true`: Review only changes from the latest push; `false`: Review all PR changes (UI visible only when throttle=true) (Azure DevOps Only) |

### Comment Publishing Mode

| Parameter | Default | Description |
|-----------|:-------:|-------------|
| `enableInlineComments` | `true` | `true`: Precise line-annotated inline comments; `false`: Single summary comment |
| `groupInlineCommentsByFile` | `false` | Group issues from the same file (**UI visible only when enableInlineComments=true**) |
| `inlineStrictMode` | `false` | Whether to report suggestion-level issues (**UI visible only when enableInlineComments=true**) |
| `showReviewContent` | `true` | `true`: Display the content sent to AI in a collapsible section within the review comment; `false`: Hide it |

### AI Response Control

| Parameter | Default | Description |
|-----------|:-------:|-------------|
| `maxOutputTokens` | (unset) | Maximum number of output tokens for the AI response. Leave empty to use the model's default limit. |
| `temperature` | `0.2` | AI sampling temperature (0.0–1.0); lower values produce more deterministic output |
| `responseLanguage` | `Taiwanese (zh-TW)` | Language for the AI review response |

### System Instruction

| Parameter | Default | Description |
|-----------|:-------:|-------------|
| `systemInstructionSource` | `Built-in` | Source of system instructions: `Built-in` (default built-in prompt), `Inline` (user-provided inline text), `File` (load from a file path) |

### File Filtering

| Parameter | Default | Description |
|-----------|:-------:|-------------|
| `fileExtensions` | Empty (all) | Comma-separated whitelist of file extensions; only files matching these extensions are reviewed (e.g., `.ts,.cs,.py`). Empty value means all non-binary files are reviewed |
| `binaryExtensions` | Empty (uses built-in list) | Comma-separated blacklist of binary file extensions to forcibly exclude. Empty value uses the built-in default list (.jpg, .png, .pdf, .zip, etc.) |

---

## 2. Mutually Exclusive Parameters (Cannot Be Set Together)

### GitHub Copilot Authentication — Choose One of Three

> **Rule**: `githubToken` and `serverAddress` **cannot both be filled in**; doing so throws a `⛔ Error`

| Mode | githubToken | serverAddress | copilotCliPath | Description |
|------|:-----------:|:-------------:|:--------------:|-------------|
| **Token Mode** | ✅ Filled | ❌ Empty | Optional | Cloud CI, authenticates via GitHub API |
| **Remote CLI Server** | ❌ Empty | ✅ Filled | Optional | Connects to an internal network Copilot CLI Server |
| **Local CLI** | ❌ Empty | ❌ Empty | Optional | Uses the Build Agent's local CLI |

> ❗ Both `githubToken` and `serverAddress` left empty → local CLI mode is used automatically

---

## 3. Conditional Parameters (Depend on Other Parameters)

```
enableThrottleMode = true
  └─ enableIncrementalDiff is active (shown in UI)
       ├─ true: Review only the diff from the latest push (Azure DevOps applies actual filtering; GitHub has limited effect)
       └─ false: Review the full diff of all PR changes

enableThrottleMode = false (UI hides enableIncrementalDiff)
  └─ enableIncrementalDiff=true (Azure DevOps): Still filters file list to the latest push, but sends full content
  └─ enableIncrementalDiff=true (GitHub): Equivalent to false (full PR content)

enableInlineComments = false (UI hides groupByFile and strictMode)
  └─ Posts a single summary comment to the PR discussion thread

enableInlineComments = true (UI shows groupByFile and strictMode)
  └─ groupInlineCommentsByFile
       ├─ true: All issues in the same file are merged into one inline comment
       └─ false: Each issue gets its own inline comment (more precise line anchoring)
  └─ inlineStrictMode
       ├─ true: AI reports critical + warning + suggestion
       └─ false: AI reports only critical + warning (default, less noise)
  └─ systemInstruction: Content is [preserved], with JSON format instructions automatically appended at the end
```

---

## 4. Diff Format and Line Annotation Mechanism

When `enableThrottleMode=true`, the program uses `git diff --no-index` to compare old and new versions, then processes the output through `processDiffOutput` into a format with line number annotations.

### Example diff format sent to AI (actual debug output)

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

### Line number annotation rules

| Prefix | Description |
|--------|-------------|
| `+[LN]` | Added line, where `N` is the actual line number in the **new version of the file** (AI uses this to determine lineStart/lineEnd) |
| `-content` | Deleted line (shows old content, no line number) |
| `@@` | Hunk header, indicates the starting line number of this hunk in the new file |
| ` ` (space) | Context line: not included in output, but correctly counted for line number offset |

> **Important**: Context lines (lines unchanged between old and new versions) do not appear in the diff sent to the AI, but line numbers are still calculated correctly, ensuring `+[LN]` always corresponds to the actual line number in the new version.

---

## 5. All Review Mode Scenarios

### Scenario 1: Full Diff Summary Comment (Summary Mode)

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=false
```

**Log output**:
```
📍 Full Diff Mode: Reviewing all PR changes from base branch
+ Throttle Mode: Enabled (diff only)
✅ Completed diff comparison for 14 matching files
```

**PR discussion thread result example**:
```
🤖 AI Code Review (Google - gemini-2.5-flash)

AI Review Status: 🟡 Needs Human Review
Added DevOps query functionality. Overall structure is clear, but some error handling needs improvement.

---

### /Ap/.../DownloadDevOpsExcelCommand.cs
- 🔴 [Reliability]: `result.Items` is not null-checked, potentially causing NullReferenceException
- ⚠️ [Convention]: `PageSize = int.MaxValue` — recommend limiting the maximum count to avoid OOM

### /Lib/.../DevopsApi.cs
- ⚠️ [Robustness]: WIQL date format is hardcoded, without considering locale differences
```

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ✅ Success (Comment ID: 464)
- **AI Response Summary**: ❗ Needs Human Review — beware of null/response validation and returned Content-Type; covered 14 files, highlighting result.Items null not checked, PageSize=int.MaxValue memory risk, incorrect return MIME type, batch queries silently skipping failed batches
- **Issue Count**: N/A (summary mode, no inline comments)
- **Execution Log Excerpt**:
  ```
  📍 Full Diff Mode: Reviewing all PR changes from base branch
  + Throttle Mode: Enabled (diff only)
  ✅ Completed diff comparison for 14 matching files
  ⏱️ GitHub Copilot response completed in 47.58 seconds
  📊 Token Usage - Output: 931 (estimated)
  ✅ Successfully added comment, ID: 464
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### Actual Execution Results (2026-04-04)
- **Execution Status**: ✅ Success (Comment ID: 677)
- **AI Response Summary**: ⚠️ Needs Human Review — 7 warnings (result.Items, summaryData, WorkItemTypes/States null reference, etc.), 5+ suggestions
- **Issue Count**: N/A (summary mode, no inline comments)
- **Execution Log Excerpt**:
  ```
  + Throttle Mode: Enabled (diff only)
  ⏱️ Response completed in 61.98 seconds
  📊 Token Usage - Output: 900
  ✅ Successfully added comment, ID: 677
  🎉 AI Pull Request Code Review completed successfully!
  ```

---

### Scenario 2: Incremental Diff Summary Comment (Token-Efficient)

```properties
EnableThrottleMode=true
EnableIncrementalDiff=true
EnableInlineComments=false
```

**Log output difference** (compared to Scenario 1):
```
📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
       (comparing iteration 3 against iteration 2)
ℹ️ Only changes from the latest push will be included
✅ Completed diff comparison for 3 matching files   ← fewer than Scenario 1
```

**PR discussion thread result**: Same format as Scenario 1, but only covers files from the latest push.

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ✅ Success (Comment ID: 465)
- **AI Response Summary**: ❗ Needs Human Review — multiple new features/exception handling need detail and dependency verification; this run actually reviewed 14 files (same as Scenario 1) — Azure DevOps Incremental Diff is iteration-based, so if all files are in the latest iteration, the result is equivalent to the full PR
- **Issue Count**: N/A (summary mode, no inline comments)
- **Execution Log Excerpt**:
  ```
  ⏱️ GitHub Copilot response completed in 83.13 seconds
  📊 Token Usage - Output: 902 (estimated)
  ✅ Successfully added comment, ID: 465
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### Actual Execution Results (2026-04-04)
- **Execution Status**: ✅ Success (Comment ID: 678)
- **AI Response Summary**: ⚠️ Needs Human Review — 6 warnings, 5 suggestions, 3 conventions
- **Issue Count**: N/A (summary mode, no inline comments)
- **Execution Log Excerpt**:
  ```
  + Throttle Mode: Enabled (diff only)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ Response completed in 68.67 seconds
  📊 Token Usage - Output: 771
  ✅ Successfully added comment, ID: 678
  🎉 AI Pull Request Code Review completed successfully!
  ```

---

### Scenario 3: Inline Comments × Group by File × Critical+Warning Only

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=true
InlineStrictMode=false
```

**Log output**:
```
📝 Inline comment mode: JSON format requirement appended (strictMode=false)
✅ Posted 7/7 inline comments (covering 9 issue(s), groupByFile=true)
✅ Summary comment posted
```

**Files Changed tab (issues per file merged)**:
```
📌 DownloadDevOpsExcelCommand.cs : 85
  🔴 [Reliability] result.Items not null-checked, may cause NullReferenceException
  Suggestion: Validate result.Items is not null before calling Select

  ⚠️ [Convention] PageSize = int.MaxValue — recommend limiting maximum count
```

**PR discussion thread summary comment**:
```
🤖 AI Code Review (GitHubCopilot - gpt-5-mini)

**🟡 Needs Human Review**
Added DevOps query/download functionality; some null checks are missing and error handling needs improvement

| 🔴 Critical | ⚠️ Warning |
|:-----------:|:----------:|
| 3 | 6 |

_Inline comments posted for 9 issue(s) across 7 file(s) — check the Files Changed tab._
```

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ✅ Success
- **AI Response Summary**: 🟡 Needs Human Review — new DevOps export/filter and error handling; null/boundary checks and output content need verification; 4 critical + 9 warning (13 issues total)
- **Issue Count**: 13 issues; 11/11 inline comments posted after grouping (groupByFile=true)
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Full Diff Mode: Reviewing all PR changes from base branch
  ✅ Completed diff comparison for 14 matching files
  ⏱️ GitHub Copilot response completed in 51.69 seconds
  📊 Token Usage - Output: 1085 (estimated)
  ✅ Posted 11/11 inline comments (covering 13 issue(s), groupByFile=true)
  ✅ Summary comment posted
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### Actual Execution Results (2026-04-04)
- **Execution Status**: ✅ Success (Comment ID: 689)
- **AI Response Summary**: ⚠️ Needs Human Review — 4 issues grouped into 3 file-level inline comments; NullReference and Performance warnings
- **Issue Count**: 4 issues; 3/3 inline comments posted (groupByFile=true)
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ Response completed in 97.67 seconds
  📊 Token Usage - Output: 517
  ✅ Posted 3/3 inline comments (covering 4 issue(s), groupByFile=true)
  ✅ Successfully added comment, ID: 689
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **Issues**: `DownloadDevOpsExcelCommand.cs` lines 85–96 NullReference (warning), `GetDevOpsWorkItemSummaryQuery.cs` lines 51–75 NullReference (warning), `DownloadDevOpsExcelCommand.cs` lines 54–56 Performance (warning), `DevOpsController.cs` lines 78–79 Compatibility (warning)

---

### Scenario 4: Inline Comments × Per-Issue × Critical+Warning Only (Default)

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=false
InlineStrictMode=false
```

**Log output** (actual debug execution result):
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

**AI response JSON format example** (actual output, reformatted):
```json
{
  "summary": {
    "status": "🟡 Needs Human Review",
    "conclusion": "Added DevOps query/download functionality; some null checks are missing and error handling needs improvement"
  },
  "issues": [
    {
      "file": "/Ap/PrimeEagleX.Application/Commands/DevOps/DownloadDevOpsExcelCommand.cs",
      "lineStart": 85,
      "lineEnd": 96,
      "severity": "critical",
      "category": "Reliability",
      "description": "result.Items is not null-checked; calling Select directly may cause NullReferenceException",
      "suggestion": "Validate result.Items is not null before calling Select, or use the null-conditional operator"
    },
    {
      "file": "/Ap/PrimeEagleX.Application/Commands/DevOps/GetDevOpsWorkItemListCommand.cs",
      "lineStart": 49,
      "lineEnd": 61,
      "severity": "critical",
      "category": "Reliability",
      "description": "After try/catch, CusException is thrown but the error message directly exposes internal exception details",
      "suggestion": "Standardize the CusException error code format to avoid exposing ex.Message in production"
    },
    {
      "file": "/Lib/PrimeEagleX.Lib.DevOps/DevopsApi.cs",
      "lineStart": 387,
      "lineEnd": 391,
      "severity": "warning",
      "category": "Correctness",
      "description": "The ClosedDate filter condition only converts to yyyy-MM-dd format without accounting for timezone differences"
    }
  ]
}
```

**Files Changed tab (one comment per issue)**:
```
📌 DownloadDevOpsExcelCommand.cs : 85-96
  🔴 [Reliability] result.Items is not null-checked; calling Select directly may cause NullReferenceException
  Suggestion: Validate result.Items is not null before calling Select

📌 GetDevOpsWorkItemListCommand.cs : 49-61
  🔴 [Reliability] CusException thrown after try/catch exposes internal exception details in the error message

📌 DevopsApi.cs : 387-391
  ⚠️ [Correctness] ClosedDate date filter does not account for timezone differences

... (9 total)
```

**PR discussion thread summary comment**:
```
🤖 AI Code Review (GitHubCopilot - gpt-5-mini)

**🟡 Needs Human Review**
Added DevOps query/download functionality; some null checks are missing and error handling needs improvement

| 🔴 Critical | ⚠️ Warning |
|:-----------:|:----------:|
| 3 | 6 |

_Inline comments posted for 9 issue(s) across 9 file(s) — check the Files Changed tab._
```

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ✅ Success (Comment ID: 481)
- **AI Response Summary**: 🟡 Needs Human Review; the AI only reported 3 issues this run (significantly fewer than the 13 in Scenario 3), reflecting the randomness of AI output — `groupByFile` itself does not affect the number of issues AI reports, but this run's token usage was only 293, indicating the AI self-condensed its response
- **Issue Count**: 3 issues; 3/3 inline comments posted (groupByFile=false)
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Full Diff Mode: Reviewing all PR changes from base branch
  ✅ Completed diff comparison for 14 matching files
  📊 Token Usage - Output: 293 (estimated)
  ✅ Posted 3/3 inline comments (covering 3 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 481
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### Actual Execution Results (2026-04-04)
- **Execution Status**: ✅ Success (Comment ID: 685)
- **AI Response Summary**: ⚠️ Needs Human Review — 6 warning-level issues (Performance and API categories); all 6 inline comments successfully posted
- **Issue Count**: 6 issues; 6/6 inline comments posted (groupByFile=false)
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ Response completed in 114.11 seconds
  📊 Token Usage - Output: 626
  ✅ Posted 6/6 inline comments (covering 6 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 685
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **Issues**: `DownloadDevOpsExcelCommand.cs:55` Performance (warning), `GetDevOpsWorkItemSummaryQuery.cs:46` Performance (warning), `DevOpsController.cs:79` API (warning), `DevOpsController.cs:103` API (warning), `DevOpsCommandTest.cs:426` Testing (warning), `DevOpsCommandTest.cs:443` Testing (warning)

---

### Scenario 5: Inline Comments × Group by File × Including Suggestions

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=true
InlineStrictMode=true
```

**Log output difference**:
```
📝 Inline comment mode: JSON format requirement appended (strictMode=true)
✅ Posted 7/7 inline comments (covering 14 issue(s), groupByFile=true)
```

**PR discussion thread summary comment (with Suggestion column)**:
```
**🟡 Needs Human Review**
...

| 🔴 Critical | ⚠️ Warning | 💡 Suggestion |
|:-----------:|:----------:|:-------------:|
| 3 | 6 | 5 |

_Inline comments posted for 14 issue(s) across 7 file(s) — check the Files Changed tab._
```

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ✅ Success (Comment ID: 483)
- **AI Response Summary**: 🟡 Needs Human Review — DevopsApi batch query may not return results, potentially causing a runtime exception; the AI focused on 1 most critical bug and produced an extremely concise response
- **Issue Count**: 1 issue (even with StrictMode=true, which should allow suggestions, the AI only reported 1 critical); 1/1 inline comment posted (groupByFile=true)
- **⚠️ Observation**: StrictMode=true expands the reportable range, but the AI does not necessarily produce more issues; token usage was only 124, significantly lower than other scenarios
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  ⏱️ GitHub Copilot response completed in ~37 seconds
  📊 Token Usage - Output: 124 (estimated)
  ✅ Posted 1/1 inline comments (covering 1 issue(s), groupByFile=true)
  ✅ Successfully added comment, ID: 483
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### Actual Execution Results (2026-04-04)
- **Execution Status**: ✅ Success (Comment ID: 702)
- **AI Response Summary**: ❌ Recommend Rejection — critical test coverage issue found; 6 issues (1 critical, 2 warning, 3 suggestion) grouped into 5 file-level inline comments
- **Issue Count**: 6 issues; 5/5 inline comments posted (groupByFile=true)
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ Response completed in 117.32 seconds
  📊 Token Usage - Output: 731
  ✅ Posted 5/5 inline comments (covering 6 issue(s), groupByFile=true)
  ✅ Successfully added comment, ID: 702
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **Issues**: `DevOpsCommandTest.cs:424-426` critical(Tests), `DownloadDevOpsExcelCommand.cs:55` warning(Performance), `GetDevOpsOrganizationsQuery.cs:39-50` suggestion(NullReference), `DevopsApi.cs:477-495` warning(Logic), `DevOpsController.cs:79` suggestion(API), `DownloadDevOpsExcelCommand.cs:65-72` suggestion(ErrorHandling)

---

### Scenario 6: Inline Comments × Per-Issue × Including Suggestions (Most Detailed)

```properties
EnableThrottleMode=true
EnableIncrementalDiff=false
EnableInlineComments=true
GroupInlineCommentsByFile=false
InlineStrictMode=true
```

**Log output**:
```
📝 Inline comment mode: JSON format requirement appended (strictMode=true)
✅ Posted 14/14 inline comments (covering 14 issue(s), groupByFile=false)
```

> If issues exceed 20 (the limit), excess issues are noted in the summary rather than silently discarded:
> ```
> ℹ️ 3 issue(s) were omitted (exceeded 20 inline comment limit) — noted in summary comment
> _Note: 3 additional issue(s) exceeded the 20 inline comment limit and were omitted._
> ```

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ✅ Success (Comment ID: 488)
- **AI Response Summary**: 🟡 Needs Human Review — some operations do not validate for null, potentially causing NullReference or exceptions; 2 critical (result.Items null not guarded) + 2 warning (request.Model null, CusException not preserving InnerException)
- **Issue Count**: 4 issues (even with StrictMode=true, the AI only reported critical+warning and no suggestion-level issues); 4/4 inline comments posted (groupByFile=false)
- **⚠️ Observation**: StrictMode=true allows severity="suggestion" in the system prompt, but the AI chose not to include any — StrictMode only expands the allowed range; it does not force the AI to output suggestions
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  ⏱️ GitHub Copilot response completed in 37.01 seconds
  📊 Token Usage - Output: 487 (estimated)
  ✅ Posted 4/4 inline comments (covering 4 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 488
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### Actual Execution Results (2026-04-04)
- **Execution Status**: ✅ Success (Comment ID: 696)
- **AI Response Summary**: ⚠️ Needs Human Review — 6 issues (2 warning, 4 suggestion) covering robustness, convention, and testing concerns; all 6 inline comments successfully posted
- **Issue Count**: 6 issues; 6/6 inline comments posted (groupByFile=false)
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=true)
  📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
  ⏱️ Response completed in 87.59 seconds
  📊 Token Usage - Output: 757
  ✅ Posted 6/6 inline comments (covering 6 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 696
  🎉 AI Pull Request Code Review completed successfully!
  ```
- **Issues**: `DownloadDevOpsExcelCommand.cs:55` suggestion(Performance), `DownloadDevOpsExcelCommand.cs:85-94` warning(Robustness), `DevopsApi.cs:477-486` suggestion(Reliability), `DevOpsController.cs:78-79` suggestion(Convention), `DevOpsCommandTest.cs:424-426` warning(Testing), `GetDevOpsOrganizationsQuery.cs:38-50` suggestion(Robustness)

---

### Scenario 7: Incremental Diff × Inline Comments × Per-Issue

```properties
EnableThrottleMode=true
EnableIncrementalDiff=true
EnableInlineComments=true
GroupInlineCommentsByFile=false
InlineStrictMode=false
```

**Log output**:
```
📍 Incremental Diff Mode: Enabled - Only reviewing changes from the latest push
📝 Inline comment mode: JSON format requirement appended (strictMode=false)
✅ Posted 4/4 inline comments (covering 4 issue(s), groupByFile=false)
```

> ⚠️ **Note (Azure DevOps)**: The inline comment `iterationContext` is fixed with `firstComparingIteration=1` (full diff view). Even when using incremental diff mode, comments are correctly displayed on the final version line numbers in the Files Changed tab.

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ✅ Success (Comment ID: 493)
- **AI Response Summary**: 🟡 Needs Human Review; this run used IncrementalDiff=true — Azure DevOps should only compare changes from the latest iteration, but the exact number of filtered files could not be confirmed due to terminal truncation
- **Issue Count**: 4 issues (including critical/warning; due to terminal truncation only the last 2 warning issues were visible); 4/4 inline comments posted (groupByFile=false)
- **Execution Log Excerpt**:
  ```
  📝 Inline comment mode: JSON format requirement appended (strictMode=false)
  📊 Token Usage - Output: 368 (estimated)
  ✅ Posted 4/4 inline comments (covering 4 issue(s), groupByFile=false)
  ✅ Successfully added comment, ID: 493
  🎉 AI Pull Request Code Review completed successfully!
  ```

#### Actual Execution Results (2026-04-04)
- **Note**: This scenario was not executed independently on 2026-04-04. The closest equivalent is the **Scenario 4** 2026-04-04 result (EnableThrottleMode=true, **EnableIncrementalDiff=true**, EnableInlineComments=true, GroupByFile=false, StrictMode=false), which shares the same IncrementalDiff=true + Per-Issue inline configuration. Refer to Scenario 4's 2026-04-04 result (Comment ID: 685).

---

### Scenario 8: Full File Content Summary Review (Maximum Context)

```properties
EnableThrottleMode=false
EnableIncrementalDiff=false
EnableInlineComments=false
```

**Log output**:
```
+ Throttle Mode: Disabled (full content)
✅ Retrieved full content for 14 matching files
```

**PR discussion thread result**: Same format as Scenario 1, but the AI sees the complete source code rather than a diff, providing the most context.

#### Actual Execution Results (2026-04-03)
- **Execution Status**: ❌ Failed (GitHub Copilot SDK Timeout)
- **AI Response Summary**: N/A (no response before timeout)
- **Issue Count**: N/A
- **⚠️ Important Finding**: `EnableThrottleMode=false` sends the **full content** of all 14 changed files to the AI. The oversized prompt caused the GitHub Copilot SDK to time out after 120 seconds. This mode is recommended only when the number of files is small, the change scope is limited, or `FileExtensions` is used to strictly filter the number of files.
- **Execution Log Excerpt**:
  ```
  + Throttle Mode: Disabled (full content)
  ⏳ Sending request to GitHub Copilot (timeout: 120000ms)...
  📨 Receiving streamed response...
  😡 Task failed with error: ⛔ GitHub Copilot SDK error: Timeout after 120000ms waiting for session.idle
  ##vso[task.complete result=Failed;]Task failed with error: ⛔ GitHub Copilot SDK error: Timeout after 120000ms waiting for session.idle
  ```

#### Actual Execution Results (2026-04-04)
- **Execution Status**: ✅ Success (Comment ID: 676)
- **AI Response Summary**: ❌ Recommend Rejection — `GetProjectsAsync` uses `return []` (C#13 syntax error); `GetFileAsync` URL separator `&` should be `?`; 2 Critical, 2 Warning, multiple Suggestions
- **Issue Count**: N/A (summary mode, no inline comments)
- **⚠️ Note**: Timeout was increased from 120000ms to 300000ms in task.json; this run completed successfully within 94.44 seconds under the extended timeout
- **Execution Log Excerpt**:
  ```
  + Throttle Mode: Disabled (full content)
  ⏳ Sending request to GitHub Copilot (timeout: 300000ms)...
  ⏱️ Response completed in 94.44 seconds
  📊 Token Usage - Output: 696
  ✅ Successfully added comment, ID: 676
  🎉 AI Pull Request Code Review completed successfully!
  ```

---

## 6. Complete Parameter Combination Matrix

### 6.1 `enableThrottleMode` × `enableIncrementalDiff`

| throttle | incremental | Azure DevOps Behavior | GitHub Behavior |
|:--------:|:-----------:|:----------------------|:----------------|
| `true` | `false` | Full PR diff (difference between all iterations and base branch) | Full PR patch (all files) |
| `true` | `true` | **Only the latest push's diff** (latest iteration vs previous iteration) | Full PR patch (GitHub has no iteration concept; equivalent to false) |
| `false` | `false` | Full content of all PR-changed files | Full content of all PR-changed files |
| `false` | `true` | **Latest push's file** list + full content (file scope is still filtered) | Full content of all PR-changed files (equivalent to false, false) |

### 6.2 `enableInlineComments` × `groupInlineCommentsByFile` × `inlineStrictMode`

| inline | groupByFile | strictMode | Inline Comment Count | Severity | Summary Stats Table |
|:------:|:-----------:|:----------:|:--------------------:|:--------:|:-------------------:|
| `false` | No effect | No effect | 0 | Unrestricted | None |
| `true` | `true` | `false` | ≤ by file count | critical + warning | 2 columns (C/W) |
| `true` | `true` | `true` | ≤ by file count | critical + warning + suggestion | 3 columns (C/W/S) |
| `true` | `false` | `false` | ≤ 20 | critical + warning | 2 columns (C/W) |
| `true` | `false` | `true` | ≤ 20 | critical + warning + suggestion | 3 columns (C/W/S) |

> **Inline comment limit**: Maximum of 20 (counted by number of issues). Issues beyond the limit are noted in the summary comment and are not silently discarded.

### 6.3 All 8 Scenarios × 5 Parameters at a Glance

| Scenario | throttle | incremental | inline | groupByFile | strictMode | Highlights |
|:--------:|:--------:|:-----------:|:------:|:-----------:|:----------:|------------|
| 1 | `true` | `false` | `false` | — | — | Summary mode, full PR diff |
| 2 | `true` | `true` | `false` | — | — | Review latest push only, saves tokens |
| 3 | `true` | `false` | `true` | `true` | `false` | Inline grouped, lightweight |
| **4** | **`true`** | **`false`** | **`true`** | **`false`** | **`false`** | **Default — per-issue inline comments** |
| 5 | `true` | `false` | `true` | `true` | `true` | Inline grouped, includes suggestions |
| 6 | `true` | `false` | `true` | `false` | `true` | Per-issue, most detailed |
| 7 | `true` | `true` | `true` | `false` | `false` | Incremental + line annotation, most token-efficient |
| 8 | `false` | `false` | `false` | — | — | Full content, maximum context |

---

## 7. Recommended Configuration Quick-Select Guide

```
What do you need?
│
├─ Just want an "overall summary" review?
│   ├─ First-time review (full PR)? → Scenario 1
│   └─ PR has had multiple pushes; only want to see new changes? → Scenario 2
│
├─ Need "precise line annotation" in Files Changed?
│   ├─ Fewer issues; prefer grouping by file? → Scenario 3
│   ├─ Want each issue to have its own precise line number? → Scenario 4 ← default configuration
│   ├─ Want to include suggestion-level feedback?
│   │   ├─ Grouped by file → Scenario 5
│   │   └─ Per-issue → Scenario 6
│   └─ PR is still iterating; review only latest push + line annotation? → Scenario 7
│
└─ AI needs full file context (not just diff)?
    └─ Scenario 8 (highest token consumption)
```

### Mutual Exclusion Quick Reference

```
GitHub Copilot Authentication (choose one; cannot be combined):
  ✅ githubToken filled in    → Token Mode
  ✅ serverAddress filled in  → Remote CLI Server Mode
  ✅ Both left empty          → Local CLI Mode
  ❌ Both filled in           → Program throws an error!

Inline comment dependencies (enableInlineComments must be enabled first):
  enableInlineComments=false → groupInlineCommentsByFile / inlineStrictMode have no effect
  enableInlineComments=true  → the above two take effect, and JSON format instructions are automatically appended

Incremental Diff cross-platform differences:
  enableThrottleMode=false + enableIncrementalDiff=true (Azure DevOps)
    → Still filters to the latest push's file list, but sends full content (≠ false, false)
  enableThrottleMode=false + enableIncrementalDiff=true (GitHub)
    → Equivalent to false, false (GitHub API has no iteration concept)
```
