using System.Text.Json.Serialization;

namespace KnouxRepair.Models
{
    public class QuarantineEntry
    {
        [JsonPropertyName("SchemaVersion")]
        public string SchemaVersion { get; set; }

        [JsonPropertyName("QuarantineId")]
        public string QuarantineId { get; set; }

        [JsonPropertyName("SessionId")]
        public string SessionId { get; set; }

        [JsonPropertyName("ToolId")]
        public string ToolId { get; set; }

        [JsonPropertyName("ItemType")]
        public string ItemType { get; set; }

        [JsonPropertyName("OriginalPath")]
        public string OriginalPath { get; set; }

        [JsonPropertyName("OriginalName")]
        public string OriginalName { get; set; }

        [JsonPropertyName("OriginalSize")]
        public long OriginalSize { get; set; }

        [JsonPropertyName("OriginalHash")]
        public string OriginalHash { get; set; }

        [JsonPropertyName("DirectoryFileCount")]
        public int DirectoryFileCount { get; set; }

        [JsonPropertyName("QuarantinedAt")]
        public string QuarantinedAt { get; set; }

        [JsonPropertyName("TransactionState")]
        public string TransactionState { get; set; }

        // Not in JSON — set by the scanner
        public string QuarantineDir { get; set; }

        public bool IsOk => string.Equals(TransactionState, "COMMITTED", System.StringComparison.OrdinalIgnoreCase);
    }
}