namespace WpfCodeReview.Models;

public class AppSettings
{
    // Working Directory
    public string WorkingDirectory { get; set; } = @"D:\Project\Github\AI-PR-AutoReview";

    // DevOps Connection
    public string DevOpsOrgUrl { get; set; } = "";
    public string DevOpsAccessToken { get; set; } = "";
    public string DevOpsProjectName { get; set; } = "";
    public string DevOpsRepositoryId { get; set; } = "";
    public string DevOpsPRId { get; set; } = "";

    // AI Provider
    public string AiProvider { get; set; } = "Ollama";
    public string ModelName { get; set; } = "";

    // API Keys
    public string GeminiAPIKey { get; set; } = "";
    public string OpenAIAPIKey { get; set; } = "";
    public string GrokAPIKey { get; set; } = "";
    public string ClaudeAPIKey { get; set; } = "";

    // GitHub Copilot
    public string GitHubCopilotServerAddress { get; set; } = "";
    public string GitHubCopilotToken { get; set; } = "";
    public string GitHubCopilotTimeout { get; set; } = "300000";

    // Ollama
    public string OllamaBaseUrl { get; set; } = "http://localhost:11434";

    // AI Generation
    public string SystemInstructionSource { get; set; } = "Built-in";
    public string SystemInstruction { get; set; } = "";
    public string ResponseLanguage { get; set; } = "Taiwanese (zh-TW)";
    public string MaxOutputTokens { get; set; } = "";
    public string Temperature { get; set; } = "0.2";

    // Diff Filter
    public string FileExtensions { get; set; } = "";
    public string BinaryExtensions { get; set; } = "";

    // Review Mode
    public bool EnableThrottleMode { get; set; } = true;
    public bool ShowReviewContent { get; set; } = true;
    public bool EnableIncrementalDiff { get; set; } = true;
    public bool WriteReviewResult { get; set; } = false;

    // Inline Comment
    public bool EnableInlineComments { get; set; } = true;
    public bool GroupInlineCommentsByFile { get; set; } = false;
    public bool InlineStrictMode { get; set; } = false;
}
