using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using KnouxRepair.Services;

namespace KnouxRepair.Models
{
    public enum ToolActionKind { Preview, Analyze, WhatIf, Execute, Cancel }

    public sealed class ToolActionDescriptor
    {
        public ToolActionKind Kind { get; init; }
        public string Label { get; init; }
        public bool RequiresConfirmation { get; init; }
        public bool RequiresSelection { get; init; }
        public string Arguments { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
    }

    public sealed class ToolCapabilityProfile
    {
        public ToolInfo Tool { get; init; }
        public string CategoryAccentKey { get; init; }
        public string CategoryIcon { get; init; }
        public bool CanAnalyze { get; init; }
        public bool CanWhatIf { get; init; }
        public bool RequiresSelection { get; init; }
        public bool CanCancel => PowerShellService.IsRunning;
        public bool HasBackupInfo { get; init; }
        public bool HasRollbackInfo { get; init; }
        public bool ProducesReport { get; init; }
        public bool ProducesQuarantine { get; init; }
        public bool SupportsRecovery { get; init; }
        public IReadOnlyList<ToolActionDescriptor> Actions { get; init; }
        public IReadOnlyList<string> CapabilityChips { get; init; }
        public string PrimaryActionLabel { get; init; }
        public string PreviewSummary { get; init; }
        public string PreservationSummary { get; init; }
        public string RecoverySummary { get; init; }
        public string ExpectedOutputSummary { get; init; }
        public string InputParameters { get; init; }
        public bool ScriptExists { get; init; }
        public bool HasInteractivePrompt { get; init; }
    }

    public sealed class ToolExecutionRequest
    {
        public ToolInfo Tool { get; init; }
        public ToolActionDescriptor Action { get; init; }
        public string Selection { get; init; }
        public bool AnalyzeOnly => Action?.Kind == ToolActionKind.Analyze;
        public string Arguments
        {
            get
            {
                var args = Action?.Arguments ?? string.Empty;
                if (!string.IsNullOrWhiteSpace(Selection))
                {
                    var escaped = Selection.Replace("'", "''");
                    args = string.IsNullOrWhiteSpace(args) ? $"-Selection '{escaped}'" : $"{args} -Selection '{escaped}'";
                }
                return args;
            }
        }
    }

    internal sealed class ScriptAnalysis
    {
        public string Source { get; init; } = string.Empty;
        public bool Exists { get; init; }
        public bool SupportsAnalyze { get; init; }
        public bool SupportsWhatIf { get; init; }
        public bool RequiresSelection { get; init; }
        public bool HasInteractivePrompt { get; init; }
        public bool ProducesReport { get; init; }
        public bool ProducesQuarantine { get; init; }
        public bool SupportsRecovery { get; init; }
        public string Parameters { get; init; } = string.Empty;
        public string PrimaryOperation { get; init; } = "Run";
    }

    public static class ToolCapabilityResolver
    {
        private static readonly ConcurrentDictionary<string, ScriptAnalysis> AnalysisCache = new(StringComparer.OrdinalIgnoreCase);
        private static readonly Regex Parameter = new(@"(?im)^\s*(?:\[Parameter[^\]]*\]\s*)?\[(?:switch|string|int|bool|array|object)[^\]]*\]\s*\$(\w+)", RegexOptions.Compiled);
        private static readonly Regex Selection = new(@"(?i)(?:\$Selection\b|\bSelectionPath\b|Read-Host|PromptForChoice)", RegexOptions.Compiled);
        private static readonly Regex WhatIf = new(@"(?i)\$WhatIf\b|\bSupportsShouldProcess\b", RegexOptions.Compiled);
        private static readonly Regex Analyze = new(@"(?i)\$AnalyzeOnly\b", RegexOptions.Compiled);
        private static readonly Regex Prompt = new(@"(?i)Read-Host|PromptForChoice|cmd\s*/c\s+pause|\-Confirm\b", RegexOptions.Compiled);
        private static readonly Regex Report = new(@"(?i)Export-Csv|Export-Clixml|Out-File|ConvertTo-Json|Set-Content.*(?:report|results|summary)|Write-KnouxReport", RegexOptions.Compiled);
        private static readonly Regex Quarantine = new(@"(?i)Move-Knoux.*Quarantine|Quarantine", RegexOptions.Compiled);
        private static readonly Regex Recovery = new(@"(?i)Restore-Knoux|Rollback|Recovery", RegexOptions.Compiled);

