using System;
using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;

namespace KnouxRepair.Converters
{
    public class BoolToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool b)
                return b ? Visibility.Visible : Visibility.Collapsed;

            return Visibility.Collapsed;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is Visibility visibility)
                return visibility == Visibility.Visible;

            return Binding.DoNothing;
        }
    }

    /// <summary>
    /// Converts OfflineCapability string "FULL" to Visibility.Visible.
    /// This is a display-only conversion and is intentionally not reversible.
    /// </summary>
    public class StringEqualsFullToVisConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is string s && s.Equals("FULL", StringComparison.OrdinalIgnoreCase))
                return Visibility.Visible;

            return Visibility.Collapsed;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return Binding.DoNothing;
        }
    }

    public class RiskToBrushConverter : IValueConverter
    {
        private static readonly SolidColorBrush ReadOnlyBrush = new(Color.FromRgb(0x4C, 0xE3, 0x8A));
        private static readonly SolidColorBrush DestructiveBrush = new(Color.FromRgb(0xFF, 0x5B, 0x69));
        private static readonly SolidColorBrush SystemRepairBrush = new(Color.FromRgb(0xF4, 0xB9, 0x42));
        private static readonly SolidColorBrush RebootBrush = new(Color.FromRgb(0x34, 0x78, 0xF6));
        private static readonly SolidColorBrush DefaultBrush = new(Color.FromRgb(0x9F, 0xB2, 0xC8));

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is string risk)
            {
                return risk.ToUpperInvariant() switch
                {
                    "READ_ONLY" => ReadOnlyBrush,
                    "DESTRUCTIVE" => DestructiveBrush,
                    "SYSTEM_REPAIR" => SystemRepairBrush,
                    "REBOOT_REQUIRED" => RebootBrush,
                    _ => DefaultBrush
                };
            }

            return DefaultBrush;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return Binding.DoNothing;
        }
    }

    public class RiskToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is string risk && parameter is string expected)
                return risk.Equals(expected, StringComparison.OrdinalIgnoreCase)
                    ? Visibility.Visible
                    : Visibility.Collapsed;

            return Visibility.Collapsed;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return Binding.DoNothing;
        }
    }
}
