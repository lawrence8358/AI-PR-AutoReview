# [English](https://github.com/lawrence8358/AI-PR-AutoReview/blob/main/README.md) | [繁體中文](https://github.com/lawrence8358/AI-PR-AutoReview/blob/main/README.zh-TW.md)

# AI Code Review for Azure DevOps

This is an Azure DevOps Pipeline extension that leverages the power of Large Language Models (LLMs) to automatically perform code reviews on Pull Request (PR) changes. It acts as an intelligent coding assistant, analyzing diffs and posting insightful comments directly to the PR.

**Now supporting all major AI providers:**
+ **GitHub Copilot** (All versions supported)
+ **OpenAI** (GPT-4o, etc.)
+ **Google Gemini**
+ **Anthropic Claude**
+ **xAI Grok**

> **Highlight**: Maximize the value of your existing **GitHub Copilot** subscription by integrating it directly into your Azure DevOps PR workflow! This extension also supports GitHub repository Pull Request CI.


## ✨ Main Features
+ **Automated PR review**: Automatically triggers during PR build validation, acting as a diligent 24/7 reviewer.
+ **Universal AI Support**: Seamlessly switch between Google Gemini, OpenAI, Grok, Claude, and GitHub Copilot based on your needs.
+ **GitHub Copilot Integration**: Connect to GitHub Copilot CLI to perform reviews using your existing subscription (Individual, Business, or Enterprise), ensuring data privacy and cost-efficiency.
+ **Direct Feedback**: Publishes AI review suggestions directly to the PR as comments, threading into the conversation.
+ **Highly Customizable**: Tailor the System Prompts (Inline or File-based), adjust creativity (Temperature), and control token usage.
+ **Smart Filtering**: configure included/excluded file extensions to focus the review on what matters.


## Installation
You can install this extension from the Azure DevOps Marketplace: https://marketplace.visualstudio.com/items?itemName=LawrenceShen.ai-pr-autoreview


## 🛠️ Setup steps

### 📊 AI Provider Prerequisites Comparison
Different AI Providers have different prerequisites:

| AI Provider | Prerequisites | Instructions |
|---|---|---|
| Google Gemini | Apply for API Key | Get API Key from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| OpenAI | Apply for API Key | Get API Key from [OpenAI Platform](https://platform.openai.com/api-keys) |
| Grok (xAI) | Apply for API Key | Get API Key from [xAI Console](https://console.x.ai/) |
| Claude (Anthropic) | Apply for API Key | Get API Key from [Anthropic Console](https://console.anthropic.com/) |
| **GitHub Copilot** | Deploy CLI Server | See [GitHub Copilot CLI Prerequisites](#github-copilot-cli-prerequisites) below |

### GitHub Copilot CLI Prerequisites

If you or your organization has a GitHub Copilot subscription (Individual, Business, or Enterprise), you can use the internal CLI Server for PR Code Review.

#### Applicable Scenarios
- Have an active GitHub Copilot subscription
- Want to reuse existing Copilot infrastructure
- Need unified AI toolchain experience

#### CLI Server Setup Steps

1. **Install GitHub Copilot CLI**
   ```bash
   npm install -g @github/copilot-sdk
   ```

2. **Start CLI Server Mode**
   
   Start the CLI Server on an internal network server:
   ```bash
   copilot --headless --port 8080
   ```  

3. **Configure in Pipeline Task**
   - **AI Provider**: Select `GitHub Copilot`
   - **Network Type**: Select `Intranet`
   - **CLI Server Address**: (Optional) Enter `your-server-ip:8080` or `your-domain:8080`. If not provided, will use GitHub Copilot CLI in Build Agent
   - **Model Name**: (Optional) Defaults to `gpt-4o`

#### Important Notes
- **Remote Server Mode**: When CLI Server Address is provided, ensure Pipeline Agent and CLI Server are on the same internal network or can connect to each other. CLI Server must be running when Pipeline executes.
- **Local CLI Mode**: When CLI Server Address is not provided, will use the authenticated GitHub Copilot CLI in the Build Agent. Requirements:
  - GitHub Copilot CLI must be installed on Build Agent
  - Must have completed authentication via `copilot auth login`
  - Agent must have GitHub Copilot access permission
- Currently only supports Intranet mode; Internet mode will be available in future versions

---

Before using this Task, you also need to complete the following configuration steps:

### Step 1: Configure CI service permissions
To allow the Pipeline service to write AI comments back to the PR, you must grant it the required permissions. If this permission is not set, the Pipeline will fail and display the error `Error: TF401027: You need the Git 'PullRequestContribute' permission...`.
+ Configure the CI build service to write back PR comments: `Projects Settings -> Repositories -> Security`.
+ In the user list, find your Project Collection Build Service (YourCollectionName) account (or the specific service account your Pipeline uses).
+ Set the "Contribute to pull request" permission to `Allow`.
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/RepoSecurity.png) 

### Step 2: Create a Pull Request (PR) Pipeline
Set up branch policies so that this Pipeline is automatically triggered when a PR is created. This extension only triggers the Code Review process during PR builds; it will be skipped in standard build runs.
+ Select `Projects Settings -> Repositories -> YourGitProject -> Policies -> Branch Policies -> select the target branch` (for example `main` or `master`).
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/CI3.png) 
+ Configure Build Validation within Branch Policies according to your team's rules.
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/CI4.png) 
+ Ensure your Pipeline includes the normal CI Build Tasks, then add this extension.
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/CI1.png) 
+ Enter the Task parameters and adjust them according to your needs.
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/CI2.png) 

