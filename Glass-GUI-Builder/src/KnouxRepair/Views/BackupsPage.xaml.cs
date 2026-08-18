using System;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using KnouxRepair.Models;
using KnouxRepair.Services;

namespace KnouxRepair.Views
{
    public partial class BackupsPage : UserControl
    {
        public BackupsPage()
        {
            InitializeComponent();
            RefreshList();
        }

        private void RefreshList()
        {
            BackupsService.Refresh();
            BackupsGrid.ItemsSource = BackupsService.Entries;
        }

        private void BtnRefresh_Click(object sender, RoutedEventArgs e) => RefreshList();

        private BackupEntry GetSelected() => BackupsGrid.SelectedItem as BackupEntry;

        private void BackupsGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            BtnOpenFolder.IsEnabled = GetSelected() != null;
        }

        private void BtnOpenFolder_Click(object sender, RoutedEventArgs e)
        {
            var entry = GetSelected();
            if (entry == null || string.IsNullOrEmpty(entry.BackupPath)) return;
            try
            {
                Process.Start(new ProcessStartInfo("explorer.exe", $"\"{entry.BackupPath}\"") { UseShellExecute = true });
            }
            catch { }
        }
    }
}