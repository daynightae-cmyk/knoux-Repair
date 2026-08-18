using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using KnouxRepair.Models;

namespace KnouxRepair.Views
{
    public partial class ToolDetailPanel : UserControl
    {
        public event Action<string, bool> ToolExecutionRequested;

        private static readonly Brush GreenBrush = new SolidColorBrush(Color.FromRgb(0x4C, 0xE3, 0x8A));
        private static readonly Brush RedBrush = new SolidColorBrush(Color.FromRgb(0xFF, 0x5B, 0x69));
        private static readonly Brush AmberBrush = new SolidColorBrush(Color.FromRgb(0xF4, 0xB9, 0x42));
        private static readonly Brush BlueBrush = new SolidColorBrush(Color.FromRgb(0x34, 0x78, 0xF6));
        private static readonly Brush MutedBrush = new SolidColorBrush(Color.FromRgb(0x9F, 0xB2, 0xC8));
        private static readonly Brush DangerBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0xFF, 0x5B, 0x69));
        private static readonly Brush SuccessBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0x4C, 0xE3, 0x8A));
        private static readonly Brush AmberDimBrush = new SolidColorBrush(Color.FromArgb(0x55, 0xF4, 0xB9, 0x42));

        public ToolDetailPanel()
        {
            InitializeComponent();
            DataContextChanged += ToolDetailPanel_DataContextChanged;
            Services.PowerShellService.RunningStateChanged += OnRunningStateChanged;
            Loaded += (s, e) => Services.ThemeService.LanguageChanged += OnLanguageChanged;
            Unloaded += (s, e) => Services.ThemeService.LanguageChanged -= OnLanguageChanged;
        }

        private ToolInfo _currentTool;

        private void OnLanguageChanged()
        {
            if (_currentTool != null)
                ShowTool(_currentTool);
        }

        private void OnRunningStateChanged(bool isRunning)
        {
            Dispatcher.Invoke(() =>
            {
                BtnAnalyze.IsEnabled = !isRunning;
                BtnRun.IsEnabled = !isRunning;
            });
        }

        private void ToolDetailPanel_DataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
        {
            if (e.NewValue is ToolInfo tool)
                ShowTool(tool);
            else
                ShowPlaceholder();
        }

        private void ShowPlaceholder()
        {
            _currentTool = null;
            PlaceholderPanel.Visibility = Visibility.Visible;
            DetailContent.Visibility = Visibility.Collapsed;
            BtnAnalyze.Visibility = Visibility.Collapsed;
            BtnRun.Visibility = Visibility.Collapsed;
        }

        private void ShowTool(ToolInfo tool)
        {
            _currentTool = tool;
            PlaceholderPanel.Visibility = Visibility.Collapsed;
            DetailContent.Visibility = Visibility.Visible;
            BtnAnalyze.Visibility = tool.AnalyzeOnlySupported ? Visibility.Visible : Visibility.Collapsed;
            BtnRun.Visibility = Visibility.Visible;

            ToolIdText.Text = tool.ToolId;
            ToolNameText.Text = tool.EnglishName;
            PurposeText.Text = tool.Purpose;
            OfflineText.Text = tool.OfflineCapability ?? (string)FindResource("ValueNone");
            BackupText.Text = tool.BackupMethod ?? (string)FindResource("ValueNone");
            RollbackText.Text = tool.RollbackMethod ?? (string)FindResource("ValueNone");
            WhatIfText.Text = tool.WhatIfSupported
                ? (string)FindResource("ValueSupported")
                : (string)FindResource("ValueNotSupported");
            PathText.Text = tool.ScriptPath ?? "";

            // Risk badge color
            var risk = tool.RiskLevel?.ToUpper() ?? "";
            RiskText.Text = risk.Replace("_", " ");
            switch (risk)
            {
                case "READ_ONLY":
                    RiskBadge.Background = SuccessBgBrush;
                    RiskBadge.BorderBrush = GreenBrush;
                    RiskBadge.BorderThickness = new Thickness(0.5);
                    RiskText.Foreground = GreenBrush;
                    break;
                case "DESTRUCTIVE":
                    RiskBadge.Background = DangerBgBrush;
                    RiskBadge.BorderBrush = RedBrush;
                    RiskBadge.BorderThickness = new Thickness(0.5);
                    RiskText.Foreground = RedBrush;
                    break;
                case "SYSTEM_REPAIR":
                    RiskBadge.Background = new SolidColorBrush(Color.FromArgb(0x33, 0xF4, 0xB9, 0x42));
                    RiskBadge.BorderBrush = AmberBrush;
                    RiskBadge.BorderThickness = new Thickness(0.5);
                    RiskText.Foreground = AmberBrush;
                    break;
                default:
                    RiskBadge.Background = new SolidColorBrush(Color.FromArgb(0x33, 0x34, 0x78, 0xF6));
                    RiskBadge.BorderBrush = BlueBrush;
                    RiskBadge.BorderThickness = new Thickness(0.5);
                    RiskText.Foreground = BlueBrush;
                    break;
            }

            AdminBadge.Visibility = tool.RequiresAdmin ? Visibility.Visible : Visibility.Collapsed;
            RestartBadge.Visibility = tool.RequiresRestart ? Visibility.Visible : Visibility.Collapsed;
        }

        private ToolInfo GetCurrentTool() => DataContext as ToolInfo;

        private void BtnAnalyze_Click(object sender, RoutedEventArgs e)
        {
            var tool = GetCurrentTool();
            if (tool != null)
                ToolExecutionRequested?.Invoke(tool.ScriptPath, true);
        }

        private void BtnRun_Click(object sender, RoutedEventArgs e)
        {
            var tool = GetCurrentTool();
            if (tool != null)
            {
                var opts = MessageBoxOptions.DefaultDesktopOnly;
                if (Services.ThemeService.IsArabic(Services.SettingsService.Settings.Language))
                    opts |= MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign;

                var result = MessageBox.Show(
                    (string)FindResource("ConfirmRunMessage"),
                    (string)FindResource("ConfirmRunTitle"),
                    MessageBoxButton.YesNo, MessageBoxImage.Warning,
                    MessageBoxResult.No, opts);
                if (result == MessageBoxResult.Yes)
                    ToolExecutionRequested?.Invoke(tool.ScriptPath, false);
            }
        }
    }
}