        public static ToolCapabilityProfile Resolve(ToolInfo tool)
        {
            if (tool == null) throw new ArgumentNullException(nameof(tool));
            var analysis = GetAnalysis(tool.ScriptPath);
            var canAnalyze = analysis.Exists && tool.AnalyzeOnlySupported && analysis.SupportsAnalyze;
            var canWhatIf = analysis.Exists && tool.WhatIfSupported && analysis.SupportsWhatIf;
            var backup = NormalizeCapability(tool.BackupMethod);
            var rollback = NormalizeCapability(tool.RollbackMethod);
            var primary = analysis.PrimaryOperation;
            var actions = new List<ToolActionDescriptor>
            {
                new() { Kind = ToolActionKind.Preview, Label = "Preview", Description = "Inspect the manifest record, script parameters, capability contract, and last execution evidence." }
            };
            if (canAnalyze)
                actions.Add(new() { Kind = ToolActionKind.Analyze, Label = "Analyze", RequiresSelection = analysis.RequiresSelection, Description = "Run the script through its declared -AnalyzeOnly parameter." });
            if (canWhatIf)
                actions.Add(new() { Kind = ToolActionKind.WhatIf, Label = "What-If", RequiresSelection = analysis.RequiresSelection, Arguments = "-WhatIf", Description = "Run the script through its declared -WhatIf parameter." });
            actions.Add(new() { Kind = ToolActionKind.Execute, Label = primary, RequiresConfirmation = IsSensitive(tool), RequiresSelection = analysis.RequiresSelection, Description = tool.Purpose ?? "Not specified" });

            var chips = new List<string>();
            if (tool.RiskLevel?.Equals("READ_ONLY", StringComparison.OrdinalIgnoreCase) == true) chips.Add("Read only");
            if (canAnalyze) chips.Add("Analyze");
            if (canWhatIf) chips.Add("What-If");
            if (analysis.RequiresSelection) chips.Add("Selection");
            if (tool.RequiresAdmin) chips.Add("Administrator");
            if (tool.RequiresRestart) chips.Add("Restart");
            if (analysis.ProducesReport) chips.Add("Report");
            if (analysis.ProducesQuarantine) chips.Add("Quarantine");
            if (backup != null || rollback != null || analysis.SupportsRecovery) chips.Add("Recovery");
            if (!analysis.Exists) chips.Add("Script unavailable");

            return new ToolCapabilityProfile
            {
                Tool = tool,
                CategoryAccentKey = GetCategoryAccentKey(tool.Category),
                CategoryIcon = tool.CategoryIcon,
                CanAnalyze = canAnalyze,
                CanWhatIf = canWhatIf,
                RequiresSelection = analysis.RequiresSelection,
                HasBackupInfo = backup != null,
                HasRollbackInfo = rollback != null,
                ProducesReport = analysis.ProducesReport,
                ProducesQuarantine = analysis.ProducesQuarantine,
                SupportsRecovery = analysis.SupportsRecovery,
                Actions = actions,
                CapabilityChips = chips,
                PrimaryActionLabel = primary,
                PreviewSummary = string.IsNullOrWhiteSpace(tool.Purpose) ? "Not specified" : tool.Purpose,
                PreservationSummary = backup ?? "Not specified",
                RecoverySummary = rollback ?? "Not specified",
                ExpectedOutputSummary = analysis.Exists && analysis.Source.Contains("Write-KnouxResult", StringComparison.OrdinalIgnoreCase)
                    ? "Knoux result envelope, live stdout, live stderr, exit code, elapsed time, and detected artifacts when emitted."
                    : "Not specified",
                InputParameters = string.IsNullOrWhiteSpace(analysis.Parameters) ? "Not specified" : analysis.Parameters,
                ScriptExists = analysis.Exists,
                HasInteractivePrompt = analysis.HasInteractivePrompt
            };
        }

