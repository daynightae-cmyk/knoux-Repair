using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using KnouxRepair.Models;

namespace KnouxRepair.Services
{
    public static class ManifestService
    {
        private static List<ToolInfo> _tools;
        private static List<CategoryInfo> _categories;
        private static string _projectRoot;

        public static List<ToolInfo> Tools => _tools ??= LoadTools();
        public static List<CategoryInfo> Categories => _categories ??= LoadCategories();

        public static string ProjectRoot
        {
            get
            {
                if (_projectRoot != null) return _projectRoot;

                // Walk up from the executable directory to the folder that carries
                // the legal tool inventory and category definition. This works in
                // both the development tree and the published Windows package.
                var dir = AppDomain.CurrentDomain.BaseDirectory;
                while (dir != null)
                {
                    var manifest = Path.Combine(dir, "Docs", "TOOLS-MANIFEST.json");
                    var menus = Path.Combine(dir, "Config", "menus.json");
                    if (File.Exists(manifest) && File.Exists(menus)) return dir;
                    dir = Directory.GetParent(dir)?.FullName;
                }
                _projectRoot = AppDomain.CurrentDomain.BaseDirectory;
                return _projectRoot;
            }
        }

        public static string ResolveScriptPath(string scriptPath)
        {
            if (string.IsNullOrWhiteSpace(scriptPath)) return null;
            return Path.IsPathRooted(scriptPath)
                ? scriptPath
                : Path.GetFullPath(Path.Combine(ProjectRoot, scriptPath));
        }

        private static List<ToolInfo> LoadTools()
        {
            try
            {
                var manifestPath = Path.Combine(ProjectRoot, "Docs", "TOOLS-MANIFEST.json");
                if (!File.Exists(manifestPath))
                    return new List<ToolInfo>();

                var json = File.ReadAllText(manifestPath);
                return JsonSerializer.Deserialize<List<ToolInfo>>(json) ?? new List<ToolInfo>();
            }
            catch
            {
                return new List<ToolInfo>();
            }
        }

        private static List<CategoryInfo> LoadCategories()
        {
            try
            {
                var menusPath = Path.Combine(ProjectRoot, "Config", "menus.json");
                if (!File.Exists(menusPath))
                    return new List<CategoryInfo>();

                var json = File.ReadAllText(menusPath);
                return JsonSerializer.Deserialize<List<CategoryInfo>>(json) ?? new List<CategoryInfo>();
            }
            catch
            {
                return new List<CategoryInfo>();
            }
        }

        public static ToolInfo FindTool(string toolId)
        {
            return Tools.Find(t => t.ToolId == toolId);
        }

        public static List<ToolInfo> GetToolsByCategory(string category)
        {
            return Tools.FindAll(t =>
                string.Equals(t.Category, category, StringComparison.OrdinalIgnoreCase));
        }
    }
}
