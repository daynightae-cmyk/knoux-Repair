using System;
using System.Windows.Media;
using KnouxRepair.Models;

namespace KnouxRepair.Mappers
{
    /// <summary>
    /// Maps canonical RiskLevel values to presentation labels and brushes
    /// without altering execution semantics.
    /// </summary>
    public static class RiskPresentationMapper
    {
        private static readonly Brush GreenBrush = new SolidColorBrush(Color.FromRgb(0x4C, 0xE3, 0x8A));
        private static readonly Brush RedBrush = new SolidColorBrush(Color.FromRgb(0xFF, 0x5B, 0x69));
        private static readonly Brush AmberBrush = new SolidColorBrush(Color.FromRgb(0xF4, 0xB9, 0x42));
        private static readonly Brush BlueBrush = new SolidColorBrush(Color.FromRgb(0x34, 0x78, 0xF6));
        private static readonly Brush TealBrush = new SolidColorBrush(Color.FromRgb(0x20, 0xC2, 0xA8));
        
        private static readonly Brush GreenBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0x4C, 0xE3, 0x8A));
        private static readonly Brush RedBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0xFF, 0x5B, 0x69));
        private static readonly Brush AmberBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0xF4, 0xB9, 0x42));
        private static readonly Brush BlueBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0x34, 0x78, 0xF6));
        private static readonly Brush TealBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0x20, 0xC2, 0xA8));

        /// <summary>
        /// Gets the human-readable label for a risk level.
        /// </summary>
        public static string GetLabel(string riskLevel)
        {
            if (string.IsNullOrWhiteSpace(riskLevel))
                return "Unknown";

            switch (riskLevel.ToUpper())
            {
                case "READ_ONLY":
                    return "Read Only";
                case "SAFE_CLEANUP":
                    return "Safe Cleanup";
                case "DESTRUCTIVE":
                    return "Destructive";
                case "SYSTEM_REPAIR":
                    return "System Repair";
                case "REBOOT_REQUIRED":
                    return "Reboot Required";
                default:
                    return riskLevel.Replace("_", " ");
            }
        }

        /// <summary>
        /// Gets the foreground brush for a risk level.
        /// </summary>
        public static Brush GetForegroundBrush(string riskLevel)
        {
            if (string.IsNullOrWhiteSpace(riskLevel))
                return BlueBrush;

            switch (riskLevel.ToUpper())
            {
                case "READ_ONLY":
                    return GreenBrush;
                case "SAFE_CLEANUP":
                    return TealBrush;
                case "DESTRUCTIVE":
                    return RedBrush;
                case "SYSTEM_REPAIR":
                    return AmberBrush;
                case "REBOOT_REQUIRED":
                    return RedBrush;
                default:
                    return BlueBrush;
            }
        }

        /// <summary>
        /// Gets the background brush for a risk level.
        /// </summary>
        public static Brush GetBackgroundBrush(string riskLevel)
        {
            if (string.IsNullOrWhiteSpace(riskLevel))
                return BlueBgBrush;

            switch (riskLevel.ToUpper())
            {
                case "READ_ONLY":
                    return GreenBgBrush;
                case "SAFE_CLEANUP":
                    return TealBgBrush;
                case "DESTRUCTIVE":
                    return RedBgBrush;
                case "SYSTEM_REPAIR":
                    return AmberBgBrush;
                case "REBOOT_REQUIRED":
                    return RedBgBrush;
                default:
                    return BlueBgBrush;
            }
        }

        /// <summary>
        /// Gets the border brush for a risk level.
        /// </summary>
        public static Brush GetBorderBrush(string riskLevel)
        {
            if (string.IsNullOrWhiteSpace(riskLevel))
                return BlueBrush;

            switch (riskLevel.ToUpper())
            {
                case "READ_ONLY":
                    return GreenBrush;
                case "SAFE_CLEANUP":
                    return TealBrush;
                case "DESTRUCTIVE":
                    return RedBrush;
                case "SYSTEM_REPAIR":
                    return AmberBrush;
                case "REBOOT_REQUIRED":
                    return RedBrush;
                default:
                    return BlueBrush;
            }
        }
    }

    /// <summary>
    /// Derives semantic action labels from tool metadata.
    /// Never invents operations that the script does not perform.
    /// </summary>
    public static class ActionLabelMapper
    {
        /// <summary>
        /// Gets the primary action label based on tool capabilities and purpose.
        /// </summary>
        public static string GetPrimaryAction(ToolInfo tool)
        {
            if (tool == null)
                return "Run";

            var risk = tool.RiskLevel?.ToUpper() ?? "";
            var purpose = tool.Purpose?.ToLower() ?? "";
            var toolId = tool.ToolId?.ToUpper() ?? "";

            // Read-only tools that generate reports
            if (risk == "READ_ONLY")
            {
                if (purpose.Contains("report") || toolId.StartsWith("DR") || toolId.StartsWith("PF"))
                    return "Generate Report";
                if (purpose.Contains("analyze") || purpose.Contains("scan") || purpose.Contains("test"))
                    return "Analyze";
                if (purpose.Contains("list") || purpose.Contains("show"))
                    return "Scan";
                return "Analyze";
            }

            // Destructive cleanup tools
            if (risk == "DESTRUCTIVE")
            {
                if (purpose.Contains("clean") || purpose.Contains("remove") || purpose.Contains("delete"))
                    return "Clean";
                if (purpose.Contains("quarantine"))
                    return "Quarantine";
                return "Run Cleanup";
            }

            // System repair tools
            if (risk == "SYSTEM_REPAIR")
            {
                if (purpose.Contains("repair") || purpose.Contains("fix") || purpose.Contains("reset"))
                    return "Repair";
                if (purpose.Contains("restart"))
                    return "Restart";
                return "Run Repair";
            }

            // Safe cleanup tools
            if (risk == "SAFE_CLEANUP")
            {
                if (purpose.Contains("restore"))
                    return "Restore";
                if (purpose.Contains("move"))
                    return "Move";
                if (purpose.Contains("clean") || purpose.Contains("remove"))
                    return "Cleanup";
                return "Cleanup";
            }

            // Reboot required
            if (risk == "REBOOT_REQUIRED")
                return "Schedule";

            // Default fallback
            return "Run";
        }

        /// <summary>
        /// Gets the first secondary action label if applicable.
        /// </summary>
        public static string GetSecondaryAction1(ToolInfo tool)
        {
            if (tool == null)
                return null;

            // Analyze-only tools can show preview before run
            if (tool.AnalyzeOnlySupported && tool.RiskLevel != "READ_ONLY")
                return "Preview Changes";

            // WhatIf supported tools
            if (tool.WhatIfSupported)
                return "What-If Preview";

            return null;
        }

        /// <summary>
        /// Gets the second secondary action label if applicable.
        /// </summary>
        public static string GetSecondaryAction2(ToolInfo tool)
        {
            if (tool == null)
                return null;

            // Tools with backup capability
            if (!string.IsNullOrWhiteSpace(tool.BackupMethod) && tool.BackupMethod.ToLower() != "none")
                return "View Backup Info";

            return null;
        }
    }
}
