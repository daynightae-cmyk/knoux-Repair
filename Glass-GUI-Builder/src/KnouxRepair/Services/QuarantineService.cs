using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using KnouxRepair.Models;

namespace KnouxRepair.Services
{
    public static class QuarantineService
    {
        private static readonly object _lock = new object();

        public static ObservableCollection<QuarantineEntry> Entries { get; } = new ObservableCollection<QuarantineEntry>();

        public static string QuarantineRoot =>
            Path.Combine(ManifestService.ProjectRoot, "Quarantine");

        public static void Refresh()
        {
            try
            {
                var list = new List<QuarantineEntry>();
                var root = QuarantineRoot;
                if (Directory.Exists(root))
                {
                    foreach (var toolDir in Directory.GetDirectories(root))
                    {
                        foreach (var itemDir in Directory.GetDirectories(toolDir))
                        {
                            var entry = ParseMeta(Path.Combine(itemDir, "quarantine-meta.json"), itemDir);
                            if (entry != null)
                                list.Add(entry);
                        }
                    }
                }

                list.Sort((a, b) => string.Compare(b.QuarantinedAt, a.QuarantinedAt, StringComparison.Ordinal));

                lock (_lock)
                {
                    Entries.Clear();
                    foreach (var e in list)
                        Entries.Add(e);
                }
            }
            catch { }
        }

        private static QuarantineEntry ParseMeta(string metaPath, string dir)
        {
            if (!File.Exists(metaPath)) return null;
            try
            {
                var entry = JsonSerializer.Deserialize<QuarantineEntry>(File.ReadAllText(metaPath));
                entry.QuarantineDir = dir;
                return entry;
            }
            catch
            {
                // Metadata is corrupt — still show the folder so the user can act on it
                return new QuarantineEntry
                {
                    QuarantineDir = dir,
                    OriginalName = Path.GetFileName(dir),
                    ItemType = "Unknown",
                    TransactionState = "UNREADABLE",
                    QuarantinedAt = ""
                };
            }
        }

        public static int TotalCount
        {
            get { lock (_lock) { return Entries.Count; } }
        }
    }
}