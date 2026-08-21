using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using KnouxRepair.Models;
using KnouxRepair.Mvvm;

namespace KnouxRepair.ViewModels
{
    public class DashboardViewModel : ViewModelBase
    {
        private readonly List<ToolInfo> _tools;
        private double _cpuPercent;
        private double _ramPercent;
        private double _diskPercent;
        private string _ramLabel;
        private string _diskLabel;
        private string _uptimeLabel = "-";
        private bool _admin = true;
        private int _reportCount;

        public DashboardViewModel()
        {
            _tools = Services.ManifestService.Tools;
            ComputeMetrics();
            RefreshHealth();
            RefreshReportCountAsync();
        }

        public int TotalTools { get; private set; }
        public int SafeTools { get; private set; }
        public int AdminTools { get; private set; }
        public int ReportCount { get => _reportCount; private set => SetProperty(ref _reportCount, value); }
        public int ReadOnlyTools { get; private set; }
        public int DestructiveTools { get; private set; }
        public int RebootRequiredTools { get; private set; }
        public string LastStatus { get; private set; } = "StatusReady";

        public ObservableCollection<CategoryStat> CategoryStats { get; } = new ObservableCollection<CategoryStat>();

        // === System Health ===
        public double CpuPercent { get => _cpuPercent; private set => SetProperty(ref _cpuPercent, value); }
        public double RamPercent { get => _ramPercent; private set => SetProperty(ref _ramPercent, value); }
        public double DiskPercent { get => _diskPercent; private set => SetProperty(ref _diskPercent, value); }
        public string RamLabel { get => _ramLabel; private set => SetProperty(ref _ramLabel, value); }
        public string DiskLabel { get => _diskLabel; private set => SetProperty(ref _diskLabel, value); }
        public string UptimeLabel { get => _uptimeLabel; private set => SetProperty(ref _uptimeLabel, value); }
        public bool IsAdmin
        {
            get => _admin;
            private set
            {
                if (SetProperty(ref _admin, value))
                    OnPropertyChanged(nameof(IsNotAdmin));
            }
        }
        public bool IsNotAdmin => !IsAdmin;

        public void RefreshHealth()
        {
            try
            {
                var cpu = Core.SystemInfoProvider.CpuUsagePercent();
                CpuPercent = Math.Round(cpu ?? 0, 1);

                var totalRam = Core.SystemInfoProvider.TotalRamMb;
                var availRam = Core.SystemInfoProvider.AvailableRamMb;
                if (totalRam > 0)
                {
                    RamPercent = Math.Round(((double)(totalRam - availRam) * 100.0) / totalRam, 1);
                    RamLabel = $"{FormatMb(availRam)} / {FormatMb(totalRam)}";
                }

                var drive = Core.SystemInfoProvider.RootDrive;
                if (drive != null)
                {
                    var total = drive.TotalSize;
                    var free = drive.AvailableFreeSpace;
                    if (total > 0)
                    {
                        DiskPercent = Math.Round(100.0 - ((double)free * 100.0 / total), 1);
                        DiskLabel = $"{FormatBytes(free)} free of {FormatBytes(total)}";
                    }
                }

                UptimeLabel = Core.SystemInfoProvider.UptimeLabel;
                IsAdmin = Core.SystemInfoProvider.IsAdministrator;
            }
            catch
            {
                // Health stays at last known values if sampling fails.
            }
        }

        private static string FormatBytes(long bytes)
        {
            const double k = 1024.0;
            if (bytes >= k * k * k) return $"{bytes / (k * k * k):0.0} GB";
            return $"{bytes / (k * k):0} MB";
        }

        private static string FormatMb(long mb)
        {
            if (mb >= 1024) return $"{mb / 1024.0:0.0} GB";
            return $"{mb} MB";
        }

        private void ComputeMetrics()
        {
            TotalTools = _tools.Count;
            SafeTools = _tools.Count(t => t.RiskLevel == "READ_ONLY");
            AdminTools = _tools.Count(t => t.RequiresAdmin);
            ReadOnlyTools = _tools.Count(t => t.RiskLevel == "READ_ONLY");
            DestructiveTools = _tools.Count(t => t.RiskLevel == "DESTRUCTIVE");
            RebootRequiredTools = _tools.Count(t => t.RequiresRestart);

            // Report enumeration is intentionally deferred to a background task.

            // Category breakdown
            var cats = _tools.GroupBy(t => t.Category).OrderBy(g => g.Key);
            foreach (var cat in cats)
            {
                CategoryStats.Add(new CategoryStat
                {
                    Name = FormatCategoryName(cat.Key),
                    Total = cat.Count(),
                    Safe = cat.Count(t => t.RiskLevel == "READ_ONLY"),
                    Risky = cat.Count(t => t.RiskLevel == "DESTRUCTIVE" || t.RiskLevel == "SYSTEM_REPAIR")
                });
            }
        }

        private void RefreshReportCountAsync()
        {
            _ = Task.Run(() =>
            {
                var count = 0;
                try
                {
                    var reportsDir = Services.ReportsService.ReportsRoot;
                    if (Directory.Exists(reportsDir)) count = Directory.EnumerateDirectories(reportsDir).Take(100000).Count();
                }
                catch { count = 0; }

                try
                {
                    System.Windows.Application.Current?.Dispatcher.BeginInvoke(new Action(() => ReportCount = count));
                }
                catch { }
            });
        }

        private static string FormatCategoryName(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return raw;
            // "05-Duplicate-Files" -> "Duplicate Files"
            var dash = raw.IndexOf('-');
            return dash >= 0 ? raw.Substring(dash + 1).Replace('-', ' ') : raw;
        }
    }

    public class CategoryStat
    {
        public string Name { get; set; }
        public int Total { get; set; }
        public int Safe { get; set; }
        public int Risky { get; set; }
    }
}
