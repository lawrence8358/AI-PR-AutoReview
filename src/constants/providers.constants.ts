// AI Provider 識別字串常數
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  GROK: 'grok',
  CLAUDE: 'claude',
  GOOGLE: 'google',
  GITHUB_COPILOT: 'githubcopilot',
  OLLAMA: 'ollama'
} as const;

// Type helper for type safety
export type AIProviderKey = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];

// DevOps Provider 識別字串常數
export const DEVOPS_PROVIDERS = {
  AZURE: 'azure',
  AZURE_DEVOPS: 'azuredevops',
  GITHUB: 'github'
} as const;

export type DevOpsProviderKey = typeof DEVOPS_PROVIDERS[keyof typeof DEVOPS_PROVIDERS];

// Provider 顯示名稱映射
export const AI_PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  [AI_PROVIDERS.OPENAI]: 'OpenAI',
  [AI_PROVIDERS.GROK]: 'Grok (xAI)',
  [AI_PROVIDERS.CLAUDE]: 'Claude (Anthropic)',
  [AI_PROVIDERS.GOOGLE]: 'Google',
  [AI_PROVIDERS.GITHUB_COPILOT]: 'GitHubCopilot',
  [AI_PROVIDERS.OLLAMA]: 'Ollama'
};
