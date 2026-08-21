using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Shell;
using System.Windows.Threading;
using KnouxRepair.Models;
using KnouxRepair.Services;

namespace KnouxRepair.Views
{
    public partial class MainWindow : Window
    {
        public static MainWindow Instance { get; private set; }

        private IntPtr _hwnd;
        private HwndSource _source;
        private const int WM_GETMINMAXINFO = 0x0024;
        private const int WM_DPICHANGED = 0x02E0;
        private const int MaxConsoleLines = 10000;
        private int _consoleLineCount;
        private string _currentToolName;
        private string _activeEvidenceToolId;
        private readonly DispatcherTimer _toastTimer;
        private bool _toastVisible;

        public MainWindow()
        {
            Instance = this;
            InitializeComponent();

            _toastTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
            _toastTimer.Tick += (s, e) => HideToast();

            SourceInitialized += MainWindow_SourceInitialized;
            StateChanged += MainWindow_StateChanged;
            Loaded += MainWindow_Loaded;
            ThemeService.LanguageChanged += OnLanguageChanged;
        }

        // === Native window plumbing ===

        private void MainWindow_SourceInitialized(object sender, EventArgs e)
        {
            _hwnd = new WindowInteropHelper(this).Handle;
            _source = HwndSource.FromHwnd(_hwnd);
            _source.AddHook(WndProc);

            ApplyAcrylic();
        }

        private void MainWindow_StateChanged(object sender, EventArgs e)
        {
            var maximized = WindowState == WindowState.Maximized;
            RootBorder.CornerRadius = maximized ? new CornerRadius(0) : new CornerRadius(12);
            RootBorder.Effect = maximized ? null : (Effect)FindResource("WindowShadow");
            BtnMaximize.Content = maximized ? "\uE923" : "\uE922";
        }

