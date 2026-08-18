using System;
using System.Diagnostics;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using KnouxRepair.Models;
using KnouxRepair.Services;

namespace KnouxRepair.Views
{
    public partial class ReportsPage : UserControl
    {
        public ReportsPage()
        {
            InitializeComponent();
            DataContext = FindResource("VM");
        }

        private void ReportsGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            var report = (sender as DataGrid)?.SelectedItem as ReportEntry;
            BtnOpenReportFolder.IsEnabled = report != null;

            if (report == null)
            {
                DetailBody.Visibility = Visibility.Collapsed;
                return;
            }

            var sb = new StringBuilder();
            sb.Append(report.ToolId).Append(" — ");
            if (!string.IsNullOrEmpty(report.ToolName)) sb.Append(report.ToolName).Append(" — ");
            sb.Append(report.Status ?? "?");
            if (report.RestartNeeded) sb.Append(" • ").Append((string)FindResource("ReportsRestartNeeded"));
            if (report.ItemsFound > 0) sb.Append(" • ").Append((string)FindResource("ReportsItemsLabel")).Append(": ").Append(report.ItemsFound);
            if (!string.IsNullOrEmpty(report.BackupPath)) sb.Append(" • ").Append((string)FindResource("ReportsBackupLabel")).Append(": ").Append(report.BackupPath);
            if (!string.IsNullOrEmpty(report.ErrorMessage)) sb.Append(" • ").Append((string)FindResource("ReportsErrorLabel")).Append(": ").Append(report.ErrorMessage);
            DetailHeader.Text = report.FolderName;
            DetailBody.Text = sb.ToString();
            DetailBody.Visibility = Visibility.Visible;
        }

        private void BtnOpenReportFolder_Click(object sender, RoutedEventArgs e)
        {
            var report = (sender as Button)?.DataContext as ReportEntry
                         ?? (ReportsGrid.SelectedItem as ReportEntry);
            if (report == null || string.IsNullOrEmpty(report.ReportPath)) return;
            try
            {
                Process.Start(new ProcessStartInfo("explorer.exe", $"\"{report.ReportPath}\"") { UseShellExecute = true });
            }
            catch { }
        }

        private void BtnOpenReportsRoot_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                Process.Start(new ProcessStartInfo("explorer.exe", $"\"{ReportsService.ReportsRoot}\"") { UseShellExecute = true });
            }
            catch { }
        }
    }
}