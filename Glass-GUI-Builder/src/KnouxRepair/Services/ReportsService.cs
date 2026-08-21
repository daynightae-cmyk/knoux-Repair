using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using KnouxRepair.Models;

namespace KnouxRepair.Services
{
    public static class ReportsService
    {
        private const int MaxReportsInUi = 250;
        private static FileSystemWatcher _watcher;
        private static Timer _refreshTimer;
        private static readonly object _lock = new object();
        private static int _refreshQueued;

        public static ObservableCollection<ReportEntry> Reports { get; } = new ObservableCollection<ReportEntry>();
        public static event Action<ReportEntry> NewReportDetected;

        public static string ReportsRoot
        {
            get
            {
                var dir = AppDomain.CurrentDomain.BaseDirectory;
                while (dir != null)
                {
                    var reportsDir = Path.Combine(dir, "Reports");
                    if (Directory.Exists(reportsDir)) return reportsDir;
                    dir = Directory.GetParent(dir)?.FullName;
                }
                return Path.Combine(ManifestService.ProjectRoot, "Reports");
            }
        }

        // This method intentionally returns immediately. A packaged app must paint its shell
        // before report indexing touches potentially large or slow user report folders.
        public static void StartWatching()
        {
            if (_watcher != null) return;
            var root = ReportsRoot;
            if (!Directory.Exists(root))
            {
                try { Directory.CreateDirectory(root); }
                catch { return; }
            }

            _watcher = new FileSystemWatcher(root, "*")
            {
                NotifyFilter = NotifyFilters.DirectoryName,
                IncludeSubdirectories = false,
                EnableRaisingEvents = true
            };
            _watcher.Created += OnFolderCreated;

            QueueRefresh();
            _refreshTimer = new Timer(_ => QueueRefresh(), null,
                TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(15));
        }

        public static void StopWatching()
        {
            _watcher?.Dispose();
            _watcher = null;
            _refreshTimer?.Dispose();
            _refreshTimer = null;
            Interlocked.Exchange(ref _refreshQueued, 0);
        }

        private static void OnFolderCreated(object sender, FileSystemEventArgs e)
        {
            _ = Task.Run(async () =>
            {
                await Task.Delay(500).ConfigureAwait(false);
                var entry = ParseReportFolder(e.FullPath);
                if (entry == null) return;
                SafeDispatch(() =>
                {
                    Reports.Insert(0, entry);
                    while (Reports.Count > MaxReportsInUi) Reports.RemoveAt(Reports.Count - 1);
                    NewReportDetected?.Invoke(entry);
                });
            });
        }

        public static void RefreshReports() => QueueRefresh();

        private static void QueueRefresh()
        {
            if (Interlocked.Exchange(ref _refreshQueued, 1) != 0) return;
            _ = Task.Run(() =>
            {
                try { RefreshReportsCore(); }
                finally { Volatile.Write(ref _refreshQueued, 0); }
            });
        }

        private static void RefreshReportsCore()
        {
            var root = ReportsRoot;
            if (!Directory.Exists(root)) return;
            var entries = new List<ReportEntry>();
            try
            {
                var recentDirectories = Directory.EnumerateDirectories(root)
                    .OrderByDescending(Path.GetFileName, StringComparer.Ordinal)
                    .Take(MaxReportsInUi);
                foreach (var dir in recentDirectories)
                {
                    var entry = ParseReportFolder(dir);
                    if (entry != null) entries.Add(entry);
                }
            }
            catch { return; }

            SafeDispatch(() =>
            {
                Reports.Clear();
                foreach (var entry in entries) Reports.Add(entry);
            });
        }

        private static void SafeDispatch(Action action)
        {
            try
            {
                var dispatcher = System.Windows.Application.Current?.Dispatcher;
                if (dispatcher != null && !dispatcher.CheckAccess()) dispatcher.BeginInvoke(action);
                else action();
            }
            catch
            {
                // App may be shutting down; ignore dispatch failures.
            }
        }

        private static ReportEntry ParseReportFolder(string dirPath)
        {
            try
            {
                var folderName = Path.GetFileName(dirPath);
                var summaryPath = Path.Combine(dirPath, "summary-en.txt");
                var entry = new ReportEntry { FolderName = folderName, ReportPath = dirPath };
                var match = Regex.Match(folderName, @"(\d{8})-(\d{6})-(.+)");
                if (match.Success)
                {
                    entry.StartedAt = $"{match.Groups[1].Value.Substring(0, 4)}-{match.Groups[1].Value.Substring(4, 2)}-{match.Groups[1].Value.Substring(6, 2)} " +
                                      $"{match.Groups[2].Value.Substring(0, 2)}:{match.Groups[2].Value.Substring(2, 2)}:{match.Groups[2].Value.Substring(4, 2)}";
                    entry.ToolId = match.Groups[3].Value;
                }
                if (!File.Exists(summaryPath)) return entry;

                foreach (var line in File.ReadLines(summaryPath))
                {
                    if (line.StartsWith("Tool:"))
                    {
                        var toolPart = line.Substring(5).Trim(); var dash = toolPart.IndexOf(" - ");
                        if (dash >= 0) { entry.ToolId = toolPart.Substring(0, dash).Trim(); entry.ToolName = toolPart.Substring(dash + 3).Trim(); }
                    }
                    else if (line.StartsWith("Category:"))
                    {
                        var catPart = line.Substring(9).Trim(); var riskIdx = catPart.IndexOf("Risk:");
                        if (riskIdx >= 0) { entry.Category = catPart.Substring(0, riskIdx).Trim(); entry.RiskLevel = catPart.Substring(riskIdx + 5).Trim(); }
                        else entry.Category = catPart;
                    }
                    else if (line.StartsWith("Status:")) entry.Status = line.Substring(7).Trim();
                    else if (line.StartsWith("Items found:"))
                    {
                        var nums = ExtractNumbers(line);
                        if (nums.Count >= 1) entry.ItemsFound = (int)nums[0];
                        if (nums.Count >= 2) entry.ItemsProcessed = (int)nums[1];
                    }
                    else if (line.StartsWith("Restart needed:")) entry.RestartNeeded = line.Contains("Yes", StringComparison.OrdinalIgnoreCase);
                    else if (line.StartsWith("Backup path:")) entry.BackupPath = line.Substring(12).Trim();
                    else if (line.StartsWith("Report folder:")) entry.ReportPath = line.Substring(14).Trim();
                    else if (line.StartsWith("Error:")) entry.ErrorMessage = line.Substring(6).Trim();
                }
                entry.FinishedAt = entry.StartedAt;
                return entry;
            }
            catch { return null; }
        }

        private static List<long> ExtractNumbers(string text)
        {
            var numbers = new List<long>();
            foreach (Match match in Regex.Matches(text, @"\d[\d,]*"))
            {
                if (long.TryParse(match.Value.Replace(",", ""), out var number)) numbers.Add(number);
            }
            return numbers;
        }

        public static List<ReportEntry> GetReportsForTool(string toolId)
        {
            lock (_lock) return Reports.Where(r => string.Equals(r.ToolId, toolId, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        public static int GetTotalReports() => Reports.Count;
    }
}
