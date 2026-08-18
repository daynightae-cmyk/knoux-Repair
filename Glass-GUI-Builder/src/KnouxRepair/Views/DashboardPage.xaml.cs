using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using KnouxRepair.ViewModels;

namespace KnouxRepair.Views
{
    public partial class DashboardPage : UserControl
    {
        private readonly DispatcherTimer _healthTimer;

        public DashboardPage()
        {
            InitializeComponent();
            DataContext = FindResource("VM");

            _healthTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
            _healthTimer.Tick += (s, e) => ((DashboardViewModel)DataContext).RefreshHealth();
            _healthTimer.Start();

            Loaded += (s, e) =>
            {
                _healthTimer.Start();
                RefreshHealthStatus();
                RefreshRecentActivity();
                Services.ThemeService.LanguageChanged += OnLanguageChanged;
            };
            Unloaded += (s, e) =>
            {
                _healthTimer.Stop();
                Services.ThemeService.LanguageChanged -= OnLanguageChanged;
            };
        }

        private void OnLanguageChanged()
        {
            RefreshHealthStatus();
            RefreshRecentActivity();
        }

        private void RefreshHealthStatus()
        {
            var vm = (DashboardViewModel)DataContext;
            var cpu = vm.CpuPercent;
            var ram = vm.RamPercent;
            var disk = vm.DiskPercent;

            var max = Math.Max(cpu, Math.Max(ram, disk));
            string labelKey, descKey, brushKey;

            if (max < 75)
            {
                labelKey = "DashHealthHealthy";
                descKey = "DashHealthNormalDesc";
                brushKey = "BrushGreen";
            }
            else if (max < 90)
            {
                labelKey = "DashHealthAttention";
                descKey = "DashHealthAttentionDesc";
                brushKey = "BrushAmber";
            }
            else
            {
                labelKey = "DashHealthCritical";
                descKey = "DashHealthCriticalDesc";
                brushKey = "BrushRed";
            }

            HealthLabel.Text = (string)FindResource(labelKey);
            HealthLabel.Foreground = (System.Windows.Media.Brush)FindResource(brushKey);
            HealthDot.Fill = (System.Windows.Media.Brush)FindResource(brushKey);
            HealthDesc.Text = (string)FindResource(descKey);
        }

        private void RefreshRecentActivity()
        {
            try
            {
                var reports = Services.ReportsService.Reports;
                if (reports == null || reports.Count == 0)
                {
                    RecentActivityText.Text = (string)FindResource("DashNoActivity");
                    return;
                }

                var lines = new System.Text.StringBuilder();
                var count = Math.Min(reports.Count, 5);
                for (var i = 0; i < count; i++)
                {
                    var r = reports[i];
                    var icon = r.Status == "Success" ? "\u2713" : r.Status == "Warning" ? "\u26A0" : "\u2717";
                    var time = r.StartedAt;
                    lines.AppendLine($"{icon}  {r.ToolName,-30} {time}");
                }
                RecentActivityText.Text = lines.ToString().TrimEnd();
            }
            catch
            {
                RecentActivityText.Text = (string)FindResource("DashNoActivity");
            }
        }

        // === Primary Actions ===

        private void BtnRunSystemCheck_Click(object sender, RoutedEventArgs e)
        {
            NavigateToAllTools();
        }

        private void BtnAnalyzeSystem_Click(object sender, RoutedEventArgs e)
        {
            NavigateToAllTools();
        }

        private void NavigateToAllTools()
        {
            MainWindow.Instance?.NavigateToPage("AllTools");
        }

        // === Quick Actions → navigate to AllTools workspace ===

        private void BtnQuickMaintenance_Click(object sender, RoutedEventArgs e)
            => NavigateToAllTools();

        private void BtnQuickCleanup_Click(object sender, RoutedEventArgs e)
            => NavigateToAllTools();

        private void BtnQuickNetwork_Click(object sender, RoutedEventArgs e)
            => NavigateToAllTools();

        private void BtnQuickSecurity_Click(object sender, RoutedEventArgs e)
            => NavigateToAllTools();

        private void BtnQuickPerformance_Click(object sender, RoutedEventArgs e)
            => NavigateToAllTools();

        private void BtnQuickDisk_Click(object sender, RoutedEventArgs e)
            => NavigateToAllTools();

        private void BtnQuickDiagnostics_Click(object sender, RoutedEventArgs e)
            => NavigateToAllTools();
    }
}
