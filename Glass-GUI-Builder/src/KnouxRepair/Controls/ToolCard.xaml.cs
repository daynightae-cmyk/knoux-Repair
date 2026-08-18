using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using KnouxRepair.Mappers;
using KnouxRepair.Models;

namespace KnouxRepair.Controls
{
    /// <summary>
    /// A reusable ToolCard control that displays tool metadata and actions
    /// derived from the ToolInfo object.
    /// </summary>
    public partial class ToolCard : UserControl, INotifyPropertyChanged
    {
        #region Dependency Properties

        public static readonly DependencyProperty ToolProperty =
            DependencyProperty.Register(nameof(Tool), typeof(ToolInfo), typeof(ToolCard),
                new PropertyMetadata(null, OnToolChanged));

        public static readonly DependencyProperty PrimaryActionCommandProperty =
            DependencyProperty.Register(nameof(PrimaryActionCommand), typeof(ICommand), typeof(ToolCard),
                new PropertyMetadata(null));

        public static readonly DependencyProperty SecondaryActionCommandProperty =
            DependencyProperty.Register(nameof(SecondaryActionCommand), typeof(ICommand), typeof(ToolCard),
                new PropertyMetadata(null));

        public static readonly DependencyProperty CategoryIconGeometryProperty =
            DependencyProperty.Register(nameof(CategoryIconGeometry), typeof(Geometry), typeof(ToolCard),
                new PropertyMetadata(null));

        #endregion

        private static void OnToolChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        {
            if (d is ToolCard card)
            {
                card.UpdateBindings();
            }
        }

        public ToolCard()
        {
            InitializeComponent();
        }

        #region Properties

        public ToolInfo Tool
        {
            get => (ToolInfo)GetValue(ToolProperty);
            set => SetValue(ToolProperty, value);
        }

        public ICommand PrimaryActionCommand
        {
            get => (ICommand)GetValue(PrimaryActionCommandProperty);
            set => SetValue(PrimaryActionCommandProperty, value);
        }

        public ICommand SecondaryActionCommand
        {
            get => (ICommand)GetValue(SecondaryActionCommandProperty);
            set => SetValue(SecondaryActionCommandProperty, value);
        }

        public Geometry CategoryIconGeometry
        {
            get => (Geometry)GetValue(CategoryIconGeometryProperty);
            set => SetValue(CategoryIconGeometryProperty, value);
        }

        // Computed properties for binding

        public Geometry MappedCategoryIcon => CategoryIconMapper.GetGeometry(Tool);

        public string LocalizedName
        {
            get
            {
                if (Tool == null) return string.Empty;
                
                var currentCulture = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
                return currentCulture == "ar" ? Tool.ArabicName : Tool.EnglishName;
            }
        }

        public bool IsArabicNameVisible => 
            CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ar" && Tool != null;

        public string RiskLabel => Tool != null ? RiskPresentationMapper.GetLabel(Tool.RiskLevel) : "Unknown";

        public Brush RiskForegroundBrush => Tool != null ? RiskPresentationMapper.GetForegroundBrush(Tool.RiskLevel) : Brushes.White;

        public Brush RiskBackgroundBrush => Tool != null ? RiskPresentationMapper.GetBackgroundBrush(Tool.RiskLevel) : Brushes.Transparent;

        public Brush RiskBorderBrush => Tool != null ? RiskPresentationMapper.GetBorderBrush(Tool.RiskLevel) : Brushes.Transparent;

        public string PrimaryActionLabel => Tool != null ? ActionLabelMapper.GetPrimaryAction(Tool) : "Run";

        public string SecondaryActionLabel1 => Tool != null ? ActionLabelMapper.GetSecondaryAction1(Tool) : null;

        public bool SecondaryAction1Visible => !string.IsNullOrEmpty(SecondaryActionLabel1);

        public IEnumerable<string> CapabilityChips
        {
            get
            {
                if (Tool == null) yield break;

                if (Tool.AnalyzeOnlySupported) yield return "Analyze";
                if (Tool.WhatIfSupported) yield return "WhatIf";
                
                if (!string.IsNullOrWhiteSpace(Tool.BackupMethod) && 
                    Tool.BackupMethod.ToLower() != "none" && 
                    Tool.BackupMethod.ToLower() != "none (read-only analysis)")
                    yield return "Backup";
                
                if (!string.IsNullOrWhiteSpace(Tool.RollbackMethod) && 
                    Tool.RollbackMethod.ToLower() != "none required")
                    yield return "Rollback";
            }
        }

        #endregion

        private void UpdateBindings()
        {
            OnPropertyChanged(nameof(MappedCategoryIcon));
            OnPropertyChanged(nameof(LocalizedName));
            OnPropertyChanged(nameof(IsArabicNameVisible));
            OnPropertyChanged(nameof(RiskLabel));
            OnPropertyChanged(nameof(RiskForegroundBrush));
            OnPropertyChanged(nameof(RiskBackgroundBrush));
            OnPropertyChanged(nameof(RiskBorderBrush));
            OnPropertyChanged(nameof(PrimaryActionLabel));
            OnPropertyChanged(nameof(SecondaryActionLabel1));
            OnPropertyChanged(nameof(SecondaryAction1Visible));
            OnPropertyChanged(nameof(CapabilityChips));
        }

        #region INotifyPropertyChanged Implementation

        public event PropertyChangedEventHandler PropertyChanged;

        protected virtual void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        #endregion
    }
}
