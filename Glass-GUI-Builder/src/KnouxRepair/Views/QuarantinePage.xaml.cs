using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using KnouxRepair.Models;
using KnouxRepair.Services;

namespace KnouxRepair.Views
{
    public partial class QuarantinePage : UserControl
    {
        public QuarantinePage()
        {
            InitializeComponent();
            RefreshList();
        }

        private void RefreshList()
        {
            QuarantineService.Refresh();
            QuarantineGrid.ItemsSource = QuarantineService.Entries;
        }

        private void BtnRefresh_Click(object sender, RoutedEventArgs e) => RefreshList();

        private QuarantineEntry GetSelected()
            => QuarantineGrid.SelectedItem as QuarantineEntry;

        private void QuarantineGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            var entry = GetSelected();
            var hasSelection = entry != null;
            BtnRestore.IsEnabled = hasSelection;
            BtnOpenFolder.IsEnabled = hasSelection;
        }

        private void BtnOpenFolder_Click(object sender, RoutedEventArgs e)
        {
            var entry = GetSelected();
            if (entry == null || string.IsNullOrEmpty(entry.QuarantineDir)) return;
            try
            {
                Process.Start(new ProcessStartInfo("explorer.exe", $"\"{entry.QuarantineDir}\"") { UseShellExecute = true });
            }
            catch { }
        }

        private async void BtnRestore_Click(object sender, RoutedEventArgs e)
        {
            var entry = GetSelected();
            if (entry == null || string.IsNullOrEmpty(entry.QuarantineDir)) return;

            var opts = MessageBoxOptions.DefaultDesktopOnly;
            if (ThemeService.IsArabic(SettingsService.Settings.Language))
                opts |= MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign;

            var result = MessageBox.Show(
                string.Format((string)FindResource("QuarantineRestoreConfirm"), entry.OriginalName ?? entry.QuarantineDir),
                (string)FindResource("QuarantineRestoreTitle"),
                MessageBoxButton.YesNo, MessageBoxImage.Question,
                MessageBoxResult.No, opts);
            if (result != MessageBoxResult.Yes) return;

            // Restore through the Core module so all safety checks apply
            var quoted = entry.QuarantineDir.Replace("'", "''");
            var command = $"Import-Module (Join-Path '{ManifestService.ProjectRoot.Replace("'", "''")}' 'Core\\KnouxRepair.Core.psm1') -Force; " +
                          $"$ok = Restore-KnouxQuarantinedItem -QuarantinePath '{quoted}'; " +
                          "if ($ok) { Write-Host '[RESTORE] OK'; exit 0 } else { Write-Host '[RESTORE] FAILED'; exit 3 }";

            MainWindow.Instance.RunCommand(command,
                runMessage: (string)FindResource("QuarantineRestoreRunning"));

            await Task.Delay(500);
            RefreshList();
        }
    }
}