using System;
using System.Text.Json.Serialization;

namespace KnouxRepair.Models
{
    public class ReportEntry
    {
        [JsonPropertyName("ToolId")]
        public string ToolId { get; set; }

        [JsonPropertyName("ToolName")]
        public string ToolName { get; set; }

        [JsonPropertyName("Category")]
        public string Category { get; set; }

        [JsonPropertyName("RiskLevel")]
        public string RiskLevel { get; set; }

        [JsonPropertyName("StartedAt")]
        public string StartedAt { get; set; }

        [JsonPropertyName("FinishedAt")]
        public string FinishedAt { get; set; }

        [JsonPropertyName("Duration")]
        public string Duration { get; set; }

        [JsonPropertyName("Status")]
        public string Status { get; set; }

        [JsonPropertyName("ExitCode")]
        public int ExitCode { get; set; }

        [JsonPropertyName("ChangedSystem")]
        public bool ChangedSystem { get; set; }

        [JsonPropertyName("RestartNeeded")]
        public bool RestartNeeded { get; set; }

        [JsonPropertyName("ItemsFound")]
        public int ItemsFound { get; set; }

        [JsonPropertyName("ItemsProcessed")]
        public int ItemsProcessed { get; set; }

        [JsonPropertyName("BytesPotentiallyRecoverable")]
        public long BytesPotentiallyRecoverable { get; set; }

        [JsonPropertyName("BytesQuarantined")]
        public long BytesQuarantined { get; set; }

        [JsonPropertyName("BytesPermanentlyDeleted")]
        public long BytesPermanentlyDeleted { get; set; }

        [JsonPropertyName("BytesActuallyRecovered")]
        public long BytesActuallyRecovered { get; set; }

        [JsonPropertyName("BackupPath")]
        public string BackupPath { get; set; }

        [JsonPropertyName("QuarantinePath")]
        public string QuarantinePath { get; set; }

        [JsonPropertyName("ReportPath")]
        public string ReportPath { get; set; }

        [JsonPropertyName("VerificationPerformed")]
        public bool VerificationPerformed { get; set; }

        [JsonPropertyName("VerificationResult")]
        public string VerificationResult { get; set; }

        [JsonPropertyName("ErrorMessage")]
        public string ErrorMessage { get; set; }

        public string FolderName { get; set; }
    }
}
