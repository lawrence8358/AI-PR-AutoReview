import { GenerateConfig } from '../interfaces/ai-service.interface';

/**
 * Claude Opus 4.7+ and Claude Sonnet 5+ deprecate sampling parameters.
 * The model name parser also accepts provider-specific prefixes such as
 * "claude-code-opus-4-8" so compatible gateways receive the same treatment.
 */
export function isClaudeSamplingParameterDeprecated(model: string): boolean {
    const opusVersion = getModelVersion(model, 'opus');
    if (opusVersion && (opusVersion.major > 4 || (opusVersion.major === 4 && opusVersion.minor >= 7))) {
        return true;
    }

    const sonnetVersion = getModelVersion(model, 'sonnet');
    return sonnetVersion !== undefined && sonnetVersion.major >= 5;
}

/** Gemini 3.x models are optimized for their default sampling settings. */
export function isGemini3Model(model: string): boolean {
    return /^gemini-3(?:[.-]|$)/i.test(model);
}

/**
 * Detects provider errors that explicitly reject the temperature parameter.
 * This is the forward-compatible fallback for newly released models whose
 * capabilities are not yet known to this task.
 */
export function isUnsupportedTemperatureError(error: any): boolean {
    const message = getErrorText(error).toLowerCase();
    if (!message.includes('temperature')) {
        return false;
    }

    return [
        'deprecated',
        'unsupported',
        'not supported',
        'does not support',
        'not compatible',
        'not available',
        'unknown parameter',
        'unrecognized parameter',
        'invalid parameter',
        'only the default'
    ].some(fragment => message.includes(fragment));
}

/** Returns a copy so caller-owned generation settings are never mutated. */
export function withoutTemperature(config: GenerateConfig): GenerateConfig {
    const { temperature: _temperature, ...rest } = config;
    return rest;
}

function getModelVersion(model: string, family: string): { major: number; minor: number } | undefined {
    const match = model.match(new RegExp(`(?:^|-)${family}-(\\d+)(?:[.-](\\d+))?(?:-|$)`, 'i'));
    if (!match) {
        return undefined;
    }

    return {
        major: Number.parseInt(match[1], 10),
        minor: Number.parseInt(match[2] ?? '0', 10)
    };
}

function getErrorText(error: any): string {
    const value = error?.response?.data ?? error?.error ?? error?.message ?? error;
    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
