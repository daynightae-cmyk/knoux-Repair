using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using KnouxRepair.Core;

namespace KnouxRepair.Views
{
    public partial class SplashScreen : Window
    {
        private readonly DispatcherTimer _timer;
        private int _step;
        private List<ValidationStep> _validation;
        private bool _isStarted;
        private bool _isCompleting;

        public SplashScreen()
        {
            InitializeComponent();
            _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(550) };
            _timer.Tick += Timer_Tick;
            Loaded += SplashScreen_Loaded;
        }

        private async void SplashScreen_Loaded(object sender, RoutedEventArgs e)
        {
            if (_isStarted) return;
            _isStarted = true;

            try
            {
                var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(400));
                fadeIn.EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut };
                var scaleIn = new DoubleAnimation(0.92, 1, TimeSpan.FromMilliseconds(450));
                scaleIn.EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut };
                RootBorder.BeginAnimation(OpacityProperty, fadeIn);
                RootScale.BeginAnimation(ScaleTransform.ScaleXProperty, scaleIn);
                RootScale.BeginAnimation(ScaleTransform.ScaleYProperty, scaleIn);

                StartRingAnimation();

                await Task.Delay(150);
                AnimateChild(0);
                await Task.Delay(120);
                AnimateChild(1);
                await Task.Delay(120);
                AnimateChild(2);

                _ = RunValidationAsync();

                await Task.Delay(250);
                _timer.Start();
            }
            catch
            {
                if (!_timer.IsEnabled && IsVisible)
                    _timer.Start();
            }
        }

        private void StartRingAnimation()
        {
            try
            {
                var rotateAnim = new DoubleAnimation(0, 360, TimeSpan.FromMilliseconds(2500));
                rotateAnim.RepeatBehavior = RepeatBehavior.Forever;
                RingRotation.BeginAnimation(RotateTransform.AngleProperty, rotateAnim);

                AnimateRingArc();
            }
            catch { }
        }

        private void AnimateRingArc()
        {
            try
            {
                var figure = RingGeometry.Figures[0];
                var arc = figure.Segments[0] as ArcSegment;

                var arcTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(30) };
                double angle = 0;
                arcTimer.Tick += (s, e) =>
                {
                    try
                    {
                        angle += 5;
                        if (angle > 300) angle = 300;
                        double rad = angle * Math.PI / 180.0;
                        double cx = 50, cy = 50, r = 48;
                        double ex = cx + r * Math.Sin(rad);
                        double ey = cy - r * Math.Cos(rad);
                        arc.Point = new Point(ex, ey);
                        arc.IsLargeArc = angle > 180;
                    }
                    catch { arcTimer.Stop(); }
                };
                arcTimer.Start();

                Task.Delay(4000).ContinueWith(_ =>
                {
                    try
                    {
                        Dispatcher.Invoke(() =>
                        {
                            arcTimer.Stop();
                            arc.Point = new Point(98, 50);
                            arc.IsLargeArc = false;
                        });
                    }
                    catch { }
                });
            }
            catch { }
        }

        private async Task RunValidationAsync()
        {
            try
            {
                _validation = await ProjectValidator.ValidateAsync(Services.ManifestService.ProjectRoot);
            }
            catch
            {
                _validation = new List<ValidationStep>();
            }
        }

        private void AnimateChild(int index)
        {
            FrameworkElement target = index switch
            {
                0 => TitleText,
                1 => Subtitle,
                2 => StatusText,
                _ => null
            };
            if (target == null) return;

            var anim = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(350));
            anim.EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut };
            target.BeginAnimation(OpacityProperty, anim);
        }

        private string[] _stepNames = new string[]
        {
            "ProjectRoot", "Manifest", "Scripts", "Core", "Reports", "Admin"
        };

        private string[] _statusKeys = new string[]
        {
            "SplashValidating", "SplashManifest", "SplashTools",
            "SplashCore", "SplashReports", "SplashAdmin"
        };

        private void Timer_Tick(object sender, EventArgs e)
        {
            if (_step >= _statusKeys.Length)
            {
                _timer.Stop();
                AnimateProgressComplete();
                return;
            }

            ValidationStep result = null;
            if (_validation != null)
                result = _validation.Find(v => v.Name == _stepNames[_step]);

            if (result != null)
            {
                var mark = result.Passed ? "[OK] " : "[!] ";
                StatusText.Text = mark + result.Detail;
                StatusText.Foreground = result.Passed
                    ? (Brush)FindResource("BrushGreen")
                    : (Brush)FindResource("BrushAmber");
            }
            else if (TryFindResource(_statusKeys[_step]) is string text)
            {
                StatusText.Text = text;
                StatusText.Foreground = (Brush)FindResource("BrushMuted");
            }

            var targetWidth = RootBorder.ActualWidth * ((_step + 1.0) / _statusKeys.Length);
            var progressAnim = new DoubleAnimation(targetWidth, TimeSpan.FromMilliseconds(400));
            progressAnim.EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut };
            ProgressBar.BeginAnimation(WidthProperty, progressAnim);

            _step++;
        }

        private async void AnimateProgressComplete()
        {
            if (_isCompleting) return;
            _isCompleting = true;

            await Task.Delay(350);
            if (!IsVisible) return;

            StatusText.Text = TryFindResource("SplashReady") as string ?? "Ready";
            StatusText.Foreground = (Brush)FindResource("BrushGreen");

            BtnFinish.Visibility = Visibility.Visible;
            var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(350));
            fadeIn.EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut };
            BtnFinish.BeginAnimation(OpacityProperty, fadeIn);
        }

        private void BtnFinish_Click(object sender, RoutedEventArgs e)
        {
            if (_isCompleting && BtnFinish.Visibility != Visibility.Visible) return;

            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(300));
            fadeOut.Completed += (s, ev) =>
            {
                if (!IsVisible) return;
                var mainWindow = new MainWindow();
                mainWindow.Show();
                Close();
            };
            RootBorder.BeginAnimation(OpacityProperty, fadeOut);
        }
    }
}
