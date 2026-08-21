using System;
using System.Windows;

namespace KnouxRepair.Services
{
    public static class ThemeService
    {
        private static ResourceDictionary _currentLang;
        private static ResourceDictionary _currentTheme;

        public static event Action LanguageChanged;

        public static void ApplyTheme(string theme)
        {
            var app = Application.Current;
            if (app == null) return;
            if (_currentTheme != null) app.Resources.MergedDictionaries.Remove(_currentTheme);
            _currentTheme = null;
            if (string.Equals(theme, "Light", StringComparison.OrdinalIgnoreCase))
            {
                _currentTheme = new ResourceDictionary { Source = new Uri("/Themes/Light.xaml", UriKind.Relative) };
                app.Resources.MergedDictionaries.Add(_currentTheme);
            }
        }

        public static bool IsArabic(string lang)
        {
            if (string.IsNullOrEmpty(lang)) return false;
            if (lang.StartsWith("ar", StringComparison.OrdinalIgnoreCase)) return true;
            foreach (char c in lang)
                if (c >= 0x0600 && c <= 0x06FF) return true;
            return false;
        }

        public static void SetLanguage(string lang)
        {
            var app = Application.Current;
            if (app == null) return;
            var langKey = IsArabic(lang) ? "ar" : "en";
            var dictPath = $"/Resources/Strings.{langKey}.xaml";
            if (_currentLang != null) app.Resources.MergedDictionaries.Remove(_currentLang);
            _currentLang = new ResourceDictionary { Source = new Uri(dictPath, UriKind.Relative) };
            app.Resources.MergedDictionaries.Add(_currentLang);
            var flowDir = langKey == "ar" ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
            foreach (Window window in app.Windows) window.FlowDirection = flowDir;
            try { LanguageChanged?.Invoke(); } catch { }
        }
    }
}
