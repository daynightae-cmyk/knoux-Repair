using System.Windows;

namespace KnouxRepair
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // Apply saved settings
            var settings = Services.SettingsService.Settings;
            Services.ThemeService.SetLanguage(settings.Language);
        }
    }
}
