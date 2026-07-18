import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import OpenAI from 'openai';
import { ClaudeService } from '../src/services/claude.service';
import { GoogleAIService } from '../src/services/google-ai.service';
import { OpenAIService } from '../src/services/openai.service';
import { OpenAICompatibleService } from '../src/services/openai-compatible.service';
import { AIProviderService } from '../src/services/ai-provider.service';
import { BaseHttpAIService } from '../src/services/base-http-ai.service';
import { GenerateConfig } from '../src/interfaces/ai-service.interface';
import { isUnsupportedTemperatureError } from '../src/services/model-parameter-compatibility';

const config: GenerateConfig = {
    temperature: 0.2,
    maxOutputTokens: 1024,
    showReviewContent: false
};

class TestClaudeService extends ClaudeService {
    public requestBody(input: GenerateConfig): any {
        return this.getRequestBody('system', 'prompt', this.prepareGenerateConfig(input));
    }
}

class TestGoogleAIService extends GoogleAIService {
    public requestBody(input: GenerateConfig): any {
        return this.getRequestBody('system', 'prompt', this.prepareGenerateConfig(input));
    }
}

class TestOpenAIService extends OpenAIService {
    public requestOptions(input: GenerateConfig): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
        return this.getRequestOptions('system', 'prompt', this.prepareGenerateConfig(input));
    }
}

class TestOpenAICompatibleService extends OpenAICompatibleService {
    public requestOptions(input: GenerateConfig): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
        return this.getRequestOptions('system', 'prompt', this.prepareGenerateConfig(input));
    }

    public endpoint(): string | undefined {
        return this.baseURL;
    }

    public modelName(): string {
        return this.model;
    }
}

class TestHttpService extends BaseHttpAIService {
    protected getServiceName(): string {
        return 'Test HTTP';
    }

    protected getApiUrl(): string {
        return 'https://example.test/generate';
    }

    protected getRequestBody(_systemInstruction: string, _prompt: string, input?: GenerateConfig): any {
        return { temperature: input?.temperature, max_tokens: input?.maxOutputTokens };
    }

    protected getHeaders(): any {
        return {};
    }

    protected extractContent(response: any): string {
        return response.data.content;
    }
}

describe('Model parameter compatibility', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('omits temperature for Claude Opus 4.8, including gateway-prefixed model names', () => {
        const service = new TestClaudeService('key', 'claude-code-opus-4.8');

        const body = service.requestBody(config);

        expect(body).not.to.have.property('temperature');
        expect(body.max_tokens).to.equal(1024);
        expect(config.temperature).to.equal(0.2);
    });

    it('omits temperature for Claude Sonnet 5', () => {
        const service = new TestClaudeService('key', 'claude-sonnet-5');

        expect(service.requestBody(config)).not.to.have.property('temperature');
    });

    it('keeps temperature for Claude models that still support it', () => {
        const service = new TestClaudeService('key', 'claude-haiku-4-5');

        expect(service.requestBody(config).temperature).to.equal(0.2);
    });

    it('omits temperature for Gemini 3.x but keeps it for Gemini 2.5', () => {
        const gemini3 = new TestGoogleAIService('key', 'gemini-3.5-flash');
        const gemini25 = new TestGoogleAIService('key', 'gemini-2.5-flash');

        expect(gemini3.requestBody(config).generationConfig).not.to.have.property('temperature');
        expect(gemini25.requestBody(config).generationConfig.temperature).to.equal(0.2);
    });

    it('keeps temperature in an OpenAI request until the provider explicitly rejects it', () => {
        const service = new TestOpenAIService('key', 'gpt-5-mini');

        expect(service.requestOptions(config).temperature).to.equal(0.2);
    });

    it('uses the common max_tokens field for an OpenAI-compatible provider', () => {
        const service = new TestOpenAICompatibleService('', 'Vendor/CaseSensitive-Model', 'http://localhost:11434/v1/');

        const options = service.requestOptions(config);

        expect(options.max_tokens).to.equal(1024);
        expect(options).not.to.have.property('max_completion_tokens');
        expect(options.temperature).to.equal(0.2);
        expect(service.endpoint()).to.equal('http://localhost:11434/v1');
        expect(service.modelName()).to.equal('Vendor/CaseSensitive-Model');
    });

    it('accepts OpenAI-compatible aliases and an empty key for local providers', () => {
        const registry = new AIProviderService();
        registry.registerService('OpenAI Compatible', {
            apiKey: '',
            modelName: 'local-model',
            apiEndpoint: 'http://localhost:11434/v1'
        });

        expect(registry.getService('openai-compatible')).to.be.instanceOf(OpenAICompatibleService);
    });

    it('rejects a non-HTTP OpenAI-compatible Base URL', () => {
        expect(() => new OpenAICompatibleService('', 'local-model', 'file:///tmp/v1'))
            .to.throw('only allows http:// or https://');
    });

    it('requires an explicit OpenAI-compatible Base URL', () => {
        expect(() => new OpenAICompatibleService('', 'local-model', ''))
            .to.throw('Base URL is required');
    });

    it('retries an OpenAI-compatible provider once without temperature', async () => {
        const client = new OpenAI({ apiKey: 'key' });
        const completionsPrototype = Object.getPrototypeOf(client.chat.completions);
        const create = sinon.stub(completionsPrototype, 'create');
        create.onFirstCall().rejects(new Error(
            "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported."
        ));
        create.onSecondCall().resolves({
            choices: [{ message: { content: 'review' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 }
        });
        const service = new OpenAIService('key', 'gpt-5-mini');

        const response = await service.generateComment('system', 'prompt', config);

        expect(response.content).to.equal('review');
        expect(create.callCount).to.equal(2);
        expect(create.firstCall.args[0].temperature).to.equal(0.2);
        expect(create.secondCall.args[0]).not.to.have.property('temperature');
    });

    it('recognizes Anthropic and OpenAI-compatible unsupported-temperature errors', () => {
        const anthropicError = {
            response: { data: { error: { message: '`temperature` is deprecated for this model.' } } }
        };
        const compatibleError = new Error("Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.");

        expect(isUnsupportedTemperatureError(anthropicError)).to.equal(true);
        expect(isUnsupportedTemperatureError(compatibleError)).to.equal(true);
        expect(isUnsupportedTemperatureError(new Error('rate limit exceeded'))).to.equal(false);
    });

    it('retries an HTTP provider once without temperature when a new model rejects it', async () => {
        const post = sinon.stub(axios, 'post');
        post.onFirstCall().rejects({
            response: { data: { error: { message: '`temperature` is not supported by this model.' } } }
        });
        post.onSecondCall().resolves({ data: { content: 'review' } });
        const service = new TestHttpService('key', 'future-model');

        const response = await service.generateComment('system', 'prompt', config);

        expect(response.content).to.equal('review');
        expect(post.callCount).to.equal(2);
        expect(post.firstCall.args[1]).to.deep.equal({ temperature: 0.2, max_tokens: 1024 });
        expect(post.secondCall.args[1]).to.deep.equal({ temperature: undefined, max_tokens: 1024 });
    });
});
