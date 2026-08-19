using System.Text.Json.Serialization;

namespace KnouxRepair.Models
{
    public class ToolInfo
    {
        [JsonPropertyName("ToolId")] public string ToolId { get; set; }
        [JsonPropertyName("Category")] public string Category { get; set; }
        [JsonPropertyName("ScriptPath")] public string ScriptPath { get; set; }
        [JsonPropertyName("EnglishName")] public string EnglishName { get; set; }
        [JsonPropertyName("ArabicName")] public string ArabicName { get; set; }
        [JsonIgnore] public string DisplayName => Services.ThemeService.IsArabic(Services.SettingsService.Settings.Language) && !string.IsNullOrWhiteSpace(ArabicName) ? ArabicName : EnglishName;
        [JsonIgnore] public string CategoryIcon => (ToolId ?? string.Empty).Substring(0, System.Math.Min(2, (ToolId ?? string.Empty).Length)) switch
        {
            "SM" => "\uE702", "SC" => "\uE107", "NI" => "\uE701", "PA" => "\uE8C8", "DF" => "\uE169", "DS" => "\uE6D9", "SP" => "\uE886", "PF" => "\uE936", "SE" => "\uE707", _ => "\uE8F4"
        };
        [JsonIgnore] public string CategoryDisplayName
        {
            get { var value = Category ?? ""; var dash = value.IndexOf('-'); return dash >= 0 ? value.Substring(dash + 1).Replace('-', ' ') : value; }
        }
        [JsonIgnore] public string RiskDisplayName
        {
            get
            {
                var arabic = Services.ThemeService.IsArabic(Services.SettingsService.Settings.Language);
                return (RiskLevel ?? string.Empty).ToUpperInvariant() switch
                {
                    "READ_ONLY" => arabic ? "للقراءة فقط" : "Read only",
                    "SAFE_CLEANUP" => arabic ? "تنظيف آمن" : "Safe cleanup",
                    "SYSTEM_REPAIR" => arabic ? "إصلاح النظام" : "System repair",
                    "REBOOT_REQUIRED" => arabic ? "يتطلب إعادة تشغيل" : "Restart required",
                    "DESTRUCTIVE" => arabic ? "تغيير حساس" : "Sensitive change",
                    _ => arabic ? "مستوى مخاطر غير معروف" : "Unknown risk"
                };
            }
        }
        [JsonPropertyName("Purpose")] public string Purpose { get; set; }
        [JsonPropertyName("RiskLevel")] public string RiskLevel { get; set; }
        [JsonPropertyName("RequiresAdmin")] public bool RequiresAdmin { get; set; }
        [JsonPropertyName("RequiresRestart")] public bool RequiresRestart { get; set; }
        [JsonPropertyName("OfflineCapability")] public string OfflineCapability { get; set; }
        [JsonPropertyName("BackupMethod")] public string BackupMethod { get; set; }
        [JsonPropertyName("RollbackMethod")] public string RollbackMethod { get; set; }
        [JsonPropertyName("AnalyzeOnlySupported")] public bool AnalyzeOnlySupported { get; set; }
        [JsonPropertyName("WhatIfSupported")] public bool WhatIfSupported { get; set; }
        [JsonPropertyName("TestResult")] public string TestResult { get; set; }
        [JsonIgnore] public ToolCapabilityProfile Capability => ToolCapabilityResolver.Resolve(this);
        [JsonIgnore] public string PrimaryActionLabel => Capability.PrimaryActionLabel;
        [JsonIgnore] public string CategoryAccentKey => Capability.CategoryAccentKey;
        [JsonIgnore] public System.Windows.Media.Brush CategoryAccentBrush => System.Windows.Application.Current?.TryFindResource(CategoryAccentKey) as System.Windows.Media.Brush;
        [JsonIgnore] public string ExecutionState => ToolExecutionEvidence.Get(ToolId).State;
        [JsonIgnore] public string ExecutionSummary
        {
            get
            {
                var e = ToolExecutionEvidence.Get(ToolId);
                if (e.State == "Idle") return "Not executed";
                var elapsed = e.Elapsed.HasValue ? $" · {e.Elapsed.Value.TotalSeconds:0.0}s" : string.Empty;
                return e.ExitCode.HasValue ? $"{e.State} · exit {e.ExitCode.Value}{elapsed}" : e.State + elapsed;
            }
        }
    }
}
