using System;
using System.IO;
using System.Text.Json;
using KnouxRepair.Models;

namespace KnouxRepair.Services
{
    public static class SettingsService
    {
        private static readonly string ConfigDir = Path.Combine(ManifestService.ProjectRoot, "Config");
        private static readonly string SettingsPath = Path.Combine(ConfigDir, "gui-settings.json");

        private static AppSettings _settings;

        public static AppSettings Settings => _settings ??= Load();

        public static event Action<AppSettings> SettingsChanged;

        private static AppSettings Load()
        {
            try
            {
                if (File.Exists(SettingsPath))
                {
                    var json = File.ReadAllText(SettingsPath);
                    return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
                }
            }
            catch { }
            return new AppSettings();
        }

        public static void Save()
        {
            try
            {
                Directory.CreateDirectory(ConfigDir);
                var json = JsonSerializer.Serialize(_settings, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(SettingsPath, json);
                SettingsChanged?.Invoke(_settings);
            }
            catch { }
        }

        public static void SetLanguage(string lang)
        {
            _settings.Language = lang;
            Save();
        }

        public static void SetTheme(string theme)
        {
            _settings.Theme = theme;
            Save();
        }

        public static void SetReducedMotion(bool value)
        {
            _settings.ReducedMotion = value;
            Save();
        }

        public static void SetCompactNav(bool value)
        {
            _settings.CompactNav = value;
            Save();
        }

        public static void SetAnalyzeOnly(bool value)
        {
            _settings.AnalyzeOnlyDefault = value;
            Save();
        }

        public static void SetConsoleAutoScroll(bool value)
        {
            _settings.ConsoleAutoScroll = value;
            Save();
        }

        public static void SetConsoleFontSize(double value)
        {
            _settings.ConsoleFontSize = value;
            Save();
        }

        public static void SetMaxReportHistory(int value)
        {
            _settings.MaxReportHistory = value;
            Save();
        }
    }
}
