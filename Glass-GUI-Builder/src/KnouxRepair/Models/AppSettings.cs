using System.Text.Json.Serialization;

namespace KnouxRepair.Models
{
    public class AppSettings
    {
        [JsonPropertyName("language")]
        public string Language { get; set; } = "English";

        [JsonPropertyName("theme")]
        public string Theme { get; set; } = "DarkGlass";

        [JsonPropertyName("reducedMotion")]
        public bool ReducedMotion { get; set; } = false;

        [JsonPropertyName("compactNav")]
        public bool CompactNav { get; set; } = false;

        [JsonPropertyName("analyzeOnlyDefault")]
        public bool AnalyzeOnlyDefault { get; set; } = true;

        [JsonPropertyName("consoleAutoScroll")]
        public bool ConsoleAutoScroll { get; set; } = true;

        [JsonPropertyName("consoleFontSize")]
        public double ConsoleFontSize { get; set; } = 13;

        [JsonPropertyName("maxReportHistory")]
        public int MaxReportHistory { get; set; } = 200;

        [JsonPropertyName("reportsAutoOpen")]
        public bool ReportsAutoOpen { get; set; } = true;
    }
}
