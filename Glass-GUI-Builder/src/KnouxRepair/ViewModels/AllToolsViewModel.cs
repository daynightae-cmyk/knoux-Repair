using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using KnouxRepair.Models;
using KnouxRepair.Mvvm;

namespace KnouxRepair.ViewModels
{
    public class AllToolsViewModel : ViewModelBase
    {
        private readonly List<ToolInfo> _allTools;
        private string _filterText = "";
        private string _selectedCategory = "All";
        private ToolInfo _selectedTool;

        public AllToolsViewModel()
        {
            _allTools = Services.ManifestService.Tools;
            LoadCategories();
            FilterTools();
        }

        public ObservableCollection<string> Categories { get; } = new ObservableCollection<string>();
        public ObservableCollection<ToolInfo> FilteredTools { get; } = new ObservableCollection<ToolInfo>();

        public string FilterText
        {
            get => _filterText;
            set { SetProperty(ref _filterText, value); FilterTools(); }
        }

        public string SelectedCategory
        {
            get => _selectedCategory;
            set { SetProperty(ref _selectedCategory, value); FilterTools(); }
        }

        public ToolInfo SelectedTool
        {
            get => _selectedTool;
            set => SetProperty(ref _selectedTool, value);
        }

        public int TotalFiltered => FilteredTools.Count;

        private void LoadCategories()
        {
            Categories.Add("All");
            var cats = _allTools.Select(t => t.Category).Distinct().OrderBy(c => c);
            foreach (var cat in cats)
            {
                var display = FormatCategoryDisplay(cat);
                Categories.Add(display);
            }
        }

        private static string FormatCategoryDisplay(string category)
        {
            var dash = category.IndexOf('-');
            if (dash >= 0) return category.Substring(dash + 1).Replace('-', ' ');
            return category;
        }

        public void FilterTools()
        {
            FilteredTools.Clear();
            var query = _allTools.AsEnumerable();

            if (SelectedCategory != "All")
            {
                var selectedCanonical = GetCanonicalCategoryFromDisplay(SelectedCategory);
                query = query.Where(t => t.Category == selectedCanonical);
            }

            if (!string.IsNullOrWhiteSpace(FilterText))
            {
                var f = FilterText.ToLower();
                query = query.Where(t =>
                    (t.ToolId != null && t.ToolId.ToLower().Contains(f)) ||
                    (t.EnglishName != null && t.EnglishName.ToLower().Contains(f)) ||
                    (t.ArabicName != null && t.ArabicName.Contains(f)) ||
                    (t.Purpose != null && t.Purpose.ToLower().Contains(f)));
            }

            foreach (var tool in query)
                FilteredTools.Add(tool);

            OnPropertyChanged(nameof(TotalFiltered));
        }

        private string GetCanonicalCategoryFromDisplay(string display)
        {
            var cats = _allTools.Select(t => t.Category).Distinct();
            foreach (var cat in cats)
            {
                if (FormatCategoryDisplay(cat) == display)
                    return cat;
            }
            return display;
        }
    }
}
