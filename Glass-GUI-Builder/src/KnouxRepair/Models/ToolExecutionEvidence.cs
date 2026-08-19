using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace KnouxRepair.Models
{
    public sealed class ToolExecutionEvidence
    {
        private const int MaxLines = 200;
        private static readonly ConcurrentDictionary<string, ToolExecutionEvidence> Records = new();
        private static readonly Regex ArtifactLine = new Regex(@"(?im)^\s*(Report|Backup|Quarantine|Recovery)\s*:\s*(.+)$", RegexOptions.Compiled);
        private readonly object _gate = new();
        private readonly List<string> _stdout = new();
        private readonly List<string> _stderr = new();

        public static event Action<string> Changed;
        public string ToolId { get; private set; }
        public string State { get; private set; } = "Idle";
        public DateTimeOffset? StartedAt { get; private set; }
        public DateTimeOffset? FinishedAt { get; private set; }
        public int? ExitCode { get; private set; }
        public string ReportPath { get; private set; }
        public string BackupPath { get; private set; }
        public string QuarantinePath { get; private set; }
        public string RecoveryInformation { get; private set; }
        public IReadOnlyList<string> Stdout { get { lock (_gate) return _stdout.ToArray(); } }
        public IReadOnlyList<string> Stderr { get { lock (_gate) return _stderr.ToArray(); } }
        public TimeSpan? Elapsed => StartedAt.HasValue ? (FinishedAt ?? DateTimeOffset.Now) - StartedAt.Value : null;

        public static ToolExecutionEvidence Get(string toolId)
            => Records.GetOrAdd(toolId ?? string.Empty, id => new ToolExecutionEvidence { ToolId = id });

        public static void Begin(string toolId)
        {
            var evidence = Get(toolId);
            lock (evidence._gate)
            {
                evidence.State = "Running";
                evidence.StartedAt = DateTimeOffset.Now;
                evidence.FinishedAt = null;
                evidence.ExitCode = null;
                evidence.ReportPath = null;
                evidence.BackupPath = null;
                evidence.QuarantinePath = null;
                evidence.RecoveryInformation = null;
                evidence._stdout.Clear();
                evidence._stderr.Clear();
            }
            Changed?.Invoke(evidence.ToolId);
        }

        public static void AppendOutput(string toolId, string line, bool isError)
        {
            if (string.IsNullOrWhiteSpace(toolId) || string.IsNullOrWhiteSpace(line)) return;
            var evidence = Get(toolId);
            lock (evidence._gate)
            {
                var target = isError ? evidence._stderr : evidence._stdout;
                if (target.Count >= MaxLines) target.RemoveAt(0);
                target.Add(line);
                foreach (Match match in ArtifactLine.Matches(line))
                {
                    var value = match.Groups[2].Value.Trim();
                    switch (match.Groups[1].Value.ToLowerInvariant())
                    {
                        case "report": evidence.ReportPath = value; break;
                        case "backup": evidence.BackupPath = value; break;
                        case "quarantine": evidence.QuarantinePath = value; break;
                        case "recovery": evidence.RecoveryInformation = value; break;
                    }
                }
            }
            Changed?.Invoke(evidence.ToolId);
        }

        public static void Complete(string toolId, int exitCode, bool cancelled = false)
        {
            var evidence = Get(toolId);
            lock (evidence._gate)
            {
                evidence.ExitCode = exitCode;
                evidence.FinishedAt = DateTimeOffset.Now;
                evidence.State = cancelled || exitCode == -1 ? "Cancelled" : exitCode == 0 ? "Success" : exitCode == 1 ? "Warning" : "Failed";
            }
            Changed?.Invoke(evidence.ToolId);
        }
    }
}
