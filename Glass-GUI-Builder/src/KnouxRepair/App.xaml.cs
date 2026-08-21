using System.Windows;

namespace KnouxRepair
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            var settings = Services.SettingsService.Settings;
            Services.ThemeService.ApplyTheme(settings.Theme);
            Services.ThemeService.SetLanguage(settings.Language);
        }
    }
}
