using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace KnouxRepair.Core
{
    public class ValidationStep
    {
        public string Name { get; set; }
        public bool Passed { get; set; }
        public string Detail { get; set; }
    }

    // Splash-screen project validation (tech plan §4)
    public static class ProjectValidator
    {
        public static List<ValidationStep> Validate(string projectRoot)
        {
            var steps = new List<ValidationStep>();

            // 1. Project root exists
            var rootOk = Directory.Exists(projectRoot);
            steps.Add(new ValidationStep
            {
                Name = "ProjectRoot",
                Passed = rootOk,
                Detail = rootOk ? projectRoot : "Project root not found"
            });

            // 2. VERSION file
            var versionPath = Path.Combine(projectRoot, "VERSION");
            var versionOk = File.Exists(versionPath);
            steps.Add(new ValidationStep
            {
                Name = "Version",
                Passed = versionOk,
                Detail = versionOk ? File.ReadAllText(versionPath).Trim() : "VERSION file missing"
            });

            // 3. TOOLS-MANIFEST.json
            var manifestPath = Path.Combine(projectRoot, "Docs", "TOOLS-MANIFEST.json");
            var tools = new List<JsonElement>();
            var manifestOk = false;
            var manifestDetail = "TOOLS-MANIFEST.json missing";
            if (File.Exists(manifestPath))
            {
                try
                {
                    var json = File.ReadAllText(manifestPath);
                    tools = JsonSerializer.Deserialize<List<JsonElement>>(json) ?? new List<JsonElement>();
                    manifestOk = tools.Count > 0;
                    manifestDetail = $"{tools.Count} tools";
                }
                catch (Exception ex)
                {
                    manifestDetail = "Invalid JSON: " + ex.Message;
                }
            }
            steps.Add(new ValidationStep
            {
                Name = "Manifest",
                Passed = manifestOk,
                Detail = manifestDetail
            });

            // 4. menus.json
            var menusPath = Path.Combine(projectRoot, "Config", "menus.json");
            var menusOk = false;
            var menusDetail = "menus.json missing";
            if (File.Exists(menusPath))
            {
                try
                {
                    var menus = JsonSerializer.Deserialize<List<JsonElement>>(File.ReadAllText(menusPath))
                                ?? new List<JsonElement>();
                    menusOk = menus.Count > 0;
                    menusDetail = $"{menus.Count} categories";
                }
                catch (Exception ex)
                {
                    menusDetail = "Invalid JSON: " + ex.Message;
                }
            }
            steps.Add(new ValidationStep
            {
                Name = "Menus",
                Passed = menusOk,
                Detail = menusDetail
            });

            // 5. Core modules
            var coreDir = Path.Combine(projectRoot, "Core");
            var coreModules = Directory.Exists(coreDir)
                ? Directory.GetFiles(coreDir, "*.psm1")
                : Array.Empty<string>();
            steps.Add(new ValidationStep
            {
                Name = "Core",
                Passed = coreModules.Length >= 4,
                Detail = coreModules.Length == 0 ? "Core modules missing" : $"{coreModules.Length} modules"
            });

            // 6. Tool script files exist
            var missingScripts = 0;
            if (manifestOk)
            {
                foreach (var tool in tools)
                {
                    if (tool.TryGetProperty("ScriptPath", out var sp))
                    {
                        var rel = sp.GetString();
                        if (!string.IsNullOrEmpty(rel) &&
                            !File.Exists(Path.Combine(projectRoot, rel)))
                            missingScripts++;
                    }
                }
            }
            steps.Add(new ValidationStep
            {
                Name = "Scripts",
                Passed = missingScripts == 0,
                Detail = missingScripts == 0 ? "All script paths exist" : $"{missingScripts} scripts missing"
            });

            // 7. Reports directory writable
            var reportsDir = Path.Combine(projectRoot, "Reports");
            var reportsOk = false;
            var reportsDetail = "Reports folder missing";
            try
            {
                Directory.CreateDirectory(reportsDir);
                var probe = Path.Combine(reportsDir, ".knoux-write-test");
                File.WriteAllText(probe, "ok");
                File.Delete(probe);
                reportsOk = true;
                reportsDetail = "Writable";
            }
            catch
            {
                reportsDetail = "Not writable";
            }
            steps.Add(new ValidationStep
            {
                Name = "Reports",
                Passed = reportsOk,
                Detail = reportsDetail
            });

            // 8. PowerShell executable
            var ps = Services.PowerShellService.FindPowerShell();
            steps.Add(new ValidationStep
            {
                Name = "PowerShell",
                Passed = File.Exists(ps),
                Detail = File.Exists(ps) ? Path.GetFileName(ps) : "PowerShell not found"
            });

            // 9. Duplicate ToolIds
            var dupes = tools.Count - tools
                .Select(t => t.TryGetProperty("ToolId", out var id) ? id.GetString() : "")
                .Distinct(StringComparer.OrdinalIgnoreCase).Count();
            var dupesOk = dupes == 0;
            steps.Add(new ValidationStep
            {
                Name = "UniqueIds",
                Passed = dupesOk,
                Detail = dupesOk ? "All IDs unique" : $"{dupes} duplicate IDs"
            });

            // 10. Administrator status
            var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            var isAdmin = principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
            steps.Add(new ValidationStep
            {
                Name = "Admin",
                Passed = isAdmin,
                Detail = isAdmin ? "Elevated" : "Running as standard user"
            });

            return steps;
        }

        public static async Task<List<ValidationStep>> ValidateAsync(string projectRoot)
            => await Task.Run(() => Validate(projectRoot));
    }
}