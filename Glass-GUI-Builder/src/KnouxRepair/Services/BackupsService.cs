using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using KnouxRepair.Models;

namespace KnouxRepair.Services
{
    public static class BackupsService
    {
        private static readonly object _lock = new object();

        public static ObservableCollection<BackupEntry> Entries { get; } = new ObservableCollection<BackupEntry>();

        public static string BackupsRoot =>
            Path.Combine(ManifestService.ProjectRoot, "Backups");

        public static void Refresh()
        {
            try
            {
                var list = new List<BackupEntry>();
                var root = BackupsRoot;
                if (Directory.Exists(root))
                {
                    foreach (var toolDir in Directory.GetDirectories(root))
                    {
                        var toolId = Path.GetFileName(toolDir);
                        foreach (var stampDir in Directory.GetDirectories(toolDir))
                        {
                            var name = Path.GetFileName(stampDir);
                            long size = 0;
                            int count = 0;
                            try
                            {
                                foreach (var f in Directory.EnumerateFiles(stampDir, "*", SearchOption.AllDirectories))
                                {
                                    count++;
                                    size += new FileInfo(f).Length;
                                }
                            }
                            catch { }

                            list.Add(new BackupEntry
                            {
                                ToolId = toolId,
                                FolderName = name,
                                BackupPath = stampDir,
                                SizeBytes = size,
                                ItemCount = count,
                                Timestamp = FormatStamp(name)
                            });
                        }
                    }
                }

                list.Sort((a, b) => string.Compare(b.FolderName, a.FolderName, StringComparison.Ordinal));

                lock (_lock)
                {
                    Entries.Clear();
                    foreach (var e in list)
                        Entries.Add(e);
                }
            }
            catch { }
        }

        private static string FormatStamp(string name)
        {
            // Backups are named yyyyMMdd-HHmmss
            try
            {
                var dash = name.IndexOf('-');
                if (dash == 8 && name.Length >= 15)
                {
                    var d = name.Substring(0, 8);
                    var t = name.Substring(9, 6);
                    return $"{d.Substring(0, 4)}-{d.Substring(4, 2)}-{d.Substring(6, 2)} " +
                           $"{t.Substring(0, 2)}:{t.Substring(2, 2)}:{t.Substring(4, 2)}";
                }
            }
            catch { }
            return name;
        }

        public static string FormatBytes(long bytes)
        {
            string[] units = { "B", "KB", "MB", "GB", "TB" };
            double size = bytes;
            int unit = 0;
            while (size >= 1024 && unit < units.Length - 1)
            {
                size /= 1024;
                unit++;
            }
            return $"{size:0.##} {units[unit]}";
        }

        public static int TotalCount
        {
            get { lock (_lock) { return Entries.Count; } }
        }
    }
}