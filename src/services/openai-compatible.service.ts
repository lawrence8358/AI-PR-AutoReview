import OpenAI from 'openai';
import { GenerateConfig } from '../interfaces/ai-service.interface';
import { BaseOpenAICompatibleService } from './base-openai-compatible.service';

const PLACEHOLDER_API_KEY = 'not-required';

/**
 * Generic service for APIs that implement the OpenAI Chat Completions contract.
 */
export class OpenAICompatibleService extends BaseOpenAICompatibleService {
    constructor(apiKey: string, model: string, baseURL: string) {
        super(apiKey.trim() || PLACEHOLDER_API_KEY, model, normalizeBaseURL(baseURL));
        // Third-party model identifiers may be case-sensitive.
        this.model = model.trim();
    }

    protected getServiceName(): string {
        return 'OpenAI Compatible';
    }

    /**
     * Use max_tokens for the broadest compatibility with third-party Chat
     * Completions implementations. OpenAI itself uses max_completion_tokens
     * for newer reasoning models, but many compatible providers do not.
     */
    protected override getRequestOptions(
        systemInstruction: string,
        prompt: string,
        config?: GenerateConfig
    ): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
        const options = super.getRequestOptions(systemInstruction, prompt, config);

        if (config?.maxOutputTokens !== undefined) {
            delete options.max_completion_tokens;
            options.max_tokens = config.maxOutputTokens;
        }

        return options;
    }
}

function normalizeBaseURL(baseURL: string): string {
    const value = baseURL.trim();
    if (!value) {
        throw new Error('⛔ OpenAI-compatible Base URL is required');
    }

    const parsed = new URL(value);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('⛔ OpenAI-compatible Base URL only allows http:// or https:// protocol');
    }

    return value.replace(/\/$/, '');
}
