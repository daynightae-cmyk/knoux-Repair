using System;
using System.Windows;
using System.Windows.Controls;
using KnouxRepair.Models;
using KnouxRepair.ViewModels;

namespace KnouxRepair.Views
{
    public partial class AllToolsPage : UserControl
    {
        private AllToolsViewModel _vm;

        public event Action<string, bool> ToolExecutionRequested;

        public AllToolsPage()
        {
            InitializeComponent();
            _vm = (AllToolsViewModel)FindResource("VM");
            DataContext = _vm;
            DetailPanel.ToolExecutionRequested += OnToolExecutionRequested;
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

        private void ToolCard_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if (sender is FrameworkElement fe && fe.DataContext is ToolInfo tool)
            {
                _vm.SelectedTool = tool;
                DetailPanel.DataContext = tool;
            }
        }
    }
}
