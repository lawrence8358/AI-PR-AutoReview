# Proposal: Enable System Prompt File Support

## Why
目前使用者只能透過行內文字區塊 (`inputSystemInstruction`) 提供系統提示詞，這限制了將系統提示詞作為程式碼進行管理的能力（例如存放在儲存庫的檔案中）。

## What Changes
- 新增輸入參數 `inputSystemInstructionSource` (下拉選單: "Inline", "File")。
- 新增輸入參數 `inputSystemPromptFile` (檔案路徑)。
- 邏輯修正：當選擇 "File" 時，優先讀取檔案內容作為系統提示詞。

## Impact
- 受影響的 Specs: System Prompt Configuration
- 受影響的程式碼: `src/task.json`, `src/index.ts` (或相關 Service)

