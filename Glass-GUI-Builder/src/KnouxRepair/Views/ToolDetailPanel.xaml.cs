using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Automation;
using KnouxRepair.Models;

namespace KnouxRepair.Views
{
    public partial class ToolDetailPanel : UserControl
    {
        public event Action<ToolExecutionRequest> ToolActionRequested;
        private ToolInfo _currentTool;
        private ToolCapabilityProfile _profile;

        public ToolDetailPanel()
        {
            InitializeComponent();
            DataContextChanged += (_, e) => { if (e.NewValue is ToolInfo t) ShowTool(t); else ShowPlaceholder(); };
            Services.PowerShellService.RunningStateChanged += OnRunningStateChanged;
            Services.ThemeService.LanguageChanged += () => { if (_currentTool != null) ShowTool(_currentTool); };
            ToolExecutionEvidence.Changed += OnEvidenceChanged;
        }

        private void OnRunningStateChanged(bool running) => Dispatcher.Invoke(() => { foreach (Button b in ActionBar.Children) b.IsEnabled = !running; });
        private void OnEvidenceChanged(string id) { if (_currentTool?.ToolId == id) Dispatcher.BeginInvoke(new Action(RefreshEvidence)); }
        private void ShowPlaceholder()
        {
            _currentTool = null;
            PlaceholderPanel.Visibility = Visibility.Visible;
            DetailContent.Visibility = Visibility.Collapsed;
            ActionBar.Children.Clear();
            SelectionBox.Visibility = Visibility.Collapsed;
            SelectionLabel.Visibility = Visibility.Collapsed;
        }

        private void ShowTool(ToolInfo tool)
        {
            _currentTool = tool;
            _profile = tool.Capability;
            PlaceholderPanel.Visibility = Visibility.Collapsed;
            DetailContent.Visibility = Visibility.Visible;
            CategoryText.Text = tool.CategoryDisplayName;
            CategoryText.Foreground = tool.CategoryAccentBrush ?? (Brush)FindResource("BrushCyan");
            ToolNameText.Text = tool.DisplayName;
            ToolIdText.Text = tool.ToolId;
            RiskText.Text = tool.RiskDisplayName;
            RiskBadge.Background = new SolidColorBrush(Color.FromArgb(0x25, 0x34, 0x78, 0xF6));
            RiskText.Foreground = tool.CategoryAccentBrush ?? (Brush)FindResource("BrushCyan");
            AdminBadge.Visibility = tool.RequiresAdmin ? Visibility.Visible : Visibility.Collapsed;
            RestartBadge.Visibility = tool.RequiresRestart ? Visibility.Visible : Visibility.Collapsed;
            PurposeText.Text = tool.Purpose ?? "Not specified";
            CapabilitiesList.ItemsSource = _profile.CapabilityChips;
            PreviewText.Text = _profile.PreviewSummary + Environment.NewLine +
                "Offline: " + (tool.OfflineCapability ?? "Not specified") + Environment.NewLine +
                "Analyze: " + (_profile.CanAnalyze ? "Supported" : "Not specified") + Environment.NewLine +
                "What-If: " + (_profile.CanWhatIf ? "Supported" : "Not specified");
            ParametersText.Text = _profile.InputParameters;
            BackupText.Text = _profile.PreservationSummary;
            RollbackText.Text = _profile.RecoverySummary;
            ExpectedText.Text = _profile.ExpectedOutputSummary;
            PathText.Text = tool.ScriptPath ?? "Not specified";
            RefreshEvidence();
            BuildActions();
        }

        private void BuildActions()
        {
            ActionBar.Children.Clear();
            var needsSelection = _profile.RequiresSelection;
            SelectionBox.Visibility = needsSelection ? Visibility.Visible : Visibility.Collapsed;
            SelectionLabel.Visibility = needsSelection ? Visibility.Visible : Visibility.Collapsed;
            if (needsSelection)
            {
                SelectionLabel.Text = "Required script input: " + _profile.InputParameters;
                SelectionBox.Text = string.Empty;
            }

            foreach (var action in _profile.Actions)
            {
                var button = new Button
                {
                    Content = action.Label,
                    Tag = action,
                    ToolTip = action.Description,
                    Padding = new Thickness(9, 5, 9, 5),
                    Margin = new Thickness(0, 0, 7, 0),
                    Style = FindResource(action.Kind == ToolActionKind.Preview ? "SecondaryButton" : "AccentButton") as Style
                };
                AutomationProperties.SetName(button, action.Label + " " + (_currentTool?.DisplayName ?? "tool"));
                button.Click += Action_Click;
                ActionBar.Children.Add(button);
            }
        }

        private void Action_Click(object sender, RoutedEventArgs e)
        {
            if (_currentTool == null || sender is not Button b || b.Tag is not ToolActionDescriptor action) return;
            if (action.RequiresSelection && string.IsNullOrWhiteSpace(SelectionBox.Text))
            {
                MessageBox.Show("The script declares a required input. Enter its value before executing.", "Selection required", MessageBoxButton.OK, MessageBoxImage.Information);
                SelectionBox.Focus();
                return;
            }
            if (action.RequiresConfirmation && MessageBox.Show("This action can change system state. Continue?", "Confirm action", MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) != MessageBoxResult.Yes) return;
            if (action.Kind == ToolActionKind.Preview) { RefreshEvidence(); return; }
            ToolActionRequested?.Invoke(new ToolExecutionRequest { Tool = _currentTool, Action = action, Selection = SelectionBox.Text });
        }

        public void ShowPreview() { if (_currentTool != null) { DetailContent.Visibility = Visibility.Visible; RefreshEvidence(); } }
        public void PrepareAction(ToolActionDescriptor action) { SelectionBox.Visibility = Visibility.Visible; SelectionLabel.Visibility = Visibility.Visible; SelectionBox.Focus(); }
        public void RefreshEvidence()
        {
            if (_currentTool == null) return;
            var evidence = ToolExecutionEvidence.Get(_currentTool.ToolId);
            var text = evidence.State;
            if (evidence.Elapsed.HasValue) text += " · elapsed " + evidence.Elapsed.Value.TotalSeconds.ToString("0.0") + "s";
            if (evidence.ExitCode.HasValue) text += " · exit " + evidence.ExitCode.Value;
            if (!string.IsNullOrWhiteSpace(evidence.ReportPath)) text += Environment.NewLine + "Report: " + evidence.ReportPath;
            if (!string.IsNullOrWhiteSpace(evidence.BackupPath)) text += Environment.NewLine + "Backup: " + evidence.BackupPath;
            if (!string.IsNullOrWhiteSpace(evidence.QuarantinePath)) text += Environment.NewLine + "Quarantine: " + evidence.QuarantinePath;
            if (!string.IsNullOrWhiteSpace(evidence.RecoveryInformation)) text += Environment.NewLine + "Recovery: " + evidence.RecoveryInformation;
            if (evidence.Stderr.Count > 0) text += Environment.NewLine + "stderr: " + evidence.Stderr[evidence.Stderr.Count - 1];
            EvidenceText.Text = text;
        }
    }
}
