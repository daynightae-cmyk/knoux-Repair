using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using KnouxRepair.Models;

namespace KnouxRepair.Services
{
    public static class ReportsService
    {
        private static FileSystemWatcher _watcher;
        private static Timer _refreshTimer;
        private static readonly object _lock = new object();

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

        public static void StartWatching()
        {
            var root = ReportsRoot;
            if (!Directory.Exists(root))
            {
                try { Directory.CreateDirectory(root); } catch { return; }
            }

            // Initial load
            RefreshReports();

            // Watch for new folders
            _watcher = new FileSystemWatcher(root, "*")
            {
                NotifyFilter = NotifyFilters.DirectoryName,
                IncludeSubdirectories = false
            };
            _watcher.Created += OnFolderCreated;
            _watcher.EnableRaisingEvents = true;

            // Periodic refresh for folder content changes
            _refreshTimer = new Timer(_ => RefreshReports(), null,
                TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(15));
        }

        public static void StopWatching()
        {
            _watcher?.Dispose();
            _watcher = null;
            _refreshTimer?.Dispose();
            _refreshTimer = null;
        }

        private static void OnFolderCreated(object sender, FileSystemEventArgs e)
        {
            // Wait a moment for folder content to be written
            Thread.Sleep(500);
            var entry = ParseReportFolder(e.FullPath);
            if (entry != null)
            {
                SafeDispatch(() =>
                {
                    Reports.Insert(0, entry);
                });
                NewReportDetected?.Invoke(entry);
            }
        }

        public static void RefreshReports()
        {
            var root = ReportsRoot;
            if (!Directory.Exists(root)) return;

            var entries = new List<ReportEntry>();
            var dirs = Directory.GetDirectories(root);

            foreach (var dir in dirs)
            {
                var entry = ParseReportFolder(dir);
                if (entry != null)
                    entries.Add(entry);
            }

            // Sort newest first
            entries.Sort((a, b) => string.Compare(b.FolderName, a.FolderName, StringComparison.Ordinal));

            SafeDispatch(() =>
            {
                Reports.Clear();
                foreach (var e in entries)
                    Reports.Add(e);
            });
        }

        private static void SafeDispatch(Action action)
        {
            try
            {
                var dispatcher = System.Windows.Application.Current?.Dispatcher;
                if (dispatcher != null && !dispatcher.CheckAccess())
                    dispatcher.BeginInvoke(action);
                else
                    action();
            }
            catch
            {
                // App may be shutting down; ignore dispatch failures
            }
        }

        private static ReportEntry ParseReportFolder(string dirPath)
        {
            var folderName = Path.GetFileName(dirPath);
            var summaryPath = Path.Combine(dirPath, "summary-en.txt");
            var jsonPath = Path.Combine(dirPath, "results.json");

            var entry = new ReportEntry
            {
                FolderName = folderName,
                ReportPath = dirPath
            };

            // Try to parse tool ID and timestamp from folder name
            // Pattern: YYYYMMDD-HHmmss-TOOLID
            var match = Regex.Match(folderName, @"(\d{8})-(\d{6})-(.+)");
            if (match.Success)
            {
                entry.StartedAt = $"{match.Groups[1].Value.Substring(0, 4)}-{match.Groups[1].Value.Substring(4, 2)}-{match.Groups[1].Value.Substring(6, 2)} " +
                                  $"{match.Groups[2].Value.Substring(0, 2)}:{match.Groups[2].Value.Substring(2, 2)}:{match.Groups[2].Value.Substring(4, 2)}";
                entry.ToolId = match.Groups[3].Value;
            }

            // Parse summary-en.txt
            if (File.Exists(summaryPath))
            {
                try
                {
                    var lines = File.ReadAllLines(summaryPath);
                    foreach (var line in lines)
                    {
                        if (line.StartsWith("Tool:"))
                        {
                            var toolPart = line.Substring(5).Trim();
                            var dash = toolPart.IndexOf(" - ");
                            if (dash >= 0)
                            {
                                entry.ToolId = toolPart.Substring(0, dash).Trim();
                                entry.ToolName = toolPart.Substring(dash + 3).Trim();
                            }
                        }
                        else if (line.StartsWith("Category:"))
                        {
                            var catPart = line.Substring(9).Trim();
                            var riskIdx = catPart.IndexOf("Risk:");
                            if (riskIdx >= 0)
                            {
                                entry.Category = catPart.Substring(0, riskIdx).Trim();
                                entry.RiskLevel = catPart.Substring(riskIdx + 5).Trim();
                            }
                            else
                                entry.Category = catPart;
                        }
                        else if (line.StartsWith("Status:"))
                            entry.Status = line.Substring(7).Trim();
                        else if (line.StartsWith("Items found:"))
                        {
                            var nums = ExtractNumbers(line);
                            if (nums.Count >= 1) entry.ItemsFound = (int)nums[0];
                            if (nums.Count >= 2) entry.ItemsProcessed = (int)nums[1];
                        }
                        else if (line.StartsWith("Restart needed:"))
                            entry.RestartNeeded = line.Contains("Yes", StringComparison.OrdinalIgnoreCase);
                        else if (line.StartsWith("Backup path:"))
                            entry.BackupPath = line.Substring(12).Trim();
                        else if (line.StartsWith("Report folder:"))
                            entry.ReportPath = line.Substring(14).Trim();
                        else if (line.StartsWith("Error:"))
                            entry.ErrorMessage = line.Substring(6).Trim();
                    }

                    entry.FinishedAt = entry.StartedAt; // Same as started for completed reports
                }
                catch { }
            }

            return entry;
        }

        private static List<long> ExtractNumbers(string text)
        {
            var numbers = new List<long>();
            var matches = Regex.Matches(text, @"\d[\d,]*");
            foreach (Match m in matches)
            {
                var cleaned = m.Value.Replace(",", "");
                if (long.TryParse(cleaned, out var num))
                    numbers.Add(num);
            }
            return numbers;
        }

        public static List<ReportEntry> GetReportsForTool(string toolId)
        {
            lock (_lock)
            {
                return Reports.Where(r =>
                    string.Equals(r.ToolId, toolId, StringComparison.OrdinalIgnoreCase)).ToList();
            }
        }

        public static int GetTotalReports() => Reports.Count;
    }
}
