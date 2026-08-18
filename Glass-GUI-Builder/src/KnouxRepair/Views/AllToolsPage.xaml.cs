using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using KnouxRepair.Models;
using KnouxRepair.ViewModels;

namespace KnouxRepair.Views
{
    public partial class AllToolsPage : UserControl
    {
        private AllToolsViewModel _vm;

        public event Action<string, bool> ToolExecutionRequested;
        public event Action<ToolInfo> ToolPreviewRequested;

        public AllToolsPage()
        {
            InitializeComponent();
            _vm = (AllToolsViewModel)FindResource("VM");
            DataContext = _vm;
            DetailPanel.ToolExecutionRequested += OnToolExecutionRequested;
            
            // Create commands for ToolCard binding
            _vm.ExecuteToolCommand = new RelayCommand(ExecuteTool);
            _vm.PreviewToolCommand = new RelayCommand(PreviewTool);
        }

        private void ExecuteTool(object parameter)
        {
            if (parameter is ToolInfo tool)
            {
                _vm.SelectedTool = tool;
                DetailPanel.DataContext = tool;
                // Trigger execution with analyzeOnly=false
                ToolExecutionRequested?.Invoke(tool.ScriptPath, false);
            }
        }

        private void PreviewTool(object parameter)
        {
            if (parameter is ToolInfo tool)
            {
                _vm.SelectedTool = tool;
                DetailPanel.DataContext = tool;
                ToolPreviewRequested?.Invoke(tool);
            }
        }

        public void ApplyGlobalFilter(string filterText)
        {
            _vm.FilterText = filterText;
        }

        public void ClearGlobalFilter()
        {
            _vm.FilterText = "";
        }

        private void OnToolExecutionRequested(string scriptPath, bool analyzeOnly)
            => ToolExecutionRequested?.Invoke(scriptPath, analyzeOnly);

        private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            _vm.FilterText = ((TextBox)sender).Text;
        }
    }
}
