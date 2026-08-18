using System.Text.Json.Serialization;

namespace KnouxRepair.Models
{
    public class ToolInfo
    {
        [JsonPropertyName("ToolId")]
        public string ToolId { get; set; }

        [JsonPropertyName("Category")]
        public string Category { get; set; }

        [JsonPropertyName("ScriptPath")]
        public string ScriptPath { get; set; }

        [JsonPropertyName("EnglishName")]
        public string EnglishName { get; set; }

        [JsonPropertyName("ArabicName")]
        public string ArabicName { get; set; }

        [JsonPropertyName("Purpose")]
        public string Purpose { get; set; }

        [JsonPropertyName("RiskLevel")]
        public string RiskLevel { get; set; }

        [JsonPropertyName("RequiresAdmin")]
        public bool RequiresAdmin { get; set; }

        [JsonPropertyName("RequiresRestart")]
        public bool RequiresRestart { get; set; }

        [JsonPropertyName("OfflineCapability")]
        public string OfflineCapability { get; set; }

        [JsonPropertyName("BackupMethod")]
        public string BackupMethod { get; set; }

        [JsonPropertyName("RollbackMethod")]
        public string RollbackMethod { get; set; }

        [JsonPropertyName("AnalyzeOnlySupported")]
        public bool AnalyzeOnlySupported { get; set; }

        [JsonPropertyName("WhatIfSupported")]
        public bool WhatIfSupported { get; set; }

        [JsonPropertyName("TestResult")]
        public string TestResult { get; set; }
    }
}
