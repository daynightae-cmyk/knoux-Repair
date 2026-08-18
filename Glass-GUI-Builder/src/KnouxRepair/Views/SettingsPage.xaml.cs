using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;

namespace KnouxRepair.Views
{
    public partial class SettingsPage : UserControl
    {
        public SettingsPage()
        {
            InitializeComponent();
            LoadSettings();
        }

        private void LoadSettings()
        {
            var s = Services.SettingsService.Settings;
            AnalyzeToggle.IsChecked = s.AnalyzeOnlyDefault;
            ReducedMotionToggle.IsChecked = s.ReducedMotion;
            FontSizeLabel.Text = s.ConsoleFontSize.ToString("0");
            MaxReportsLabel.Text = s.MaxReportHistory.ToString();
        }

        private void LangEnglish_Click(object sender, RoutedEventArgs e)
        {
            Services.SettingsService.SetLanguage("English");
            Services.ThemeService.SetLanguage("English");
        }

        private void LangArabic_Click(object sender, RoutedEventArgs e)
        {
            Services.SettingsService.SetLanguage("العربية");
            Services.ThemeService.SetLanguage("العربية");
        }

        private void AnalyzeToggle_Click(object sender, RoutedEventArgs e)
        {
            Services.SettingsService.SetAnalyzeOnly(AnalyzeToggle.IsChecked == true);
        }

        private void ReducedMotion_Click(object sender, RoutedEventArgs e)
        {
            Services.SettingsService.SetReducedMotion(ReducedMotionToggle.IsChecked == true);
        }

        private void FontSizeIncrease_Click(object sender, RoutedEventArgs e)
        {
            var current = Services.SettingsService.Settings.ConsoleFontSize;
            var newVal = System.Math.Min(24, current + 1);
            Services.SettingsService.SetConsoleFontSize(newVal);
            FontSizeLabel.Text = newVal.ToString("0");
        }

        private void FontSizeDecrease_Click(object sender, RoutedEventArgs e)
        {
            var current = Services.SettingsService.Settings.ConsoleFontSize;
            var newVal = System.Math.Max(8, current - 1);
            Services.SettingsService.SetConsoleFontSize(newVal);
            FontSizeLabel.Text = newVal.ToString("0");
        }

        private void OpenProjectFolder_Click(object sender, RoutedEventArgs e)
        {
            var projectRoot = System.IO.Path.Combine(
                System.AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..");
            if (System.IO.Directory.Exists(projectRoot))
                Process.Start("explorer.exe", projectRoot);
        }
    }
}
