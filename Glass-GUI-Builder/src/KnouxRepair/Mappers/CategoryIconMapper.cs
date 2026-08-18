using System.Windows.Media;
using KnouxRepair.Models;

namespace KnouxRepair.Mappers
{
    /// <summary>
    /// Maps category strings to Segoe Fluent Icon geometry paths.
    /// Each of the 10 categories gets a distinct semantic icon.
    /// </summary>
    public static class CategoryIconMapper
    {
        // Segoe Fluent Icons geometry paths
        // Shield for Security (09-Security)
        private const string ShieldIcon = "M12,2L4,5v6c0,5.55 3.85,10.74 9,12c5.15-1.26 9-6.45 9-12V5L12,2z M12,21.5c-3.87-1.02-7-5.11-7-9.5V6.23l7-2.63l7,2.63V12C19,16.39 15.87,20.48 12,21.5z M13,16v-4h3v-2h-3V6h-2v4H8v2h3v4H13z";
        
        // Gauge for Performance (08-Performance)
        private const string GaugeIcon = "M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10s10-4.48 10-10S17.52,2 12,2z M12,20c-4.42,0-8-3.58-8-8c0-1.79,0.59-3.44,1.59-4.78l5.41,5.41V15h2v-2.36l5.41-5.41C19.41,8.56 20,10.21 20,12C20,16.42 16.42,20 12,20z";
        
        // Folder for Duplicates (05-Duplicate-Files)
        private const string FolderIcon = "M10,4H4c-1.1,0-1.99,0.9-1.99,2L2,18c0,1.1 0.9,2 2,2h16c1.1,0 2-0.9 2-2V8c0-1.1-0.9-2-2-2h-8l-2-2z";
        
        // Settings/Wrench for System Maintenance (01-System-Maintenance)
        private const string WrenchIcon = "M22.7,19.4l-3.9-3.9c0.6-1.6,0.5-3.5-0.4-5.1c-0.1-0.2-0.2-0.3-0.3-0.5l3.2-3.2c0.4-0.4,0.4-1,0-1.4l-2.6-2.6c-0.4-0.4-1-0.4-1.4,0L14.1,6c-0.2-0.1-0.3-0.2-0.5-0.3c-1.6-0.9-3.5-1-5.1-0.4L4.6,1.4C4.2,1,3.6,1,3.2,1.4L0.6,4C0.2,4.4,0.2,5,0.6,5.4l3.9,3.9C3.9,10.9,3.8,12.8,4.7,14.4c0.1,0.2,0.2,0.3,0.3,0.5l-3.2,3.2c-0.4,0.4-0.4,1,0,1.4l2.6,2.6c0.4,0.4,1,0.4,1.4,0l3.2-3.2c0.2,0.1,0.3,0.2,0.5,0.3c1.6,0.9,3.5,1,5.1,0.4l3.9,3.9c0.4,0.4,1,0.4,1.4,0l2.6-2.6C23.1,20.4,23.1,19.8,22.7,19.4z M11,13c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S12.7,13,11,13z";
        
        // Broom/Clean for System Cleanup (02-System-Cleanup)
        private const string BroomIcon = "M19.9,6.3c-0.4-0.4-1-0.4-1.4,0l-2.8,2.8c-0.4,0.4-0.4,1,0,1.4l2.8,2.8c0.4,0.4,1,0.4,1.4,0c0.4-0.4,0.4-1,0-1.4l-0.7-0.7l3.5-3.5C23.1,7.3,23.1,6.7,22.7,6.3L19.9,6.3z M12,2L9,5l-2-2L4,6l2,2L3,11l2,2l3-3l2,2l3-3l-2-2l3-3L12,2z M2,14l2,2l8-8l-2-2L2,14z M4,20l8-8l-2-2l-8,8L4,20z";
        
