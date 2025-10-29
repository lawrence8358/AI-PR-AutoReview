# [English](./README.md) | [繁體中文](https://github.com/lawrence8358/AI-PR-AutoReview/blob/main/README.zh-TW.md)

# 🤖 AI Code Review for Azure DevOps

This is an Azure DevOps Pipeline extension whose primary purpose is to allow AI to automatically perform code reviews on Pull Request (PR) code changes (Diff) and post the review results as comments back to the PR.

This version currently prioritizes support for Google Gemini and will add support for other AI platforms in the future.


## ✨ Main Features
+ **Automated PR review**: Automatically triggers during PR build validation.
+ **Integrated AI models**: Currently supports Google Gemini (default gemini-2.5-flash) for code analysis.
+ **Direct feedback**: Publishes AI review suggestions directly to the PR as comments.
+ **Highly customizable**: System prompts and model parameters (Temperature, etc.) can be customized.
+ **File filtering**: You can specify file extensions to include or exclude from analysis.


## Installation
You can install this extension from the Azure DevOps Marketplace: https://marketplace.visualstudio.com/items?itemName=LawrenceShen.ai-pr-autoreview


## 🛠️ Setup steps
Before using this Task, you need to complete the following configuration steps:

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

Below are all input parameters supported by this Task:

| Parameter Name (Name) | Label | Type | Required | Default | Description |
|---|---|---:|:---:|---|---|
| `inputAiProvider` | AI Provider | pickList | Yes | Google | Choose the AI platform to generate comments. Options: Google (Google Gemini). |
| `inputModelName` | AI Model Name | string | Yes | gemini-2.5-flash | Enter the model name for the selected AI platform. (Visible rule: inputAiProvider == Google) |
| `inputModelKey` | AI Model API Key | string | Yes | (empty) | Enter the API Key for the selected AI platform. (Visible rule: inputAiProvider == Google) |
| `inputSystemInstruction` | System Instruction | multiLine | No | You are a senior software engineer. Please help... (see Task defaults) | System-level instruction used to guide the AI model's behavior. |
| `inputPromptTemplate` | Prompt Template | multiLine | Yes | {code_changes} | Custom prompt template for the AI model. `{code_changes}` will be replaced with the actual code changes. |
| `inputMaxOutputTokens` | Max Output Tokens | string | No | 4096 | Maximum output token count for the AI model's response. |
| `inputTemperature` | Temperature | string | No | 1.0 | Temperature setting for the AI model, controlling randomness. |
| `inputFileExtensions` | File Extensions to Include | string | No | (empty) | Comma-separated list of file extensions to include in the Code Review analysis. If empty, all non-binary files are included by default. |
| `inputBinaryExtensions` | Binary File Extensions to Exclude | string | No | (empty) | Comma-separated list of binary file extensions to exclude from the Code Review analysis. Common binary types are excluded by default. |


## Result display
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/CI7.png)
