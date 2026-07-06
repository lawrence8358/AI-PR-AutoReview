using System.IO;
using WpfCodeReview.Models;

namespace WpfCodeReview.Services;

/// <summary>
/// Parses a .env file and maps known keys into <see cref="AppSettings"/>.
/// </summary>
public static class EnvFileReader
{
    public static void ReadInto(string envFilePath, AppSettings settings)
    {
        var pairs = ParseEnvFile(envFilePath);

        settings.DevOpsOrgUrl              = Get(pairs, "DevOpsOrgUrl",              settings.DevOpsOrgUrl);
        settings.DevOpsAccessToken         = Get(pairs, "DevOpsAccessToken",         settings.DevOpsAccessToken);
        settings.DevOpsProjectName         = Get(pairs, "DevOpsProjectName",         settings.DevOpsProjectName);
        settings.DevOpsRepositoryId        = Get(pairs, "DevOpsRepositoryId",        settings.DevOpsRepositoryId);
        settings.DevOpsPRId                = Get(pairs, "DevOpsPRId",                settings.DevOpsPRId);

        settings.AiProvider                = Get(pairs, "AiProvider",                settings.AiProvider);
        settings.ModelName                 = Get(pairs, "ModelName",                 settings.ModelName);

        settings.GeminiAPIKey              = Get(pairs, "GeminiAPIKey",              settings.GeminiAPIKey);
        settings.OpenAIAPIKey              = Get(pairs, "OpenAIAPIKey",              settings.OpenAIAPIKey);
        settings.GrokAPIKey                = Get(pairs, "GrokAPIKey",                settings.GrokAPIKey);
        settings.ClaudeAPIKey              = Get(pairs, "ClaudeAPIKey",              settings.ClaudeAPIKey);

        settings.GitHubCopilotToken        = Get(pairs, "GitHubCopilotToken",        settings.GitHubCopilotToken);
        settings.GitHubCopilotServerAddress= Get(pairs, "GitHubCopilotServerAddress",settings.GitHubCopilotServerAddress);
        settings.GitHubCopilotTimeout      = Get(pairs, "GitHubCopilotTimeout",      settings.GitHubCopilotTimeout);

        settings.OllamaBaseUrl             = Get(pairs, "OllamaBaseUrl",             settings.OllamaBaseUrl);

        settings.SystemInstructionSource   = Get(pairs, "SystemInstructionSource",   settings.SystemInstructionSource);
        settings.SystemInstruction         = Get(pairs, "SystemInstruction",         settings.SystemInstruction);
        settings.ResponseLanguage          = Get(pairs, "ResponseLanguage",          settings.ResponseLanguage);
        settings.MaxOutputTokens           = Get(pairs, "MaxOutputTokens",           settings.MaxOutputTokens);
        settings.Temperature               = Get(pairs, "Temperature",               settings.Temperature);

        settings.FileExtensions            = Get(pairs, "FileExtensions",            settings.FileExtensions);
        settings.BinaryExtensions          = Get(pairs, "BinaryExtensions",          settings.BinaryExtensions);

        settings.EnableThrottleMode        = GetBool(pairs, "EnableThrottleMode",    settings.EnableThrottleMode);
        settings.ShowReviewContent         = GetBool(pairs, "ShowReviewContent",     settings.ShowReviewContent);
        settings.EnableIncrementalDiff     = GetBool(pairs, "EnableIncrementalDiff", settings.EnableIncrementalDiff);
        settings.WriteReviewResult         = GetBool(pairs, "WriteReviewResult",     settings.WriteReviewResult);
        settings.EnableInlineComments      = GetBool(pairs, "EnableInlineComments",  settings.EnableInlineComments);
        settings.GroupInlineCommentsByFile = GetBool(pairs, "GroupInlineCommentsByFile", settings.GroupInlineCommentsByFile);
        settings.InlineStrictMode          = GetBool(pairs, "InlineStrictMode",      settings.InlineStrictMode);
    }

    private static Dictionary<string, string> ParseEnvFile(string path)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();

            // Skip blank lines and comments
            if (string.IsNullOrEmpty(line) || line.StartsWith('#')) continue;

            var eq = line.IndexOf('=');
            if (eq < 1) continue;

            var key   = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();

            // Strip inline comment (e.g. value # comment)
            var commentIdx = value.IndexOf(" #");
            if (commentIdx >= 0)
                value = value[..commentIdx].Trim();

            result[key] = value;
        }

        return result;
    }

    private static string Get(Dictionary<string, string> d, string key, string fallback)
        => d.TryGetValue(key, out var v) ? v : fallback;

    private static bool GetBool(Dictionary<string, string> d, string key, bool fallback)
    {
        if (!d.TryGetValue(key, out var v)) return fallback;
        return v.Equals("true", StringComparison.OrdinalIgnoreCase);
    }
}
