import { AI_PROVIDERS } from './providers.constants';

// 預設模型名稱配置（統一所有不一致的地方）
export const DEFAULT_MODELS: Record<string, string> = {
  [AI_PROVIDERS.OPENAI]: 'gpt-5-mini',              // 統一使用 gpt-5-mini
  [AI_PROVIDERS.GROK]: 'grok-3-mini',
  [AI_PROVIDERS.CLAUDE]: 'claude-haiku-4-5',
  [AI_PROVIDERS.GOOGLE]: 'gemini-2.5-flash',
  [AI_PROVIDERS.GITHUB_COPILOT]: 'gpt-5-mini',       // 統一使用 gpt-5-mini
  [AI_PROVIDERS.OLLAMA]: ''                          // 用戶自行指定模型
};

// Environment variable key 映射（原 index.ts line 141-147）
export const API_KEY_ENV_MAP: Record<string, string> = {
  [AI_PROVIDERS.OPENAI]: 'OpenAIAPIKey',
  [AI_PROVIDERS.GROK]: 'GrokAPIKey',
  [AI_PROVIDERS.CLAUDE]: 'ClaudeAPIKey',
  [AI_PROVIDERS.GOOGLE]: 'GeminiAPIKey',
  [AI_PROVIDERS.GITHUB_COPILOT]: '', // 不需要 API Key
  [AI_PROVIDERS.OLLAMA]: ''           // 不需要 API Key
};

// Task input 配置映射（原 index.ts line 152-158）
export interface TaskInputConfig {
  nameKey: string;
  apiKeyKey: string;
  defaultName: string;
  githubTokenKey?: string;
  serverAddressKey?: string;
  copilotCliPathKey?: string;
}

// Claude 各模型的最大輸出 Token 數（作為快取優化，避免不必要的重試）
// 對於不在此表的新模型，ClaudeService 會透過 API 錯誤自動解析實際上限並重試
export const CLAUDE_MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-haiku-4-5': 16000,
  'claude-haiku-4-5-20251001': 16000,
  'claude-sonnet-4-5': 64000,
  'claude-opus-4-5': 32000,
  'claude-sonnet-4-6': 64000,
  'claude-opus-4-6': 32000,
  'claude-3-5-sonnet-20241022': 8192,
  'claude-3-5-haiku-20241022': 8192,
  'claude-3-opus-20240229': 4096,
  'claude-3-sonnet-20240229': 4096,
  'claude-3-haiku-20240307': 4096,
};
// 用於未知模型的預設值（設定高於現有模型上限，讓 API 回傳實際上限後自動重試）
export const CLAUDE_DEFAULT_MAX_TOKENS = 99999;

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
    serverAddressKey: 'inputGitHubCopilotServerAddress',
    copilotCliPathKey: 'inputGitHubCopilotCliPath'
  },
  [AI_PROVIDERS.OLLAMA]: {
    nameKey: 'inputOllamaModelName',
    apiKeyKey: '',
    defaultName: DEFAULT_MODELS[AI_PROVIDERS.OLLAMA],
    serverAddressKey: 'inputOllamaBaseUrl'
  }
};
