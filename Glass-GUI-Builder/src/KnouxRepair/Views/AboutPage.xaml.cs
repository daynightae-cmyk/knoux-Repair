using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using KnouxRepair.Core;

namespace KnouxRepair.Views
{
    public partial class AboutPage : UserControl
    {
        private class SysRow
        {
            public string Label { get; set; }
            public string Value { get; set; }
        }

        public AboutPage()
        {
            InitializeComponent();
            Loaded += AboutPage_Loaded;
            Unloaded += AboutPage_Unloaded;
        }

        private void AboutPage_Unloaded(object sender, RoutedEventArgs e)
        {
            Services.ThemeService.LanguageChanged -= OnLanguageChanged;
        }

        private void OnLanguageChanged()
        {
            BuildRows();
        }

        private void AboutPage_Loaded(object sender, RoutedEventArgs e)
        {
            Services.ThemeService.LanguageChanged += OnLanguageChanged;
            // If already loaded, skip to avoid duplicate timers / flicker.
            if (SysInfoRows.Items.Count > 0) return;
            BuildRows();
        }

        private void BuildRows()
        {
            try
            {
                var rows = new List<SysRow>
                {
                    Row("SysOs", SystemInfoProvider.OsDescription),
                    Row("SysCpu", SystemInfoProvider.CpuName),
                    Row("SysCores", $"{SystemInfoProvider.LogicalProcessorCount} ({CpuArch()})"),
                    Row("SysRam", TotalRamText()),
                    Row("SysDisk", RootDriveText()),
                    Row("SysUptime", SystemInfoProvider.UptimeLabel),
                    Row("SysAdmin", SystemInfoProvider.IsAdministrator ? L("AdminElevated") : L("AdminStandard")),
                    Row("SysEngine", Services.PowerShellService.FindPowerShell()),
                    Row("SysProject", Services.ManifestService.ProjectRoot),
                    Row("SysTools", Services.ManifestService.Tools.Count.ToString())
                };

                SysInfoRows.ItemsSource = rows;
                SysInfoStatusText.Text = L("StatusReady");
            }
            catch (Exception ex)
            {
                // Partial failure must not break the page: report and keep the card visible.
                SysInfoRows.ItemsSource = new List<SysRow> { Row("SysOs", ex.Message) };
                SysInfoStatusText.Text = L("StatusFailed");
            }
        }

        private static SysRow Row(string labelKey, string value)
            => new SysRow { Label = L(labelKey), Value = value };

        private static string L(string key)
        {
            try
            {
                if (Application.Current.TryFindResource(key) is string text)
                    return text;
            }
            catch { }
            return key;
        }

        private static string CpuArch()
            => Environment.Is64BitOperatingSystem ? "x64" : "x86";

        private static string TotalRamText()
        {
            var mb = SystemInfoProvider.TotalRamMb;
            return mb >= 1024 ? $"{mb / 1024.0:0.0} GB" : $"{mb} MB";
        }

        private static string RootDriveText()
        {
            try
            {
                var drive = SystemInfoProvider.RootDrive;
                if (drive == null) return "-";
                var free = drive.AvailableFreeSpace / (1024.0 * 1024 * 1024);
                var total = drive.TotalSize / (1024.0 * 1024 * 1024);
                return $"{free:0.0} GB free / {total:0.0} GB";
            }
            catch
            {
                return "-";
            }
        }
    }
}