using System;
using System.Collections.ObjectModel;
using KnouxRepair.Models;

namespace KnouxRepair.Services
{
    public static class NotificationService
    {
        private const int MaxItems = 50;

        public static ObservableCollection<NotificationItem> Items { get; } = new ObservableCollection<NotificationItem>();

        public static event Action<NotificationItem> Posted;

        public static void Post(string title, string message, string severity = "Info")
        {
            var item = new NotificationItem { Title = title, Message = message, Severity = severity };
            Items.Insert(0, item);

            while (Items.Count > MaxItems)
                Items.RemoveAt(Items.Count - 1);

            Posted?.Invoke(item);
        }
    }
}