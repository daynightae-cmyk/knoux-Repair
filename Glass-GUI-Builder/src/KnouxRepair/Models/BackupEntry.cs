namespace KnouxRepair.Models
{
    public class BackupEntry
    {
        public string ToolId { get; set; }
        public string FolderName { get; set; }
        public string BackupPath { get; set; }
        public long SizeBytes { get; set; }
        public int ItemCount { get; set; }
        public string Timestamp { get; set; }
    }
}