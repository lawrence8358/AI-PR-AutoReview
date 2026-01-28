# system-prompt-config Specification

## Purpose
TBD - created by archiving change enable-system-prompt-file. Update Purpose after archive.
## Requirements
### Requirement: System Prompt Configuration (系統提示詞設定)
本系統 **MUST** (必須) 允許使用者設定系統提示詞 (System Prompt) 的來源，可選擇直接輸入 (Inline) 或從儲存庫中的檔案讀取。

#### Scenario: User selects File source (使用者選擇檔案來源)
- **WHEN** `inputSystemInstructionSource` 設定為 "File"
- **AND** `inputSystemPromptFile` 指向一個有效的檔案
- **THEN**系統應使用該檔案的內容作為系統提示詞 (System Instruction)
- **AND** 忽略 `inputSystemInstruction` (行內) 的值

#### Scenario: User selects Inline source (使用者選擇行內來源)
- **WHEN** `inputSystemInstructionSource` 設定為 "Inline"
- **THEN** 系統應使用 `inputSystemInstruction` 的內容
- **AND** 忽略 `inputSystemPromptFile`

#### Scenario: Invalid file handling (無效檔案處理)
- **WHEN** `inputSystemInstructionSource` 為 "File"
- **AND** `inputSystemPromptFile` 無效或為空
- **THEN** 任務應失敗並顯示錯誤訊息

#### Scenario: Input visibility (輸入項可見性)
- **WHEN** `inputSystemInstructionSource` 為 "File"
- **THEN** 顯示 `inputSystemPromptFile` 輸入項
- **WHEN** `inputSystemInstructionSource` 為 "Inline"
- **THEN** 顯示 `inputSystemInstruction` 輸入項