        // Globe/Network for Network (03-Network-Internet)
        private const string GlobeIcon = "M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10s10-4.48 10-10S17.52,2 12,2z M12,20c-4.42,0-8-3.58-8-8c0-0.59,0.07-1.16,0.2-1.71L9.9,16c-0.27,0.73-0.46,1.5-0.55,2.3C8.55,18.15 7.86,18.08 7.14,18c0.48-1.35 1.25-2.57 2.21-3.59L4.1,9.16C4.04,9.74 4,10.36 4,11c0,4.42 3.58,8 8,8c0.64,0 1.26-0.04 1.84-0.1c-0.08-0.72-0.15-1.41-0.15-2.15c-1.02,0.96-2.24,1.73-3.59,2.21C10.08,18.25 10.15,17.56 10.15,17c0-2.76 2.24-5 5-5c0.56,0 1.08,0.07 1.59,0.15c-0.48-1.35-1.25-2.57-2.21-3.59c1.35-0.48 2.57-1.25 3.59-2.21c0.08,0.72 0.15,1.41 0.15,2.15c0,0.64-0.04,1.26-0.1,1.84l5.71-5.71C17.96,4.04 17.36,4 16.71,4c-0.48,1.35-1.25,2.57-2.21,3.59c-1.02-0.96-2.24-1.73-3.59-2.21C11.45,5.85 12.14,5.92 12.86,6c-0.48,1.35-1.25,2.57-2.21,3.59c1.02,0.96 2.24,1.73 3.59,2.21c0.08-0.72 0.15-1.41 0.15-2.15c0-0.64,0.04-1.26,0.1-1.84l-5.71,5.71C9.36,13.96 9.96,14 10.61,14c0.48-1.35 1.25-2.57 2.21-3.59c1.02,0.96 2.24,1.73 3.59,2.21c-0.08,0.72-0.15,1.41-0.15,2.15c0,0.59,0.07,1.16,0.2,1.71L14.1,12c0.27-0.73,0.46-1.5,0.55-2.3c0.8,0.15 1.49,0.22 2.21,0.3c-0.48,1.35-1.25,2.57-2.21,3.59L19.9,18.84C19.96,18.26 20,17.64 20,17c0-4.42-3.58-8-8-8c-0.64,0-1.26,0.04-1.84,0.1c0.08,0.72,0.15,1.41,0.15,2.15c0,2.76-2.24,5-5,5c-0.56,0-1.08-0.07-1.59-0.15c0.48,1.35 1.25,2.57 2.21,3.59c-1.35,0.48-2.57,1.25-3.59,2.21c-0.08-0.72-0.15-1.41-0.15-2.15c0-0.64,0.04-1.26,0.1-1.84L2,12C2,7.58 5.58,4 10,4c0.59,0,1.16,0.07,1.71,0.2L6,9.9c0.27,0.73,0.46,1.5,0.55,2.3c-0.8-0.15-1.49-0.22-2.21-0.3c0.48-1.35 1.25-2.57 2.21-3.59c1.02,0.96 2.24,1.73 3.59,2.21c-0.08,0.72-0.15,1.41-0.15,2.15c0,0.59,0.07,1.16,0.2,1.71L14.1,12c-0.27,0.73-0.46,1.5-0.55,2.3c-0.8-0.15-1.49-0.22-2.21-0.3c0.48,1.35 1.25,2.57 2.21,3.59c-1.02-0.96-2.24-1.73-3.59-2.21c0.08-0.72,0.15-1.41,0.15-2.15c0-0.59-0.07-1.16-0.2-1.71L9.9,16c0.27-0.73,0.46-1.5,0.55-2.3c0.8,0.15 1.49,0.22 2.21,0.3c-0.48-1.35-1.25-2.57-2.21-3.59c1.35-0.48 2.57-1.25 3.59-2.21c-0.08,0.72-0.15,1.41-0.15,2.15c0,0.64,0.04,1.26,0.1,1.84L12,2z";
        