        private static ScriptAnalysis GetAnalysis(string scriptPath)
        {
            var resolved = ManifestService.ResolveScriptPath(scriptPath) ?? string.Empty;
            return AnalysisCache.GetOrAdd(resolved, AnalyzeScript);
        }

        private static ScriptAnalysis AnalyzeScript(string resolvedPath)
        {
            if (string.IsNullOrWhiteSpace(resolvedPath) || !File.Exists(resolvedPath))
                return new ScriptAnalysis();

            var source = File.ReadAllText(resolvedPath);
            return new ScriptAnalysis
            {
                Source = source,
                Exists = true,
                SupportsAnalyze = Analyze.IsMatch(source),
                SupportsWhatIf = WhatIf.IsMatch(source),
                RequiresSelection = Selection.IsMatch(source),
                HasInteractivePrompt = Prompt.IsMatch(source),
                ProducesReport = Report.IsMatch(source),
                ProducesQuarantine = Quarantine.IsMatch(source),
                SupportsRecovery = Recovery.IsMatch(source),
                Parameters = string.Join(", ", Parameter.Matches(source).Select(match => match.Groups[1].Value).Distinct(StringComparer.OrdinalIgnoreCase)),
                PrimaryOperation = ResolvePrimaryOperation(source)
            };
        }

        private static string ResolvePrimaryOperation(string source)
        {
            if (Recovery.IsMatch(source)) return "Restore";
            if (Regex.IsMatch(source, @"(?i)\bMove-Item\b|Move-Knoux.*Quarantine")) return "Move";
            if (Regex.IsMatch(source, @"(?i)\bClear-RecycleBin\b")) return "Empty Recycle Bin";
            if (Regex.IsMatch(source, @"(?i)\bRemove-Item\b|\bClear-Content\b|\bClear-")) return "Clean";
            if (Regex.IsMatch(source, @"(?i)\/RestoreHealth|\bsfc\.exe\b.*\/scannow|\bRepair-")) return "Repair";
            if (Regex.IsMatch(source, @"(?i)\/ScanHealth|\bStart-MpScan\b|\bScan-")) return "Scan";
            if (Regex.IsMatch(source, @"(?i)\/verifyonly|\/CheckHealth")) return "Verify";
            if (Regex.IsMatch(source, @"(?i)\bTest-Connection\b|\bTest-NetConnection\b|\bTest-")) return "Test";
            if (Regex.IsMatch(source, @"(?i)\bipconfig\b.*\/renew")) return "Renew IP";
            if (Regex.IsMatch(source, @"(?i)\bipconfig\b.*\/flushdns")) return "Flush DNS";
            if (Regex.IsMatch(source, @"(?i)\bnetsh\b.*\breset\b|\bReset-")) return "Reset";
            if (Regex.IsMatch(source, @"(?i)\bOptimize-|\bSet-Net")) return "Optimize";
            if (Report.IsMatch(source)) return "Generate Report";
            if (Regex.IsMatch(source, @"(?i)\bGet-|\bMeasure-|\bFind-")) return "Analyze";
            if (Regex.IsMatch(source, @"(?i)\bSet-|\bEnable-|\bDisable-")) return "Configure";
            return "Run";
        }

        public static bool IsSensitive(ToolInfo tool) => tool != null &&
            (tool.RequiresAdmin || tool.RequiresRestart || new[] { "DESTRUCTIVE", "SYSTEM_REPAIR", "REBOOT_REQUIRED" }
                .Contains(tool.RiskLevel ?? string.Empty, StringComparer.OrdinalIgnoreCase));

        public static string GetCategoryAccentKey(string category) => (category ?? string.Empty).Length >= 2
            ? category.Substring(0, 2) switch
            {
                "01" => "BrushSkyBlue", "02" => "BrushGreen", "03" => "BrushCyan", "04" => "BrushAmber",
                "05" => "BrushPink", "06" => "BrushPurple", "07" => "BrushOrange", "08" => "BrushRed",
                "09" => "BrushTeal", "10" => "BrushIndigo", _ => "BrushCyan"
            }
            : "BrushCyan";

        private static string NormalizeCapability(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var normalized = value.Trim();
            return normalized.StartsWith("None", StringComparison.OrdinalIgnoreCase) ? null : normalized;
        }
    }
}
