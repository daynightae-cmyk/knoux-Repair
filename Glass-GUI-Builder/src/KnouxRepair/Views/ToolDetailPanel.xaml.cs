using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using KnouxRepair.Models;
using KnouxRepair.Mappers;

namespace KnouxRepair.Views
{
    public partial class ToolDetailPanel : UserControl
    {
        public event Action<string, bool> ToolExecutionRequested;

        private static readonly Brush GreenBrush = new SolidColorBrush(Color.FromRgb(0x4C, 0xE3, 0x8A));
        private static readonly Brush RedBrush = new SolidColorBrush(Color.FromRgb(0xFF, 0x5B, 0x69));
        private static readonly Brush AmberBrush = new SolidColorBrush(Color.FromRgb(0xF4, 0xB9, 0x42));
        private static readonly Brush BlueBrush = new SolidColorBrush(Color.FromRgb(0x34, 0x78, 0xF6));
        private static readonly Brush TealBrush = new SolidColorBrush(Color.FromRgb(0x20, 0xC2, 0xA8));
        private static readonly Brush MutedBrush = new SolidColorBrush(Color.FromRgb(0x9F, 0xB2, 0xC8));
        private static readonly Brush DangerBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0xFF, 0x5B, 0x69));
        private static readonly Brush SuccessBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0x4C, 0xE3, 0x8A));
        private static readonly Brush AmberDimBrush = new SolidColorBrush(Color.FromArgb(0x55, 0xF4, 0xB9, 0x42));
        private static readonly Brush TealBgBrush = new SolidColorBrush(Color.FromArgb(0x33, 0x20, 0xC2, 0xA8));

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
            
            // Use the mapper for semantic action labels
            var primaryActionLabel = ActionLabelMapper.GetPrimaryAction(tool);
            var secondaryAction1 = ActionLabelMapper.GetSecondaryAction1(tool);
            var secondaryAction2 = ActionLabelMapper.GetSecondaryAction2(tool);
            
            // Determine available actions based on capabilities
            var hasAnalyze = tool.AnalyzeOnlySupported;
            var hasWhatIf = tool.WhatIfSupported;
            var isDestructive = tool.RiskLevel == "DESTRUCTIVE";
            var isReadOnly = tool.RiskLevel == "READ_ONLY";
            var isRepair = tool.RiskLevel == "SYSTEM_REPAIR";
            var isSafeCleanup = tool.RiskLevel == "SAFE_CLEANUP";
            
            // Configure Analyze button visibility and label
            BtnAnalyze.Visibility = hasAnalyze ? Visibility.Visible : Visibility.Collapsed;
            if (hasAnalyze)
            {
                if (isReadOnly)
                    BtnAnalyze.Content = FindResource("ActionAnalyze");
                else if (isDestructive || isSafeCleanup)
                    BtnAnalyze.Content = FindResource("ActionPreviewChanges");
                else
                    BtnAnalyze.Content = FindResource("ActionAnalyzeSafely");
            }
            
            // Configure Run button with semantic label from mapper
            BtnRun.Visibility = Visibility.Visible;
            BtnRun.Content = GetLocalizedActionLabel(primaryActionLabel);

            ToolIdText.Text = tool.ToolId;
            ToolNameText.Text = Services.ThemeService.IsArabic(Services.SettingsService.Settings.Language) 
                ? tool.ArabicName : tool.EnglishName;
            PurposeText.Text = tool.Purpose;
            OfflineText.Text = tool.OfflineCapability ?? (string)FindResource("ValueNone");
            BackupText.Text = tool.BackupMethod ?? (string)FindResource("ValueNone");
            RollbackText.Text = tool.RollbackMethod ?? (string)FindResource("ValueNone");
            WhatIfText.Text = tool.WhatIfSupported
                ? (string)FindResource("ValueSupported")
                : (string)FindResource("ValueNotSupported");
            PathText.Text = tool.ScriptPath ?? "";

            // Risk badge using mapper
            var risk = tool.RiskLevel?.ToUpper() ?? "";
            RiskText.Text = RiskPresentationMapper.GetLabel(risk);
            RiskBadge.Background = RiskPresentationMapper.GetBackgroundBrush(risk);
            RiskBadge.BorderBrush = RiskPresentationMapper.GetBorderBrush(risk);
            RiskBadge.BorderThickness = new Thickness(0.5);
            RiskText.Foreground = RiskPresentationMapper.GetForegroundBrush(risk);

            AdminBadge.Visibility = tool.RequiresAdmin ? Visibility.Visible : Visibility.Collapsed;
            RestartBadge.Visibility = tool.RequiresRestart ? Visibility.Visible : Visibility.Collapsed;
        }

        /// <summary>
        /// Gets localized action label from resource dictionary or falls back to English.
        /// </summary>
        private string GetLocalizedActionLabel(string actionKey)
        {
            try
            {
                var resourceKey = "Action" + actionKey.Replace(" ", "").Replace("-", "");
                var resource = TryFindResource(resourceKey);
                if (resource != null)
                    return resource.ToString();
            }
            catch { }
            
            // Fallback mappings for common labels
            return actionKey;
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
                // Show confirmation for destructive or admin operations
                var requiresConfirmation = tool.RiskLevel == "DESTRUCTIVE" || 
                                          tool.RiskLevel == "SYSTEM_REPAIR" ||
                                          tool.RequiresAdmin ||
                                          tool.RequiresRestart;

                if (requiresConfirmation)
                {
                    var opts = MessageBoxOptions.DefaultDesktopOnly;
                    if (Services.ThemeService.IsArabic(Services.SettingsService.Settings.Language))
                        opts |= MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign;

                    var result = MessageBox.Show(
                        (string)FindResource("ConfirmRunMessage"),
                        (string)FindResource("ConfirmRunTitle"),
                        MessageBoxButton.YesNo, MessageBoxImage.Warning,
                        MessageBoxResult.No, opts);
                    if (result != MessageBoxResult.Yes)
                        return;
                }

                ToolExecutionRequested?.Invoke(tool.ScriptPath, false);
            }
        }
    }
}
