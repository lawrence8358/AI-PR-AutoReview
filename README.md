# [English](https://github.com/lawrence8358/AI-PR-AutoReview/blob/main/README.md) | [繁體中文](https://github.com/lawrence8358/AI-PR-AutoReview/blob/main/README.zh-TW.md)

# 🤖 AI Code Review for Azure DevOps

This is an Azure DevOps Pipeline extension whose primary purpose is to allow AI to automatically perform code reviews on Pull Request (PR) code changes (Diff) and post the review results as comments back to the PR.

Currently supports: **Google Gemini**, **OpenAI**, and **Grok (xAI)**.

> This extension also supports GitHub repository Pull Request CI.


## ✨ Main Features
+ **Automated PR review**: Automatically triggers during PR build validation.
+ **Multiple AI platforms**: Supports Google Gemini, OpenAI, and Grok (xAI) for code analysis.
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
  
| Label | Type | Required | Default | Description |
|---|---:|:---:|---|---|
| AI Provider | pickList | Yes | Google | Choose the AI platform to generate comments. Options: Google (Google Gemini), OpenAI, Grok (xAI). |
| AI Model Name | string | Conditional | gemini-2.5-flash | Enter the Google Gemini model name. Required when AI Provider is Google. |
| Gemini API Key | string | Conditional | (empty) | Enter the Google Gemini API Key. Required when AI Provider is Google. |
| OpenAI Model Name | string | Conditional | gpt-4o | Enter the OpenAI model name (e.g., gpt-4o, gpt-4o-mini). Required when AI Provider is OpenAI. |
| OpenAI API Key | string | Conditional | (empty) | Enter your OpenAI API Key. Required when AI Provider is OpenAI. |
| Grok Model Name | string | Conditional | grok-3-mini | Enter the Grok model name (e.g., grok-3-mini). Required when AI Provider is Grok. |
| Grok (xAI) API Key | string | Conditional | (empty) | Enter your Grok (xAI) API Key. Required when AI Provider is Grok. |
| System Instruction | multiLine | No | You are a senior software engineer. Please help... (see Task defaults) | System-level instruction used to guide the AI model's behavior. |
| Prompt Template | multiLine | Yes | {code_changes} | Custom prompt template for the AI model. `{code_changes}` will be replaced with the actual code changes. |
| Max Output Tokens | string | No | 4096 | Maximum output token count for the AI model's response. |
| Temperature | string | No | 1.0 | Temperature setting for the AI model, controlling randomness. |
| File Extensions to Include | string | No | (empty) | Comma-separated list of file extensions to include in the Code Review analysis. If empty, all non-binary files are included by default. |
| Binary File Extensions to Exclude | string | No | (empty) | Comma-separated list of binary file extensions to exclude from the Code Review analysis. If left empty, the task will automatically exclude common binary file types by default (for example: .jpg, .jpeg, .png, .gif, .bmp, .ico, .webp, .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .zip, .tar, .gz, .rar, .7z, .exe, .dll, .so, .dylib, .bin, .dat, .class, .mp3, .mp4, .avi, .mov, .flv, .md, .markdown, .txt, .gitignore). If you provide a value, your list will be used instead of these defaults. |
| Enable AI Throttle Mode | boolean | No | true | When enabled (default), only code differences are sent to AI for review. When disabled, the entire new file content is sent to AI for review. |
| Show Review Content | true | No | false | When enabled, the code changes, system instruction, prompt, and AI response will be printed to the console for debugging purposes. |


## 🎉 Result display
### Gemini
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/Review_Gemini_EN.png)

### OpenAI
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/Review_OpenAI_EN.png)
 
### Grok (xAI)
![](https://raw.githubusercontent.com/lawrence8358/AI-PR-AutoReview/main/screenshots/Review_Grok_EN.png)
