using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using KnouxRepair.Models;
using KnouxRepair.ViewModels;

namespace KnouxRepair.Views
{
    public partial class AllToolsPage : UserControl
    {
        private readonly AllToolsViewModel _vm;
        public event Action<ToolExecutionRequest> ToolActionRequested;
        public AllToolsPage()
        {
            InitializeComponent(); _vm = (AllToolsViewModel)FindResource("VM"); DataContext = _vm;
            DetailPanel.ToolActionRequested += request => ToolActionRequested?.Invoke(request);
            Services.ThemeService.LanguageChanged += RefreshToolPresentation; ToolExecutionEvidence.Changed += OnEvidenceChanged;
            Unloaded += (_, __) => { Services.ThemeService.LanguageChanged -= RefreshToolPresentation; ToolExecutionEvidence.Changed -= OnEvidenceChanged; };
        }
        public void ApplyGlobalFilter(string filterText) => _vm.FilterText = filterText;
        public void ClearGlobalFilter() => _vm.FilterText = string.Empty;
        private void SearchBox_TextChanged(object sender, TextChangedEventArgs e) => _vm.FilterText = ((TextBox)sender).Text;
        private void RefreshToolPresentation() { if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(RefreshToolPresentation); return; } _vm.FilterTools(); if (_vm.SelectedTool != null) DetailPanel.DataContext = _vm.SelectedTool; }
        private void OnEvidenceChanged(string toolId) { Dispatcher.BeginInvoke(new Action(() => { if (_vm.SelectedTool?.ToolId == toolId) DetailPanel.RefreshEvidence(); System.Windows.Data.CollectionViewSource.GetDefaultView(_vm.FilteredTools).Refresh(); })); }
        private void SelectTool(ToolInfo tool) { _vm.SelectedTool = tool; DetailPanel.DataContext = tool; }
        private void ToolCard_Click(object sender, MouseButtonEventArgs e) { if (sender is FrameworkElement el && el.DataContext is ToolInfo t) SelectTool(t); }
        private void ToolActionButton_Click(object sender, RoutedEventArgs e) { if (sender is not FrameworkElement el || el.Tag is not ToolActionDescriptor action) return; var tool = FindDataContext<ToolInfo>(el); if (tool == null) return; SelectTool(tool); if (action.Kind == ToolActionKind.Preview || action.RequiresSelection) DetailPanel.PrepareAction(action); else ToolActionRequested?.Invoke(new ToolExecutionRequest { Tool = tool, Action = action }); e.Handled = true; }
        private static T FindDataContext<T>(DependencyObject source) where T : class { for (var c = source; c != null; c = VisualTreeHelper.GetParent(c)) if (c is FrameworkElement el && el.DataContext is T value) return value; return null; }
    }
}
