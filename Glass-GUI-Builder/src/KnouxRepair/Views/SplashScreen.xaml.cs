using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Animation;
using KnouxRepair.Core;

namespace KnouxRepair.Views
{
    public partial class SplashScreen : Window
    {
        private bool _started;
        private bool _transitioning;
        private readonly List<ValidationStep> _validation = new List<ValidationStep>();

        public SplashScreen()
        {
            InitializeComponent();
            Loaded += SplashScreen_Loaded;
        }

        private async void SplashScreen_Loaded(object sender, RoutedEventArgs e)
        {
            if (_started)
                return;

            _started = true;
            StartCinematicEntrance();
            SetStatus("SplashInitializing", null, true);

            try
            {
                var progress = new Progress<ValidationStep>(OnValidationStep);
                var validation = await ProjectValidator.ValidateAsync(Services.ManifestService.ProjectRoot, progress);
                _validation.AddRange(validation);

                var allCriticalStepsPassed = validation.TrueForAll(step =>
                    step.Name == "Admin" || step.Passed);
                SetStatus(allCriticalStepsPassed ? "SplashReady" : "SplashAttention", null, allCriticalStepsPassed);

                await TransitionToMainWindowAsync();
            }
            catch (Exception ex)
            {
                SetStatus("SplashAttention", ex.Message, false);
                await TransitionToMainWindowAsync();
            }
        }

        private void OnValidationStep(ValidationStep step)
        {
            var key = step.Name switch
            {
                "Manifest" => "SplashLoadingManifest",
                "Scripts" => "SplashLoadingTools",
                "Reports" => "SplashPreparingWorkspace",
                "Core" => "SplashInitializing",
                "PowerShell" => "SplashInitializing",
                _ => "SplashInitializing"
            };

            SetStatus(key, step.Detail, step.Passed);
        }

        private void SetStatus(string resourceKey, string detail, bool isPositive)
        {
            var label = FindResource(resourceKey) as string ?? resourceKey;
            StatusText.Text = string.IsNullOrWhiteSpace(detail) ? label : label + " · " + detail;
            StatusText.Foreground = FindResource(isPositive ? "TextSecondaryBrush" : "AmberBrush") as Brush
                ?? Brushes.SlateGray;
            StatusBeacon.Fill = FindResource(isPositive ? "CyanBrush" : "AmberBrush") as Brush
                ?? Brushes.SteelBlue;
        }

        private void StartCinematicEntrance()
        {
            Animate(RootGrid, OpacityProperty, 0, 1, 520, new CubicEase { EasingMode = EasingMode.EaseOut });
            Animate(RootScale, ScaleTransform.ScaleXProperty, 0.98, 1, 520, new CubicEase { EasingMode = EasingMode.EaseOut });
            Animate(RootScale, ScaleTransform.ScaleYProperty, 0.98, 1, 520, new CubicEase { EasingMode = EasingMode.EaseOut });

            Animate(LogoContainer, OpacityProperty, 0, 1, 720, new CubicEase { EasingMode = EasingMode.EaseOut });
            Animate(LogoScale, ScaleTransform.ScaleXProperty, 0.88, 1, 720, new CubicEase { EasingMode = EasingMode.EaseOut });
            Animate(LogoScale, ScaleTransform.ScaleYProperty, 0.88, 1, 720, new CubicEase { EasingMode = EasingMode.EaseOut });
            Animate(RingScale, ScaleTransform.ScaleXProperty, 0.3, 1, 640, new CubicEase { EasingMode = EasingMode.EaseOut });
            Animate(RingScale, ScaleTransform.ScaleYProperty, 0.3, 1, 640, new CubicEase { EasingMode = EasingMode.EaseOut });

            StartLoop(ClockwiseRotation, RotateTransform.AngleProperty, 0, 360, 18000);
            StartLoop(CounterClockwiseRotation, RotateTransform.AngleProperty, 360, 0, 24000);
            StartPulse(LogoAura, 0.16, 0.42, 2600);
            StartPulse(StatusBeacon, 0.45, 1, 1500);
            StartPulse(ParticleOne, 0.25, 0.95, 3200);
            StartPulse(ParticleTwo, 0.2, 0.8, 4100);
            StartPulse(ParticleThree, 0.25, 0.9, 3600);
            StartPulse(ParticleFour, 0.2, 0.8, 4600);
            StartPulse(ParticleFive, 0.2, 0.85, 3900);
            StartPulse(ParticleSix, 0.2, 0.8, 4400);
            StartPulse(ParticleSeven, 0.25, 0.75, 3300);
            StartPulse(ParticleEight, 0.2, 0.8, 4800);
        }

        private async Task TransitionToMainWindowAsync()
        {
            if (_transitioning)
                return;

            _transitioning = true;
            var application = Application.Current;
            application.ShutdownMode = ShutdownMode.OnExplicitShutdown;

            var mainWindow = new MainWindow { Opacity = 0 };
            mainWindow.Show();
            application.MainWindow = mainWindow;
            application.ShutdownMode = ShutdownMode.OnMainWindowClose;

            await Task.WhenAll(
                AnimateAsync(RootGrid, OpacityProperty, 1, 0, 460, new CubicEase { EasingMode = EasingMode.EaseIn }),
                AnimateAsync(mainWindow, OpacityProperty, 0, 1, 420, new CubicEase { EasingMode = EasingMode.EaseOut }));

            Close();
        }

        private static DoubleAnimation CreateAnimation(double from, double to, int milliseconds, IEasingFunction easing)
        {
            return new DoubleAnimation(from, to, TimeSpan.FromMilliseconds(milliseconds))
            {
                EasingFunction = easing,
                FillBehavior = FillBehavior.HoldEnd
            };
        }

        private static void Animate(UIElement target, DependencyProperty property, double from, double to, int milliseconds, IEasingFunction easing)
        {
            target.BeginAnimation(property, CreateAnimation(from, to, milliseconds, easing));
        }

        private static void Animate(Animatable target, DependencyProperty property, double from, double to, int milliseconds, IEasingFunction easing)
        {
            target.BeginAnimation(property, CreateAnimation(from, to, milliseconds, easing));
        }

        private static Task AnimateAsync(UIElement target, DependencyProperty property, double from, double to, int milliseconds, IEasingFunction easing)
        {
            var completion = new TaskCompletionSource<bool>();
            var animation = CreateAnimation(from, to, milliseconds, easing);
            animation.Completed += (_, __) => completion.TrySetResult(true);
            target.BeginAnimation(property, animation);
            return completion.Task;
        }

        private static void StartLoop(Animatable target, DependencyProperty property, double from, double to, int milliseconds)
        {
            var animation = new DoubleAnimation(from, to, TimeSpan.FromMilliseconds(milliseconds))
            {
                RepeatBehavior = RepeatBehavior.Forever,
                FillBehavior = FillBehavior.HoldEnd
            };
            target.BeginAnimation(property, animation);
        }

        private static void StartPulse(UIElement target, double from, double to, int milliseconds)
        {
            var animation = new DoubleAnimation(from, to, TimeSpan.FromMilliseconds(milliseconds))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            };
            target.BeginAnimation(UIElement.OpacityProperty, animation);
        }
    }
}