        // Keep maximized window inside the working area (taskbar visible)
        private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_GETMINMAXINFO)
            {
                var mmi = Marshal.PtrToStructure<MINMAXINFO>(lParam);
                var monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                if (monitor != IntPtr.Zero)
                {
                    var info = new MONITORINFO();
                    info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
                    if (GetMonitorInfo(monitor, ref info))
                    {
                        var wa = info.rcWork;
                        var border = (int)SystemParameters.WindowResizeBorderThickness.Left;
                        mmi.ptMaxPosition.X = wa.Left - border;
                        mmi.ptMaxPosition.Y = wa.Top - border;
                        mmi.ptMaxSize.X = wa.Right - wa.Left + (border * 2);
                        mmi.ptMaxSize.Y = wa.Bottom - wa.Top + (border * 2);
                    }
                }
                Marshal.StructureToPtr(mmi, lParam, true);
                handled = true;
            }
            return IntPtr.Zero;
        }

        // DWM acrylic blur with silent fallback (tech plan 6.3)
        private void ApplyAcrylic()
        {
            try
            {
                var accent = new ACCENT_POLICY
                {
                    AccentState = ACCENT_ENABLE_BLURBEHIND,
                    AccentFlags = 2,
                    GradientColor = 0xCC050B14
                };
                var data = new WINDOWCOMPOSITIONATTRIBDATA
                {
                    Attribute = WCA_ACCENT_POLICY,
                    Data = accent,
                    SizeOfData = Marshal.SizeOf(typeof(ACCENT_POLICY))
                };
                SetWindowCompositionAttribute(_hwnd, ref data);
            }
            catch
            {
                // Solid dark background remains visually coherent
            }
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // Set admin badge
            var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            _isAdmin = principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
            UpdateAdminBadge();

            // Show tool count
            var toolCount = ManifestService.Tools.Count;
            ToolCountText.Text = string.Format((string)FindResource("StatusToolsLoaded"), toolCount);

            // Apply saved language
            var lang = SettingsService.Settings.Language;
            ThemeService.SetLanguage(lang);

            // Set analyze toggle
            AnalyzeToggle.IsChecked = SettingsService.Settings.AnalyzeOnlyDefault;
            UpdateAnalyzeStatus();

            // Start reports service
            ReportsService.StartWatching();

            // Console wiring
            PowerShellService.OutputReceived += OnToolOutput;
            PowerShellService.ErrorReceived += OnToolError;
            PowerShellService.ProcessExited += OnToolExited;
            ReportsService.NewReportDetected += OnNewReportDetected;
            NotificationService.Posted += OnNotificationPosted;

            NotificationList.ItemsSource = Services.NotificationService.Items;

            // Navigate to dashboard by default
            NavigateTo("Dashboard");
        }

        private void UpdateAdminBadge()
        {
            if (AdminBadgeText == null) return;
            AdminBadgeText.Text = _isAdmin
                ? (string)FindResource("AdminElevated")
                : (string)FindResource("AdminStandard");
            AdminBadgeText.Foreground = _isAdmin
                ? (Brush)FindResource("BrushAmber")
                : (Brush)FindResource("BrushMuted");
        }

        private void OnLanguageChanged()
        {
            UpdateAdminBadge();
            if (ToolCountText != null)
                ToolCountText.Text = string.Format((string)FindResource("StatusToolsLoaded"), ManifestService.Tools.Count);
            UpdateAnalyzeStatus();
            if (StatusText != null)
                StatusText.Text = (string)FindResource("StatusReady");
        }

        protected override void OnClosed(EventArgs e)
        {
            PowerShellService.OutputReceived -= OnToolOutput;
            PowerShellService.ErrorReceived -= OnToolError;
            PowerShellService.ProcessExited -= OnToolExited;
            ReportsService.NewReportDetected -= OnNewReportDetected;
            NotificationService.Posted -= OnNotificationPosted;
            ThemeService.LanguageChanged -= OnLanguageChanged;
            ReportsService.StopWatching();
            base.OnClosed(e);
        }

        // === Window buttons ===

        private void BtnNotifications_Click(object sender, RoutedEventArgs e)
        {
            NotificationsPopup.IsOpen = !NotificationsPopup.IsOpen;
        }

        private void OnNewReportDetected(ReportEntry report)
        {
            var title = (string)FindResource("NotifReportCreated");
            var message = $"{report.ToolId}: {report.ToolName} — {report.FolderName}";
            Dispatcher.Invoke(() => NotificationService.Post(title, message, "Success"));
        }

        private void OnNotificationPosted(NotificationItem item)
        {
            Dispatcher.Invoke(() => ShowToast(item.Title, item.Message, item.Severity));
        }

        private void ShowToast(string title, string message, string severity)
        {
            ToastTitleText.Text = title;
            ToastMessageText.Text = message;

            var brushKey = severity switch
            {
                "Success" => "BrushGreen",
                "Warning" => "BrushAmber",
                "Error" => "BrushRed",
                _ => "BrushCyan"
            };
            ToastDot.Fill = (Brush)FindResource(brushKey);

            ToastHost.Visibility = Visibility.Visible;
            ToastHost.Opacity = 0;
            ToastTransform.X = 40;

            var slide = new DoubleAnimation(40, 0, TimeSpan.FromMilliseconds(250));
            slide.EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut };
            var fade = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(250));
            ToastHost.BeginAnimation(OpacityProperty, fade);
            ToastTransform.BeginAnimation(TranslateTransform.XProperty, slide);

            _toastTimer.Stop();
            _toastTimer.Start();
            _toastVisible = true;
        }

        private void HideToast()
        {
            if (!_toastVisible) return;
            _toastVisible = false;
            var fade = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(300));
            fade.Completed += (s, e) => ToastHost.Visibility = Visibility.Collapsed;
            ToastHost.BeginAnimation(OpacityProperty, fade);
        }

        private void BtnMinimize_Click(object sender, RoutedEventArgs e)
            => WindowState = WindowState.Minimized;

        private void BtnMaximize_Click(object sender, RoutedEventArgs e)
            => ToggleMaximize();

        private void ToggleMaximize()
        {
            WindowState = WindowState == WindowState.Maximized
                ? WindowState.Normal
                : WindowState.Maximized;
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            if (PowerShellService.IsRunning)
            {
                if (!ConfirmDialog("ConfirmExitTitle", "ConfirmExitMessage", MessageBoxImage.Warning))
                    return;
                PowerShellService.Stop();
            }
            Close();
        }

        // === Navigation ===

        private void Nav_Checked(object sender, RoutedEventArgs e)
        {
            if (PageContent == null || StatusText == null) return;
            var radio = sender as System.Windows.Controls.RadioButton;
            if (radio?.Tag is string page)
            {
                NavigateTo(page);
            }
        }

        public void NavigateTo(string page)
        {
            if (PageContent == null || StatusText == null) return;

            System.Windows.Controls.UserControl content = page switch
            {
                "Dashboard" => new DashboardPage(),
                "AllTools" => new AllToolsPage(),
                "Reports" => new ReportsPage(),
                "Quarantine" => new QuarantinePage(),
                "Backups" => new BackupsPage(),
                "TestCenter" => new TestCenterPage(),
                "Settings" => new SettingsPage(),
                "About" => new AboutPage(),
                _ => new DashboardPage()
            };

            if (content is AllToolsPage toolsPage)
            {
                toolsPage.ToolActionRequested += RunToolAction;
                _currentToolsPage = toolsPage;
            }
            else
            {
                _currentToolsPage = null;
            }

            PageContent.Content = content;
            StatusText.Text = string.Format((string)FindResource("StatusNavigate"), page);
        }

        public void NavigateToPage(string page)
        {
            NavigateTo(page);
            // Update sidebar radio to reflect current page
            foreach (var child in NavItems.Children)
            {
                if (child is System.Windows.Controls.RadioButton rb && rb.Tag?.ToString() == page)
                {
                    rb.IsChecked = true;
                    break;
                }
            }
        }

        private AllToolsPage _currentToolsPage;
        private bool _isAdmin;

        // === Search ===

        private void SearchBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            var text = SearchBox.Text;

            if (!string.IsNullOrWhiteSpace(text))
            {
                // Navigate to All Tools on first keystroke so the filter is visible
                if (_currentToolsPage == null)
                {
                    NavigateTo("AllTools");
                }
                _currentToolsPage?.ApplyGlobalFilter(text);
            }
            else
            {
                _currentToolsPage?.ClearGlobalFilter();
            }
        }

        // === Analyze Toggle ===

        private void AnalyzeToggle_Click(object sender, RoutedEventArgs e)
        {
            SettingsService.SetAnalyzeOnly(AnalyzeToggle.IsChecked == true);
            UpdateAnalyzeStatus();
        }

        private void UpdateAnalyzeStatus()
        {
            var isOn = AnalyzeToggle.IsChecked == true;
            AnalyzeStatusText.Text = isOn
                ? (string)FindResource("AnalyzeOnlyOn")
                : (string)FindResource("AnalyzeOnlyOff");
            AnalyzeStatusText.Foreground = isOn
                ? (Brush)FindResource("BrushCyan")
                : (Brush)FindResource("BrushMuted");
        }

        // === Language Toggle ===

        private void LangToggle_Click(object sender, RoutedEventArgs e)
        {
            var current = SettingsService.Settings.Language;
            var newLang = ThemeService.IsArabic(current) ? "English" : "العربية";
            SettingsService.SetLanguage(newLang);
            ThemeService.SetLanguage(newLang);
        }

        // === Tool Execution (T5) ===

        private void RunToolAction(ToolExecutionRequest request)
        {
            if (request?.Tool == null || request.Action == null || request.Action.Kind == ToolActionKind.Preview) return;
            ToolExecutionEvidence.Begin(request.Tool.ToolId);
            _activeEvidenceToolId = request.Tool.ToolId;
            RunTool(request.Tool.ScriptPath, request.AnalyzeOnly, request.Arguments, request.Tool.ToolId);
        }

        public void RunTool(string scriptPath, bool analyzeOnlyRequested) => RunTool(scriptPath, analyzeOnlyRequested, string.Empty, null);

        private void RunTool(string scriptPath, bool analyzeOnlyRequested, string arguments, string toolId)
        {
            if (PowerShellService.IsRunning)
            {
                StatusText.Text = (string)FindResource("StatusBusy");
                return;
            }

            var effectiveAnalyze = analyzeOnlyRequested || SettingsService.Settings.AnalyzeOnlyDefault;

            _currentToolName = null;
            foreach (var tool in ManifestService.Tools)
            {
                if (string.Equals(ManifestService.ResolveScriptPath(tool.ScriptPath), scriptPath, StringComparison.OrdinalIgnoreCase))
                {
                    _currentToolName = tool.EnglishName;
                    break;
                }
            }

            ShowConsole();
            ConsoleOutput.Text = "";
            _consoleLineCount = 0;
            BtnStopTool.Visibility = Visibility.Visible;
            ConsoleMetaText.Text = effectiveAnalyze
                ? (string)FindResource("ConsoleModeAnalyze")
                : (string)FindResource("ConsoleModeRun");
            SetStatusText((string)FindResource("StatusRunning"));

            _ = ExecuteToolAsync(scriptPath, effectiveAnalyze, arguments, toolId);
        }

        private async Task ExecuteToolAsync(string scriptPath, bool analyzeOnly, string arguments = "", string toolId = null)
        {
            try
            {
                var exitCode = await PowerShellService.RunAsync(scriptPath, arguments: arguments, analyzeOnly: analyzeOnly);
                if (!string.IsNullOrWhiteSpace(toolId))
                    ToolExecutionEvidence.Complete(toolId, exitCode, exitCode == -1);
                var statusKey = exitCode == 0 ? "StatusCompleted" : "StatusFailed";
                SetStatusText((string)FindResource(statusKey));
            }
            catch (InvalidOperationException ex)
            {
                SetStatusText(ex.Message);
            }
            catch (Exception)
            {
                SetStatusText((string)FindResource("StatusFailed"));
            }
        }

        // Generic command execution through the console (quarantine restore, etc.)
        public void RunCommand(string command, string runMessage = null)
        {
            if (PowerShellService.IsRunning)
            {
                SetStatusText((string)FindResource("StatusBusy"));
                return;
            }

            ShowConsole();
            ConsoleOutput.Text = "";
            _consoleLineCount = 0;
            BtnStopTool.Visibility = Visibility.Visible;
            ConsoleMetaText.Text = runMessage ?? (string)FindResource("ConsoleModeRun");
            SetStatusText(runMessage ?? (string)FindResource("StatusRunning"));

            _ = RunCommandAsync(command, runMessage);
        }

        private async Task RunCommandAsync(string command, string runMessage)
        {
            try
            {
                var exitCode = await PowerShellService.RunCommandAsync(command);
                var statusKey = exitCode == 0 ? "StatusCompleted" : "StatusFailed";
                SetStatusText((string)FindResource(statusKey));
            }
            catch (InvalidOperationException ex)
            {
                SetStatusText(ex.Message);
            }
            catch (Exception)
            {
                SetStatusText((string)FindResource("StatusFailed"));
            }
        }

        private void OnToolOutput(string line)
        {
            if (!string.IsNullOrWhiteSpace(line))
            {
                if (!string.IsNullOrWhiteSpace(_activeEvidenceToolId))
                    ToolExecutionEvidence.AppendOutput(_activeEvidenceToolId, line, false);
                AppendConsoleLine(line);
            }
        }

        private void OnToolError(string line)
        {
            if (!string.IsNullOrWhiteSpace(line))
            {
                if (!string.IsNullOrWhiteSpace(_activeEvidenceToolId))
                    ToolExecutionEvidence.AppendOutput(_activeEvidenceToolId, line, true);
                AppendConsoleLine(line, isError: true);
            }
        }

        private void OnToolExited(int exitCode)
        {
            Dispatcher.Invoke(() =>
            {
                BtnStopTool.Visibility = Visibility.Collapsed;
                ConsoleMetaText.Text = exitCode == 0
                    ? (string)FindResource("ConsoleDoneOk")
                    : ((string)FindResource("ConsoleDoneCode")).Replace("{0}", exitCode.ToString());
                SetStatusText(exitCode == 0
                    ? (string)FindResource("StatusCompleted")
                    : (string)FindResource("StatusFailed"));

                var severity = exitCode == 0 ? "Success" : "Error";
                var title = (string)FindResource("NotifToolComplete");
                var message = string.IsNullOrEmpty(_currentToolName)
                    ? severity == "Success" ? (string)FindResource("StatusCompleted") : (string)FindResource("StatusFailed")
                    : _currentToolName;
                NotificationService.Post(title, message, severity);
            });
        }

        private void AppendConsoleLine(string line, bool isError = false)
        {
            Dispatcher.Invoke(() =>
            {
                if (_consoleLineCount >= MaxConsoleLines)
                {
                    // Drop oldest chunk to keep memory bounded
                    var idx = ConsoleOutput.Text.IndexOf('\n');
                    if (idx >= 0)
                    {
                        ConsoleOutput.Text = ConsoleOutput.Text.Substring(idx + 1);
                        _consoleLineCount--;
                    }
                }

                var run = new System.Windows.Documents.Run(line + Environment.NewLine)
                {
                    Foreground = isError
                        ? (Brush)FindResource("BrushRed")
                        : (Brush)FindResource("BrushTextMain")
                };
                ConsoleOutput.Inlines.Add(run);
                _consoleLineCount++;

                if (SettingsService.Settings.ConsoleAutoScroll)
                    ConsoleScroller.ScrollToEnd();

                if (ConsolePanel.Visibility != Visibility.Visible)
                    ConsolePanel.Visibility = Visibility.Visible;
            });
        }

        public void ShowConsole()
        {
            Dispatcher.Invoke(() => ConsolePanel.Visibility = Visibility.Visible);
        }

        // === Console ===

        private void BtnToggleConsole_Click(object sender, RoutedEventArgs e)
        {
            ConsolePanel.Visibility = ConsolePanel.Visibility == Visibility.Visible
                ? Visibility.Collapsed
                : Visibility.Visible;
        }

        private void BtnCloseConsole_Click(object sender, RoutedEventArgs e)
        {
            ConsolePanel.Visibility = Visibility.Collapsed;
        }

        private void BtnStopTool_Click(object sender, RoutedEventArgs e)
        {
            if (PowerShellService.IsRunning)
            {
                if (ConfirmDialog("ConfirmStopTitle", "ConfirmStopMessage", MessageBoxImage.Warning))
                {
                    PowerShellService.Stop();
                    SetStatusText((string)FindResource("StatusCancelled"));
                    ConsoleMetaText.Text = (string)FindResource("ConsoleStopped");
                    BtnStopTool.Visibility = Visibility.Collapsed;
                }
            }
        }

        // === Helpers ===

        public void SetStatusText(string text)
        {
            Dispatcher.Invoke(() =>
            {
                if (StatusText != null) StatusText.Text = text;
            });
        }

        // RTL-aware confirmation dialog
        private bool ConfirmDialog(string titleKey, string messageKey, MessageBoxImage icon)
        {
            var title = (string)FindResource(titleKey);
            var message = (string)FindResource(messageKey);
            var opts = MessageBoxOptions.None;
            if (ThemeService.IsArabic(SettingsService.Settings.Language))
                opts |= MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign;
            return MessageBox.Show(this, message, title,
                MessageBoxButton.YesNo, icon, MessageBoxResult.No, opts) == MessageBoxResult.Yes;
        }

        // === P/Invoke ===

        private const uint MONITOR_DEFAULTTONEAREST = 2;
        private const int ACCENT_ENABLE_BLURBEHIND = 3;
        private const int WCA_ACCENT_POLICY = 19;

        [DllImport("user32.dll")]
        private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

        [DllImport("user32.dll")]
        private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

        [DllImport("user32.dll")]
        private static extern int SetWindowCompositionAttribute(IntPtr hwnd, ref WINDOWCOMPOSITIONATTRIBDATA data);

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MINMAXINFO
        {
            public POINT ptReserved;
            public POINT ptMaxSize;
            public POINT ptMaxPosition;
            public POINT ptMinTrackSize;
            public POINT ptMaxTrackSize;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct MONITORINFO
        {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ACCENT_POLICY
        {
            public int AccentState;
            public int AccentFlags;
            public uint GradientColor;
            public int AnimationId;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct WINDOWCOMPOSITIONATTRIBDATA
        {
            public int Attribute;
            public ACCENT_POLICY Data;
            public int SizeOfData;
        }
    }
}
