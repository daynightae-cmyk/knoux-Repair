using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace KnouxRepair.Services
{
    public static class PowerShellService
    {
        private static Process _currentProcess;
        private static CancellationTokenSource _cts;
        private static readonly object _lock = new object();

        public static event Action<string> OutputReceived;
        public static event Action<string> ErrorReceived;
        public static event Action<int> ProcessExited;
        public static event Action<bool> RunningStateChanged;

        public static bool IsRunning
        {
            get
            {
                lock (_lock)
                {
                    return _currentProcess != null && !_currentProcess.HasExited;
                }
            }
        }

        // PowerShell 7 preferred, fall back to Windows PowerShell 5.1
        public static string FindPowerShell()
        {
            var candidates = new[]
            {
                Environment.GetEnvironmentVariable("ProgramFiles") + "\\PowerShell\\7\\pwsh.exe",
                Environment.GetEnvironmentVariable(Environment.Is64BitProcess ? "ProgramFiles(x86)" : "ProgramFiles") + "\\PowerShell\\7\\pwsh.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe")
            };

            foreach (var path in candidates)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                    return path;
            }

            var which = Which("pwsh.exe") ?? Which("powershell.exe");
            if (which != null) return which;

            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),
                "WindowsPowerShell", "v1.0", "powershell.exe");
        }

        private static string Which(string exe)
        {
            try
            {
                var pathVar = Environment.GetEnvironmentVariable("PATH") ?? "";
                foreach (var dir in pathVar.Split(';'))
                {
                    if (string.IsNullOrWhiteSpace(dir)) continue;
                    var full = Path.Combine(dir.Trim('"'), exe);
                    if (File.Exists(full)) return full;
                }
            }
            catch { }
            return null;
        }

        // Runs an inline PowerShell command (e.g. a Core module function call)
        public static async Task<int> RunCommandAsync(string command, Action<string> onOutput = null,
            Action<string> onError = null, CancellationToken token = default)
        {
            if (string.IsNullOrWhiteSpace(command))
                throw new ArgumentException("Command is empty.", nameof(command));

            lock (_lock)
            {
                if (IsRunning)
                    throw new InvalidOperationException("A tool is already running.");

                _cts = CancellationTokenSource.CreateLinkedTokenSource(token);

                var psi = new ProcessStartInfo
                {
                    FileName = FindPowerShell(),
                    Arguments = $"-NoProfile -NoLogo -NonInteractive -ExecutionPolicy Bypass -Command {EscapeCommand(command)}",
                    WorkingDirectory = ManifestService.ProjectRoot,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };

                _currentProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
            }

            return await PumpProcessAsync(onOutput, onError, token);
        }

        public static async Task<int> RunAsync(string scriptPath, string arguments = "",
            bool analyzeOnly = false, Action<string> onOutput = null, Action<string> onError = null,
            CancellationToken token = default)
        {
            var resolvedPath = ManifestService.ResolveScriptPath(scriptPath);
            if (resolvedPath == null || !File.Exists(resolvedPath))
                throw new FileNotFoundException("Tool script not found.", scriptPath);

            lock (_lock)
            {
                if (IsRunning)
                    throw new InvalidOperationException("A tool is already running.");

                _cts = CancellationTokenSource.CreateLinkedTokenSource(token);

                var args = new StringBuilder();
                args.Append("-NoProfile -NoLogo -NonInteractive -ExecutionPolicy Bypass -File \"")
                    .Append(resolvedPath)
                    .Append('"');
                if (analyzeOnly) args.Append(" -AnalyzeOnly");
                if (!string.IsNullOrWhiteSpace(arguments)) args.Append(' ').Append(arguments);

                var psi = new ProcessStartInfo
                {
                    FileName = FindPowerShell(),
                    Arguments = args.ToString(),
                    WorkingDirectory = ManifestService.ProjectRoot,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };

                _currentProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
            }

            return await PumpProcessAsync(onOutput, onError, token);
        }

        // PowerShell quoting for -Command: wrap in double quotes, escape inner quotes
        private static string EscapeCommand(string command)
        {
            var escaped = command.Replace("\"", "\\\"");
            return "\"" + escaped + "\"";
        }

        private static async Task<int> PumpProcessAsync(Action<string> onOutput, Action<string> onError,
            CancellationToken token)
        {
            RunningStateChanged?.Invoke(true);
            var exitedTcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

            _currentProcess.OutputDataReceived += (s, e) =>
            {
                if (e.Data != null)
                {
                    onOutput?.Invoke(e.Data);
                    OutputReceived?.Invoke(e.Data);
                }
            };

            _currentProcess.ErrorDataReceived += (s, e) =>
            {
                if (e.Data != null)
                {
                    onError?.Invoke(e.Data);
                    ErrorReceived?.Invoke(e.Data);
                }
            };

            _currentProcess.Exited += (s, e) => exitedTcs.TrySetResult(true);

            try
            {
                _currentProcess.Start();
                _currentProcess.BeginOutputReadLine();
                _currentProcess.BeginErrorReadLine();

                // Await either natural exit or cancellation
                var completed = await Task.WhenAny(exitedTcs.Task,
                    Task.Delay(Timeout.Infinite, _cts.Token));

                if (completed != exitedTcs.Task)
                {
                    Stop();
                    return -1;
                }

                var exitCode = _currentProcess.ExitCode;
                ProcessExited?.Invoke(exitCode);
                return exitCode;
            }
            catch (OperationCanceledException)
            {
                Stop();
                return -1;
            }
            catch (Exception)
            {
                Stop();
                return -1;
            }
            finally
            {
                lock (_lock)
                {
                    _currentProcess?.Dispose();
                    _currentProcess = null;
                    _cts?.Dispose();
                    _cts = null;
                }
                RunningStateChanged?.Invoke(false);
            }
        }

        public static void Stop()
        {
            Process proc;
            lock (_lock)
            {
                proc = _currentProcess;
                _cts?.Cancel();
            }

            try
            {
                if (proc != null && !proc.HasExited)
                {
                    proc.Kill(entireProcessTree: true);
                    proc.WaitForExit(5000);
                }
            }
            catch { }
        }
    }
}