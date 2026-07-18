using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Win32;
using WpfCodeReview.Models;
using WpfCodeReview.Services;

namespace WpfCodeReview;

public partial class MainWindow : Window
{
    private static readonly IReadOnlyDictionary<string, string[]> ModelSuggestions =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["Google"] =
            [
                "gemini-2.5-flash",
                "gemini-3.5-flash",
                "gemini-3.1-pro-preview",
                "gemini-3.1-flash-lite",
                "gemini-2.5-pro",
                "gemini-2.5-flash-lite"
            ],
            ["OpenAI"] =
            [
                "gpt-5-mini",
                "gpt-5.6-sol",
                "gpt-5.6-terra",
                "gpt-5.6-luna",
                "gpt-5",
                "gpt-5-nano"
            ],
            ["Grok"] =
            [
                "grok-3-mini",
                "grok-4.5",
                "grok-4-fast-non-reasoning"
            ],
            ["Claude"] =
            [
                "claude-haiku-4-5",
                "claude-sonnet-5",
                "claude-opus-4-8",
                "claude-fable-5",
                "claude-sonnet-4-5",
                "claude-sonnet-4-6",
                "claude-opus-4-6"
            ],
            ["GitHubCopilot"] =
            [
                "gpt-5-mini",
                "auto",
                "claude-sonnet-4.6",
                "gpt-5.4",
                "gpt-5.3-codex",
                "gemini-3.1-pro-preview",
                "gemini-3.5-flash",
                "claude-haiku-4.5",
                "mai-code-1-flash"
            ],
            ["OpenAICompatible"] =
            [
                "gemma4:26b",
                "phi4:14b",
                "gemma3:27b-it-qat",
                "gemma3:27b",
                "gemma4:31b",
                "gemma4:e4b",
                "translategemma:4b",
                "gpt-oss:20b",
                "llama3.2:latest"
            ]
        };

    private readonly SettingsService _settingsService = new();
    private AppSettings _settings = new();
    private Process? _runningProcess;
    private int _lineCount = 0;
    private int _searchStart = 0;
    private static readonly Regex AnsiEscape = new(@"\x1B\[[0-9;]*[mGKHF]", RegexOptions.Compiled);

    public MainWindow()
    {
        InitializeComponent();
        FitWindowToWorkingArea();
        var ver = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
        TxtVersion.Text = ver is null ? string.Empty : $"v{ver.Major}.{ver.Minor}.{ver.Build}";
        _settings = _settingsService.Load();
        BindSettingsToUI();
        UpdateStatusBar("就緒 — 請設定工作目錄、DevOps 連線後點擊「開始審查」");
    }

    /// <summary>
    /// Keeps the complete window, including the native title bar, inside the
    /// usable desktop area on small displays and high-DPI configurations.
    /// </summary>
    private void FitWindowToWorkingArea()
    {
        const double margin = 24;
        var workArea = SystemParameters.WorkArea;
        var availableWidth = Math.Max(320, workArea.Width - margin * 2);
        var availableHeight = Math.Max(320, workArea.Height - margin * 2);

        MinWidth = Math.Min(MinWidth, availableWidth);
        MinHeight = Math.Min(MinHeight, availableHeight);
        MaxWidth = workArea.Width;
        MaxHeight = workArea.Height;

        Width = Math.Min(Width, availableWidth);
        Height = Math.Min(Height, availableHeight);
        Left = workArea.Left + (workArea.Width - Width) / 2;
        Top = workArea.Top + (workArea.Height - Height) / 2;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    //  UI ↔ Settings Binding
    // ─────────────────────────────────────────────────────────────────────────────

    private void BindSettingsToUI()
    {
        // Review tab
        TxtWorkingDir.Text = _settings.WorkingDirectory;
        TxtOrgUrl.Text = _settings.DevOpsOrgUrl;
        PwdAccessToken.Password = _settings.DevOpsAccessToken;
        TxtProject.Text = _settings.DevOpsProjectName;
        TxtRepositoryId.Text = _settings.DevOpsRepositoryId;
        TxtPRId.Text = _settings.DevOpsPRId;

        // Settings tab — AI Provider
        SelectComboItem(CmbAiProvider, _settings.AiProvider);
        TxtModelName.Text = _settings.ModelName;
        TxtGeminiKey.Text = _settings.GeminiAPIKey;
        TxtOpenAIKey.Text = _settings.OpenAIAPIKey;
        TxtOpenAICompatibleKey.Text = _settings.OpenAICompatibleAPIKey;
        TxtGrokKey.Text = _settings.GrokAPIKey;
        TxtClaudeKey.Text = _settings.ClaudeAPIKey;
        TxtCopilotToken.Text = _settings.GitHubCopilotToken;
        TxtCopilotServer.Text = _settings.GitHubCopilotServerAddress;
        TxtCopilotTimeout.Text = _settings.GitHubCopilotTimeout;
        TxtOpenAICompatibleUrl.Text = _settings.OpenAICompatibleBaseUrl;

        // Settings tab — Generation
        SelectComboItem(CmbInstructionSource, _settings.SystemInstructionSource);
        TxtResponseLanguage.Text = _settings.ResponseLanguage;
        TxtTemperature.Text = _settings.Temperature;
        TxtMaxTokens.Text = _settings.MaxOutputTokens;
        TxtSystemInstruction.Text = _settings.SystemInstruction;

        // Settings tab — Review Mode
        ChkThrottleMode.IsChecked = _settings.EnableThrottleMode;
        ChkShowReviewContent.IsChecked = _settings.ShowReviewContent;
        ChkIncrementalDiff.IsChecked = _settings.EnableIncrementalDiff;
        ChkWriteReviewResult.IsChecked = _settings.WriteReviewResult;
        ChkInlineComments.IsChecked = _settings.EnableInlineComments;
        ChkGroupInlineComments.IsChecked = _settings.GroupInlineCommentsByFile;
        ChkInlineStrictMode.IsChecked = _settings.InlineStrictMode;

        // Settings tab — Diff Filter
        TxtFileExtensions.Text = _settings.FileExtensions;
        TxtBinaryExtensions.Text = _settings.BinaryExtensions;
    }

    private void CollectSettingsFromUI()
    {
        _settings.WorkingDirectory = TxtWorkingDir.Text.Trim();
        _settings.DevOpsOrgUrl = TxtOrgUrl.Text.Trim();
        _settings.DevOpsAccessToken = PwdAccessToken.Password;
        _settings.DevOpsProjectName = TxtProject.Text.Trim();
        _settings.DevOpsRepositoryId = TxtRepositoryId.Text.Trim();
        _settings.DevOpsPRId = TxtPRId.Text.Trim();

        _settings.AiProvider = GetComboValue(CmbAiProvider) ?? "Google";
        _settings.ModelName = TxtModelName.Text.Trim();
        _settings.GeminiAPIKey = TxtGeminiKey.Text.Trim();
        _settings.OpenAIAPIKey = TxtOpenAIKey.Text.Trim();
        _settings.OpenAICompatibleAPIKey = TxtOpenAICompatibleKey.Text.Trim();
        _settings.GrokAPIKey = TxtGrokKey.Text.Trim();
        _settings.ClaudeAPIKey = TxtClaudeKey.Text.Trim();
        _settings.GitHubCopilotToken = TxtCopilotToken.Text.Trim();
        _settings.GitHubCopilotServerAddress = TxtCopilotServer.Text.Trim();
        _settings.GitHubCopilotTimeout = TxtCopilotTimeout.Text.Trim();
        _settings.OpenAICompatibleBaseUrl = TxtOpenAICompatibleUrl.Text.Trim();

        _settings.SystemInstructionSource = GetComboValue(CmbInstructionSource) ?? "Built-in";
        _settings.ResponseLanguage = TxtResponseLanguage.Text.Trim();
        _settings.Temperature = TxtTemperature.Text.Trim();
        _settings.MaxOutputTokens = TxtMaxTokens.Text.Trim();
        _settings.SystemInstruction = TxtSystemInstruction.Text;

        _settings.EnableThrottleMode = ChkThrottleMode.IsChecked ?? true;
        _settings.ShowReviewContent = ChkShowReviewContent.IsChecked ?? true;
        _settings.EnableIncrementalDiff = ChkIncrementalDiff.IsChecked ?? true;
        _settings.WriteReviewResult = ChkWriteReviewResult.IsChecked ?? false;
        _settings.EnableInlineComments = ChkInlineComments.IsChecked ?? true;
        _settings.GroupInlineCommentsByFile = ChkGroupInlineComments.IsChecked ?? false;
        _settings.InlineStrictMode = ChkInlineStrictMode.IsChecked ?? false;

        _settings.FileExtensions = TxtFileExtensions.Text.Trim();
        _settings.BinaryExtensions = TxtBinaryExtensions.Text.Trim();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    //  Event Handlers — Review Tab
    // ─────────────────────────────────────────────────────────────────────────────

    private void BtnBrowseDir_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFolderDialog
        {
            Title = "選擇 AI PR AutoReview 專案根目錄",
            InitialDirectory = TxtWorkingDir.Text
        };
        if (dialog.ShowDialog() == true)
            TxtWorkingDir.Text = dialog.FolderName;
    }

    private void BtnRun_Click(object sender, RoutedEventArgs e)
    {
        CollectSettingsFromUI();

        // Validate
        if (string.IsNullOrWhiteSpace(_settings.WorkingDirectory))
        {
            MessageBox.Show("請先設定工作目錄", "必填項目", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var distPath = Path.Combine(_settings.WorkingDirectory, "index.js");
        if (!File.Exists(distPath))
        {
            MessageBox.Show(
                $"找不到 dist/index.js:\n{distPath}\n\n請先在專案目錄執行 npm run build",
                "檔案不存在", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }

        // Auto-save settings before running
        _settingsService.Save(_settings);

        // Write temp .env
        var envPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "WpfCodeReview", "run.env");
        Directory.CreateDirectory(Path.GetDirectoryName(envPath)!);
        EnvFileWriter.WriteEnvFile(_settings, envPath);

        // Clear console & start
        TxtConsole.Clear();
        _lineCount = 0;

        AppendLine($"[WPF] ──────────────────────────────────────────");
        AppendLine($"[WPF] Working Dir : {_settings.WorkingDirectory}");
        AppendLine($"[WPF] Env File    : {envPath}");
        AppendLine($"[WPF] PR ID       : {_settings.DevOpsPRId}");
        AppendLine($"[WPF] Provider    : {_settings.AiProvider}  |  Model: {_settings.ModelName}");
        AppendLine($"[WPF] Started at  : {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
        AppendLine($"[WPF] ──────────────────────────────────────────");
        AppendLine("");

        SetRunningState(true);

        var psi = new ProcessStartInfo
        {
            FileName = "node",
            WorkingDirectory = _settings.WorkingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        psi.ArgumentList.Add($"--env-file={envPath}");
        psi.ArgumentList.Add(distPath);
        psi.ArgumentList.Add("--debug");

        _runningProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
        _runningProcess.OutputDataReceived += OnProcessOutput;
        _runningProcess.ErrorDataReceived += OnProcessError;
        _runningProcess.Exited += OnProcessExited;

        try
        {
            _runningProcess.Start();
            _runningProcess.BeginOutputReadLine();
            _runningProcess.BeginErrorReadLine();
        }
        catch (Exception ex)
        {
            AppendLine($"[ERROR] 無法啟動 node 程序: {ex.Message}");
            AppendLine("[HINT] 請確認 Node.js 已安裝並加入 PATH");
            SetRunningState(false);
        }
    }

    private void BtnStop_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            _runningProcess?.Kill(entireProcessTree: true);
        }
        catch { /* process may have already ended */ }

        AppendLine("\n[WPF] 已由使用者停止 (Stopped by user)");
        SetRunningState(false);
    }

    private void BtnClear_Click(object sender, RoutedEventArgs e)
    {
        TxtConsole.Clear();
        _lineCount = 0;
        UpdateLineCount();
        UpdateStatusBar("輸出已清除");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    //  Event Handlers — Settings Tab
    // ─────────────────────────────────────────────────────────────────────────────

    private void CmbAiProvider_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (TxtModelName is null) return;

        var provider = GetComboValue(CmbAiProvider);
        if (provider is null || !ModelSuggestions.TryGetValue(provider, out var suggestions))
        {
            TxtModelName.ItemsSource = null;
            return;
        }

        var currentModel = TxtModelName.Text.Trim();
        TxtModelName.ItemsSource = suggestions;

        // 切換 Provider 時選擇該類別的建議預設模型；ComboBox 仍可自由輸入。
        if (!suggestions.Contains(currentModel, StringComparer.OrdinalIgnoreCase))
        {
            TxtModelName.Text = suggestions[0];
        }
    }

    private void BtnSaveSettings_Click(object sender, RoutedEventArgs e)
    {
        CollectSettingsFromUI();
        _settingsService.Save(_settings);
        UpdateStatusBar("設定已儲存 ✓");
        MessageBox.Show("設定已成功儲存！", "儲存完成", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void BtnImportEnv_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            Title = "選擇 .env 檔案",
            Filter = "Env files (*.env)|*.env|All files (*.*)|*.*",
            DefaultExt = ".env",
            InitialDirectory = Path.Combine(_settings.WorkingDirectory, "devscripts")
        };
        if (dlg.ShowDialog() != true) return;

        try
        {
            EnvFileReader.ReadInto(dlg.FileName, _settings);
            BindSettingsToUI();
            UpdateStatusBar($"已匯入 {dlg.FileName}");
            MessageBox.Show("已成功匯入 .env 設定，請記得按「儲存設定」儲存。",
                "匯入完成", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"匯入失敗: {ex.Message}", "錯誤", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void BtnExportEnv_Click(object sender, RoutedEventArgs e)
    {
        CollectSettingsFromUI();

        var dlg = new SaveFileDialog
        {
            Title = "匯出 .env 檔案",
            FileName = "preview.env",
            Filter = "Env files (*.env)|*.env|All files (*.*)|*.*",
            DefaultExt = ".env"
        };
        if (dlg.ShowDialog() != true) return;

        EnvFileWriter.WriteEnvFile(_settings, dlg.FileName);
        UpdateStatusBar($"已匯出至 {dlg.FileName}");
        MessageBox.Show($"已匯出至:\n{dlg.FileName}", "匯出完成", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    //  Process Output Handlers
    // ─────────────────────────────────────────────────────────────────────────────

    private void OnProcessOutput(object sender, DataReceivedEventArgs e)
    {
        if (e.Data is null) return;
        Dispatcher.BeginInvoke(() => AppendLine(e.Data));
    }

    private void OnProcessError(object sender, DataReceivedEventArgs e)
    {
        if (e.Data is null) return;
        Dispatcher.BeginInvoke(() => AppendLine("[stderr] " + e.Data));
    }

    private void OnProcessExited(object? sender, EventArgs e)
    {
        Dispatcher.Invoke(() =>
        {
            var code = _runningProcess?.ExitCode ?? -1;
            AppendLine("");
            AppendLine($"[WPF] ──────────────────────────────────────────");
            AppendLine($"[WPF] 程序結束  Exit code: {code}   at {DateTime.Now:HH:mm:ss}");
            AppendLine($"[WPF] ──────────────────────────────────────────");
            SetRunningState(false);
            UpdateStatusBar(code == 0 ? "審查完成 ✓" : $"程序結束，Exit code: {code}");
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────────────────────

    private void AppendLine(string text)
    {
        var clean = AnsiEscape.Replace(text, "");
        TxtConsole.AppendText(clean + "\n");
        TxtConsole.ScrollToEnd();
        _lineCount++;
        UpdateLineCount();
    }

    private void SetRunningState(bool running)
    {
        BtnRun.IsEnabled = !running;
        BtnStop.IsEnabled = running;
        TxtRunStatus.Text = running ? "執行中… Running" : "就緒 Ready";
        StatusDot.Fill = running
            ? new SolidColorBrush(Color.FromRgb(0x10, 0x7C, 0x10))   // green
            : new SolidColorBrush(Color.FromRgb(0x99, 0x99, 0x99));   // grey
        if (!running) _runningProcess = null;
    }

    private void UpdateStatusBar(string message)
    {
        TxtStatusBar.Text = message;
    }

    private void UpdateLineCount()
    {
        TxtLineCount.Text = $"輸出行數: {_lineCount}";
    }

    private static void SelectComboItem(ComboBox combo, string value)
    {
        foreach (var item in combo.Items)
        {
            if (item is ComboBoxItem ci
                && (ci.Tag?.ToString() == value || ci.Content?.ToString() == value))
            {
                combo.SelectedItem = ci;
                return;
            }
        }
        if (combo.Items.Count > 0) combo.SelectedIndex = 0;
    }

    private static string? GetComboValue(ComboBox combo)
    {
        var item = combo.SelectedItem as ComboBoxItem;
        return item?.Tag?.ToString() ?? item?.Content?.ToString();
    }

    private void TxtSearch_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == System.Windows.Input.Key.Enter)
        {
            bool back = (e.KeyboardDevice.Modifiers & System.Windows.Input.ModifierKeys.Shift) != 0;
            FindInConsole(forward: !back);
            e.Handled = true;
        }
    }

    private void TxtSearch_TextChanged(object sender, TextChangedEventArgs e)
    {
        _searchStart = 0;
        TxtSearchResult.Text = string.Empty;
    }

    private void BtnFindNext_Click(object sender, RoutedEventArgs e) => FindInConsole(forward: true);
    private void BtnFindPrev_Click(object sender, RoutedEventArgs e) => FindInConsole(forward: false);

    private void FindInConsole(bool forward)
    {
        var keyword = TxtSearch.Text;
        if (string.IsNullOrEmpty(keyword)) return;

        var text = TxtConsole.Text;
        if (text.Length == 0) return;

        int idx;
        if (forward)
        {
            int start = _searchStart < text.Length ? _searchStart : 0;
            idx = text.IndexOf(keyword, start, StringComparison.OrdinalIgnoreCase);
            if (idx < 0 && start > 0)
                idx = text.IndexOf(keyword, 0, StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            int start = _searchStart > 0 ? _searchStart - 1 : text.Length - 1;
            if (start >= text.Length) start = text.Length - 1;
            idx = text.LastIndexOf(keyword, start, StringComparison.OrdinalIgnoreCase);
            if (idx < 0)
                idx = text.LastIndexOf(keyword, text.Length - 1, StringComparison.OrdinalIgnoreCase);
        }

        if (idx < 0)
        {
            TxtSearchResult.Text = "找不到";
            return;
        }

        _searchStart = forward ? idx + keyword.Length : idx;
        TxtConsole.Focus();
        TxtConsole.Select(idx, keyword.Length);
        TxtConsole.ScrollToLine(TxtConsole.GetLineIndexFromCharacterIndex(idx));

        int count = 0, pos = 0;
        while ((pos = text.IndexOf(keyword, pos, StringComparison.OrdinalIgnoreCase)) >= 0)
        {
            count++;
            pos += keyword.Length;
        }
        TxtSearchResult.Text = $"共 {count} 筆";
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        try { _runningProcess?.Kill(entireProcessTree: true); } catch { }
        base.OnClosing(e);
    }
}
