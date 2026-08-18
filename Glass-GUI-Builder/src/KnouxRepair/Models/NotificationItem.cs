using System;

namespace KnouxRepair.Models
{
    public class NotificationItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string Title { get; set; }
        public string Message { get; set; }
        public string Severity { get; set; } // Info | Success | Warning | Error
        public DateTime Timestamp { get; set; } = DateTime.Now;

        public string TimeLabel => Timestamp.ToString("HH:mm:ss");
    }
}