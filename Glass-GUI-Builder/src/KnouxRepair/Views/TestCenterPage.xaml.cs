using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using KnouxRepair.Models;
using KnouxRepair.Services;

namespace KnouxRepair.Views
{
    public partial class TestCenterPage : UserControl
    {
        public ObservableCollection<TestResultEntry> Results { get; } = new ObservableCollection<TestResultEntry>();

        public TestCenterPage()
        {
            InitializeComponent();
            TestsGrid.ItemsSource = Results;
            LoadLastResults();
        }

        private string TestResultsPath => Path.Combine(ManifestService.ProjectRoot, "Tests", "TEST-RESULTS.txt");

        private void LoadLastResults()
        {
            try
            {
                if (!File.Exists(TestResultsPath)) return;
                var text = File.ReadAllText(TestResultsPath);

                var header = Regex.Match(text, @"Total:\s*(\d+)\s+Passed:\s*(\d+)\s+Failed:\s*(\d+)");
                if (header.Success)
                {
                    TotalText.Text = $"Total: {header.Groups[1].Value}";
                    PassedText.Text = $"Passed: {header.Groups[2].Value}";
                    FailedText.Text = $"Failed: {header.Groups[3].Value}";
                }

                var stamp = Regex.Match(text, @"Executed:\s*(.+)");
                if (stamp.Success)
                    LastRunText.Text = stamp.Groups[1].Value.Trim();

                Results.Clear();
                foreach (var line in text.Split('\n'))
                {
                    var m = Regex.Match(line.Trim(), @"^(\d{2})\s+(.+?)\s{2,}(PASS|FAIL|ERROR)\s*(.*)$");
                    if (m.Success)
                    {
                        Results.Add(new TestResultEntry
                        {
                            Name = m.Groups[2].Value.Trim(),
                            Status = m.Groups[3].Value,
                            Detail = m.Groups[4].Value.Trim()
                        });
                    }
                }
            }
            catch { }
        }

        private async void BtnRunTests_Click(object sender, RoutedEventArgs e)
        {
            if (PowerShellService.IsRunning)
            {
                MainWindow.Instance.SetStatusText((string)FindResource("StatusBusy"));
                return;
            }

            BtnRunTests.IsEnabled = false;
            var runPath = Path.Combine(ManifestService.ProjectRoot, "Tests", "Run-Tests.ps1");
            MainWindow.Instance.RunCommand($"& '{runPath.Replace("'", "''")}'",
                runMessage: (string)FindResource("StatusRunning"));
            LastRunText.Text = (string)FindResource("StatusRunning");

            try
            {
                await Task.Delay(3000);
                LoadLastResults();
            }
            finally
            {
                BtnRunTests.IsEnabled = true;
            }
        }
    }
}