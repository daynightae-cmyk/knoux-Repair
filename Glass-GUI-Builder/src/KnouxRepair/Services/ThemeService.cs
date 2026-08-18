using System;
using System.Windows;

namespace KnouxRepair.Services
{
    public static class ThemeService
    {
        private static ResourceDictionary _currentLang;

        public static event Action LanguageChanged;

        public static void ApplyTheme(string theme)
        {
            // Future: switch between theme dictionaries if needed
            // Currently all themes are baked into Themes/Colors.xaml
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

            // Remove old language dict
            if (_currentLang != null)
            {
                app.Resources.MergedDictionaries.Remove(_currentLang);
            }

            _currentLang = new ResourceDictionary
            {
                Source = new Uri(dictPath, UriKind.Relative)
            };
            app.Resources.MergedDictionaries.Add(_currentLang);

            // Set FlowDirection for RTL on all open windows
            var flowDir = langKey == "ar" ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
            foreach (Window window in app.Windows)
            {
                window.FlowDirection = flowDir;
            }

            try { LanguageChanged?.Invoke(); } catch { }
        }
    }
}
