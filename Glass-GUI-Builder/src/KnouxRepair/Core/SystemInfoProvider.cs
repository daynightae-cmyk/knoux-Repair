using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;

namespace KnouxRepair.Core
{
    // Zero-dependency system information: BCL + kernel32 P/Invoke only (no WMI, no NuGet).
    public static class SystemInfoProvider
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct MEMORYSTATUSEX
        {
            public uint dwLength;
            public uint dwMemoryLoad;
            public ulong ullTotalPhys;
            public ulong ullAvailPhys;
            public ulong ullTotalPageFile;
            public ulong ullAvailPageFile;
            public ulong ullTotalVirtual;
            public ulong ullAvailVirtual;
            public ulong ullAvailExtendedVirtual;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct FILETIME
        {
            public uint dwLowDateTime;
            public uint dwHighDateTime;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetSystemTimes(out FILETIME lpIdleTime, out FILETIME lpKernelTime, out FILETIME lpUserTime);

        private static ulong? _lastIdle;
        private static ulong? _lastKernel;
        private static ulong? _lastUser;

        private static ulong FileTimeToUInt64(FILETIME ft)
            => ((ulong)ft.dwHighDateTime << 32) | ft.dwLowDateTime;

        public static string OsDescription
        {
            get
            {
                try
                {
                    var ver = Environment.OSVersion;
                    var name = GetOsProductName();
                    var arch = Environment.Is64BitOperatingSystem ? "x64" : "x86";
                    return string.IsNullOrEmpty(name)
                        ? $"Windows {ver.Version} ({arch})"
                        : $"{name} — {ver.Version.Build} ({arch})";
                }
                catch
                {
                    return Environment.OSVersion.VersionString;
                }
            }
        }

        private static string GetOsProductName()
        {
            try
            {
                using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
                return key?.GetValue("ProductName") as string;
            }
            catch { return null; }
        }

        public static string CpuName
        {
            get
            {
                try
                {
                    using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                        @"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                    var name = key?.GetValue("ProcessorNameString") as string;
                    if (!string.IsNullOrWhiteSpace(name))
                        return name.Trim();
                }
                catch { }
                return $"{Environment.ProcessorCount} logical processors";
            }
        }

        public static int LogicalProcessorCount => Environment.ProcessorCount;

        public static long TotalRamMb
        {
            get
            {
                var mem = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
                if (GlobalMemoryStatusEx(ref mem))
                    return (long)(mem.ullTotalPhys / (1024 * 1024));
                return 0;
            }
        }

        public static long AvailableRamMb
        {
            get
            {
                var mem = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
                if (GlobalMemoryStatusEx(ref mem))
                    return (long)(mem.ullAvailPhys / (1024 * 1024));
                return 0;
            }
        }

        // Disk info for the drive hosting the project root.
        public static DriveInfo RootDrive
        {
            get
            {
                try
                {
                    var root = Path.GetPathRoot(Services.ManifestService.ProjectRoot);
                    if (string.IsNullOrEmpty(root)) return null;
                    var drive = new DriveInfo(root);
                    return drive.IsReady ? drive : null;
                }
                catch { return null; }
            }
        }

        public static string UptimeLabel
        {
            get
            {
                var ticks = Environment.TickCount64;
                var total = TimeSpan.FromMilliseconds(ticks);
                var parts = new System.Collections.Generic.List<string>();
                if (total.Days > 0) parts.Add($"{total.Days}d");
                if (total.Hours > 0) parts.Add($"{total.Hours}h");
                parts.Add($"{total.Minutes}m");
                return string.Join(" ", parts);
            }
        }

        public static bool IsAdministrator
        {
            get
            {
                try
                {
                    var identity = WindowsIdentity.GetCurrent();
                    var principal = new WindowsPrincipal(identity);
                    return principal.IsInRole(WindowsBuiltInRole.Administrator);
                }
                catch { return false; }
            }
        }

        // CPU usage percent since the previous call. Returns null when a sample could not be taken.
        public static double? CpuUsagePercent()
        {
            if (!GetSystemTimes(out var idle, out var kernel, out var user))
                return null;

            var idleNow = FileTimeToUInt64(idle);
            var kernelNow = FileTimeToUInt64(kernel);
            var userNow = FileTimeToUInt64(user);

            if (!_lastIdle.HasValue)
            {
                _lastIdle = idleNow;
                _lastKernel = kernelNow;
                _lastUser = userNow;
                return null;
            }

            var idleDelta = idleNow - _lastIdle.Value;
            var kernelDelta = kernelNow - _lastKernel.Value;
            var userDelta = userNow - _lastUser.Value;
            var totalDelta = kernelDelta + userDelta;

            _lastIdle = idleNow;
            _lastKernel = kernelNow;
            _lastUser = userNow;

            if (totalDelta == 0) return 0;
            var busy = totalDelta - idleDelta;
            return Math.Max(0, Math.Min(100.0, (busy * 100.0) / totalDelta));
        }
    }
}