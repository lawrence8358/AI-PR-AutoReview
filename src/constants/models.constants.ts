import { AI_PROVIDERS } from './providers.constants';

// 預設模型名稱配置（統一所有不一致的地方）
export const DEFAULT_MODELS: Record<string, string> = {
  [AI_PROVIDERS.OPENAI]: 'gpt-4o',              // 統一使用 gpt-4o
  [AI_PROVIDERS.GROK]: 'grok-3-mini',
  [AI_PROVIDERS.CLAUDE]: 'claude-haiku-4-5',
  [AI_PROVIDERS.GOOGLE]: 'gemini-2.5-flash',
  [AI_PROVIDERS.GITHUB_COPILOT]: 'gpt-4o'       // 統一使用 gpt-4o
};

// Environment variable key 映射（原 index.ts line 141-147）
export const API_KEY_ENV_MAP: Record<string, string> = {
  [AI_PROVIDERS.OPENAI]: 'OpenAIAPIKey',
  [AI_PROVIDERS.GROK]: 'GrokAPIKey',
  [AI_PROVIDERS.CLAUDE]: 'ClaudeAPIKey',
  [AI_PROVIDERS.GOOGLE]: 'GeminiAPIKey',
  [AI_PROVIDERS.GITHUB_COPILOT]: '' // 不需要 API Key
};

// Task input 配置映射（原 index.ts line 152-158）
export interface TaskInputConfig {
  nameKey: string;
  apiKeyKey: string;
  defaultName: string;
  githubTokenKey?: string;
  serverAddressKey?: string;
}

export const TASK_INPUT_CONFIG_MAP: Record<string, TaskInputConfig> = {
  [AI_PROVIDERS.OPENAI]: {
    nameKey: 'inputOpenAIModelName',
    apiKeyKey: 'inputOpenAIApiKey',
    defaultName: DEFAULT_MODELS[AI_PROVIDERS.OPENAI]
  },
  [AI_PROVIDERS.GROK]: {
    nameKey: 'inputGrokModelName',
    apiKeyKey: 'inputGrokApiKey',
    defaultName: DEFAULT_MODELS[AI_PROVIDERS.GROK]
  },
  [AI_PROVIDERS.CLAUDE]: {
    nameKey: 'inputClaudeModelName',
    apiKeyKey: 'inputClaudeApiKey',
    defaultName: DEFAULT_MODELS[AI_PROVIDERS.CLAUDE]
  },
  [AI_PROVIDERS.GOOGLE]: {
    nameKey: 'inputModelName',
    apiKeyKey: 'inputModelKey',
    defaultName: DEFAULT_MODELS[AI_PROVIDERS.GOOGLE]
  },
  [AI_PROVIDERS.GITHUB_COPILOT]: {
    nameKey: 'inputGitHubCopilotModelName',
    apiKeyKey: '',
    defaultName: DEFAULT_MODELS[AI_PROVIDERS.GITHUB_COPILOT],
    githubTokenKey: 'inputGitHubCopilotToken',
    serverAddressKey: 'inputGitHubCopilotServerAddress'
  }
};