### Step 3: (Recommended) Enforce PR-based code merges
To ensure all code is code-reviewed, we recommend configuring branch policies to require merges through PRs.
+ Select `Projects Settings -> Repositories -> YourGitProject -> Policies -> Branch Policies -> select the target branch` (for example `main` or `master`).
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/RepoPolicies1.png) 
+ Configure the branch policy and enable `Require a minimum number of reviewers`. For demonstration purposes we allowed users to approve their own changes; set this according to your team's policies.
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/RepoPolicies2.png) 
 

## 📋 Task input parameters explained
Below are all input parameters supported by this Task:
  
| Label | Type | Required | Default | Description |
|---|---:|:---:|---|---|
| AI Provider | pickList | Yes | Google | Choose the AI platform to generate comments. Options: Google (Google Gemini), OpenAI, Grok (xAI), Claude (Anthropic), GitHub Copilot  (Preview). |
| GitHub Copilot Network Type | pickList | Conditional | Intranet | Select GitHub Copilot connection type. Options: Intranet, Internet (Coming Soon). Shown when GitHub Copilot is selected. |
| AI Model Name | string | Conditional | gemini-2.5-flash | Enter the Google Gemini model name. Required when AI Provider is Google. |
| Gemini API Key | string | Conditional | (empty) | Enter the Google Gemini API Key. Required when AI Provider is Google. |
| OpenAI Model Name | string | Conditional | gpt-4o | Enter the OpenAI model name (e.g., gpt-4o, gpt-4o-mini). Required when AI Provider is OpenAI. |
| OpenAI API Key | string | Conditional | (empty) | Enter your OpenAI API Key. Required when AI Provider is OpenAI. |
| Grok Model Name | string | Conditional | grok-3-mini | Enter the Grok model name (e.g., grok-3-mini). Required when AI Provider is Grok. |
| Grok (xAI) API Key | string | Conditional | (empty) | Enter your Grok (xAI) API Key. Required when AI Provider is Grok. |
| Claude Model Name | string | Conditional | claude-haiku-4-5 | Enter the Claude model name (e.g., claude-haiku-4-5). Required when AI Provider is Claude. |
| Claude API Key | string | Conditional | (empty) | Enter your Claude API Key. Required when AI Provider is Claude. |
| GitHub Copilot CLI Server Address | string | No | (empty) | (Optional) Enter GitHub Copilot CLI Server address (IP or Domain + Port). Example: 192.168.1.100:8080 or copilot.internal.company.com:8080. If not provided, will use GitHub Copilot CLI in Build Agent. Visible when GitHub Copilot + Intranet is selected. |
| GitHub Copilot Model Name | string | No | gpt-4o | Enter the model name used by GitHub Copilot. Optional, defaults to gpt-4o. Shown when GitHub Copilot + Intranet is selected. |
| GitHub Copilot Request Timeout (ms) | string | No | 120000 | Request timeout in milliseconds for GitHub Copilot. Default: 120000 ms (2 minutes). If left empty, defaults to 60000 ms (1 minute). Shown when GitHub Copilot + Intranet is selected. |
| System Instruction Source | pickList | Yes | Inline | Select the source of the system instruction. Options: Inline, File. |
| System Prompt File | string | No | (empty) | Path to the system prompt file. Supported formats: .md, .txt, .json, .yaml, .yml, .xml, .html. Optional. If the file is not found or empty, falls back to inline instruction. |
| System Instruction | multiLine | No | You are a senior software engineer. Please help... (see Task defaults) | System-level instruction used to guide the AI model's behavior. Used when System Instruction Source is 'Inline'. Optional. If empty, a default code review instruction will be used automatically. |
| Prompt Template | multiLine | Yes | {code_changes} | Custom prompt template for the AI model. `{code_changes}` will be replaced with the actual code changes. |
| Max Output Tokens | string | No | 4096 | Maximum output token count for the AI model's response. |
| Temperature | string | No | 1.0 | Temperature setting for the AI model, controlling randomness. |
| File Extensions to Include | string | No | (empty) | Comma-separated list of file extensions to include in the Code Review analysis. If empty, all non-binary files are included by default. |
| Binary File Extensions to Exclude | string | No | (empty) | Comma-separated list of binary file extensions to exclude from the Code Review analysis. If left empty, the task will automatically exclude common binary file types by default (for example: .jpg, .jpeg, .png, .gif, .bmp, .ico, .webp, .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .zip, .tar, .gz, .rar, .7z, .exe, .dll, .so, .dylib, .bin, .dat, .class, .mp3, .mp4, .avi, .mov, .flv, .md, .markdown, .txt, .gitignore). If you provide a value, your list will be used instead of these defaults. |
| Enable AI Throttle Mode | boolean | No | true | When enabled (default), only code differences are sent to AI for review. When disabled, the entire new file content is sent to AI for review. **Note**: When this option is disabled, "Enable Incremental Diff Mode" will have no effect. |
| Enable Incremental Diff Mode | boolean | No | false | When enabled, only the changes from the latest push (most recent iteration) are reviewed. When disabled, all PR changes from all iterations are reviewed. **Important**: This option only takes effect when "Enable AI Throttle Mode" is enabled. When throttle mode is disabled, this setting is ignored. |
| Show Review Content | boolean | No | false | When enabled, the code changes, system instruction, prompt, and AI response will be printed to the console for debugging purposes. |


## 🎉 Result display
### Gemini
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/Review_Gemini_EN.png)

### OpenAI
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/Review_OpenAI_EN.png)
 
### Grok (xAI)
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/Review_Grok_EN.png)

### Claude (Anthropic)
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/Review_Claude_EN.png)