        // App/Program for Programs (04-Programs-Applications)
        private const string AppIcon = "M4,8h4V4H4V8z M10,20h4v-4h-4V20z M4,20h4v-4H4V20z M4,14h4v-4H4V14z M10,14h4v-4h-4V14z M10,8h4V4h-4V8z M16,4v4h4V4H16z M16,14h4v-4h-4V14z M16,20h4v-4h-4V20z";
        
        // Disk/Storage for Disk Space (06-Disk-Space)
        private const string DiskIcon = "M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10s10-4.48 10-10S17.52,2 12,2z M12,20c-4.42,0-8-3.58-8-8s3.58-8 8-8s8,3.58 8,8S16.42,20 12,20z M12,6c-3.31,0-6,2.69-6,6s2.69,6 6,6s6-2.69 6-6S15.31,6 12,6z M12,16c-2.21,0-4-1.79-4-4s1.79-4 4-4s4,1.79 4,4S14.21,16 12,16z";
        
        // Services/Process for Services (07-Services-Processes)
        private const string ServicesIcon = "M19,3H5C3.9,3 3,3.9 3,5v14c0,1.1 0.9,2 2,2h14c1.1,0 2-0.9 2-2V5C21,3.9 20.1,3 19,3z M19,19H5V5h14V19z M7,7h2v2H7V7z M7,11h2v2H7V11z M7,15h2v2H7V15z M11,7h6v2h-6V7z M11,11h6v2h-6V11z M11,15h6v2h-6V15z";
        
        // Report/Document for Diagnostics (10-Diagnostics-Reports)
        private const string ReportIcon = "M14,2H6C4.9,2 4,2.9 4,4v16c0,1.1 0.9,2 2,2h12c1.1,0 2-0.9 2-2V8L14,2z M14,2v6h6L14,2z M6,20V4h7v6h6v10H6z M8,12h8v2H8V12z M8,16h8v2H8V16z M8,8h2v2H8V8z";

        public static Geometry GetGeometry(string category)
        {
            if (string.IsNullOrWhiteSpace(category))
                return Geometry.Parse(WrenchIcon);

            var cat = category.ToUpper();
            
            if (cat.Contains("SYSTEM-MAINTENANCE") || cat.StartsWith("01"))
                return Geometry.Parse(WrenchIcon);
            
            if (cat.Contains("SYSTEM-CLEANUP") || cat.StartsWith("02"))
                return Geometry.Parse(BroomIcon);
            
            if (cat.Contains("NETWORK") || cat.StartsWith("03"))
                return Geometry.Parse(GlobeIcon);
            
            if (cat.Contains("PROGRAM") || cat.Contains("APPLICATION") || cat.StartsWith("04"))
                return Geometry.Parse(AppIcon);
            
            if (cat.Contains("DUPLICATE") || cat.StartsWith("05"))
                return Geometry.Parse(FolderIcon);
            
            if (cat.Contains("DISK") || cat.Contains("SPACE") || cat.StartsWith("06"))
                return Geometry.Parse(DiskIcon);
            
            if (cat.Contains("SERVICE") || cat.Contains("PROCESS") || cat.StartsWith("07"))
                return Geometry.Parse(ServicesIcon);
            
            if (cat.Contains("PERFORMANCE") || cat.StartsWith("08"))
                return Geometry.Parse(GaugeIcon);
            
            if (cat.Contains("SECURITY") || cat.StartsWith("09"))
                return Geometry.Parse(ShieldIcon);
            
            if (cat.Contains("DIAGNOSTIC") || cat.Contains("REPORT") || cat.StartsWith("10"))
                return Geometry.Parse(ReportIcon);

            return Geometry.Parse(WrenchIcon);
        }

        public static Geometry GetGeometry(ToolInfo tool)
        {
            return tool != null ? GetGeometry(tool.Category) : Geometry.Parse(WrenchIcon);
        }
    }
}
