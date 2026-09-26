import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

test('workspace PoC pins the free Dockview React shell without changing React major', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['dockview-react'], '^8.3.1');
  assert.match(pkg.dependencies.react, /^\^18\./);
});

test('Dockview adapter owns layout only and preserves existing KNOUX children', () => {
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');

  assert.match(shell, /DockviewReact/);
  assert.match(shell, /data-workspace-shell="dockview"/);
  assert.match(shell, /data-workspace-kind={workspace}/);
  assert.match(shell, /data-runtime-owner="existing-knoux"/);
  assert.match(shell, /prefix: 'knoux-developer'/);
  assert.match(shell, /prefix: 'knoux-sonar'/);
  assert.match(shell, /prefix: 'knoux-programs'/);
  assert.match(shell, /prefix: 'knoux-software'/);
  assert.match(shell, /prefix: 'knoux-postinstall'/);
  assert.match(shell, /prefix: 'knoux-diagnostics'/);
  assert.match(shell, /prefix: 'knoux-performance'/);
  assert.match(shell, /prefix: 'knoux-security'/);
  assert.match(shell, /prefix: 'knoux-recovery'/);
  assert.match(shell, /prefix: 'knoux-services'/);
  assert.match(shell, /prefix: 'knoux-maintenance'/);
  assert.match(shell, /prefix: 'knoux-cleanup'/);
  assert.match(shell, /prefix: 'knoux-network'/);
  assert.match(shell, /prefix: 'knoux-duplicates'/);
  assert.match(shell, /prefix: 'knoux-disk'/);
  assert.match(shell, /prefix: 'knoux-privacy'/);
  assert.match(shell, /prefix: 'knoux-drivers'/);
  assert.match(shell, /prefix: 'knoux-monitoring'/);
  assert.match(shell, /WIDE_CENTER_WORKSPACES/);
  assert.match(shell, /prefix: 'knoux-developer'[\s\S]*explorerWidth: 230[\s\S]*contextWidth: 270/);
  assert.match(shell, /\$\{panelText\.prefix\}-explorer/);
  assert.match(shell, /\$\{panelText\.prefix\}-center/);
  assert.match(shell, /\$\{panelText\.prefix\}-context/);
  assert.match(shell, /referencePanel: center/);
  assert.doesNotMatch(shell, /dockview-enterprise/);
  assert.doesNotMatch(shell, /keyboardNavigation/);
});

test('Developer Tools and Project Sonar opt into the workspace shell while canonical ServiceApps stays single-mounted', () => {
  const station = read('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');

  assert.match(station, /KnouxDockWorkspace/);
  assert.match(
    station,
    /workspace=\{activeService\.id === '18-Project-Sonar' \? 'sonar' : 'developer'\}/,
  );
  assert.match(
    station,
    /enabled=\{WORKBENCH_SERVICES\.includes\(activeService\.id\) && activeTab === 'overview'\}/,
  );

  const serviceAppsMounts = station.match(/<ServiceApps/g) ?? [];
  assert.equal(
    serviceAppsMounts.length,
    1,
    `expected exactly one canonical ServiceApps mount, found ${serviceAppsMounts.length}`,
  );
});

test('workbench service switches return to Overview so the matching Dockview workspace mounts predictably', () => {
  const station = read('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');

  assert.match(
    station,
    /useEffect\(\(\) => \{\s*setActiveTab\('overview'\);\s*\}, \[activeService\.id\]\)/,
  );
});

test('PoC shell consumes the real flex remainder instead of leaving a blank lower viewport', () => {
  const css = read('src/components/workspace/knoux-dock-workspace.css');

  assert.match(css, /\.knoux-dock-workspace\s*\{/);
  assert.match(css, /flex:\s*1 1 auto/);
  assert.match(css, /height:\s*auto/);
  assert.match(css, /min-height:\s*0/);
  assert.doesNotMatch(css, /height:\s*clamp\(/);
  assert.match(css, /\.knoux-dock-slot--center/);
});

test('core workspace tabs cannot be accidentally closed while panels stay dockable', () => {
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');

  assert.match(shell, /DockviewDefaultTab/);
  assert.match(shell, /hideClose/);
  assert.match(shell, /tabComponents=\{tabComponents\}/);
  assert.equal((shell.match(/tabComponent: 'locked'/g) ?? []).length, 3);
});


test('Programs migrates only its service-mode surface into Dockview and keeps one canonical ServiceApps mount', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const css = read('src/components/workspace/knoux-dock-workspace.css');

  assert.match(stage, /service\.id === '04-Programs-Applications' && serviceAppMode/);
  assert.match(stage, /const serviceDockWorkspace = servicesDockEnabled/);
  assert.match(stage, /workspace=\{serviceDockWorkspace\}/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(stage, /data-service-dock-zone="explorer"/);
  assert.match(stage, /data-service-dock-zone="center"/);
  assert.match(stage, /data-service-dock-zone="context"/);
  assert.match(stage, /bridgeOnline === true \? serviceTools\.length : '—'/);
  assert.match(stage, /activeSignals/);
  assert.match(shell, /explorerWidth: 180/);
  assert.match(shell, /contextWidth: 200/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
  assert.match(css, /\.knoux-stage-service-app--dock/);
  assert.match(css, /height:\s*100%/);
  assert.match(css, /flex:\s*1 1 auto/);
});


test('Software Environment migrates only its service-mode surface into Dockview without replacing SoftwareStation', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.match(stage, /softwareDockEnabled = service\.id === '16-Software-Environment' && serviceAppMode/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(shell, /prefix: 'knoux-software'/);
  assert.match(shell, /Runtime Matrix/);
  assert.match(shell, /Environment Tools/);
  assert.match(shell, /Environment Evidence/);
  assert.match(serviceApps, /SoftwareStation/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
});


test('Post-Install migrates only its service-mode surface into Dockview without replacing PostInstallStation', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.match(stage, /postInstallDockEnabled = service\.id === '17-PostInstall-Setup' && serviceAppMode/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(shell, /prefix: 'knoux-postinstall'/);
  assert.match(shell, /Provisioning Pipeline/);
  assert.match(shell, /Provisioning Tools/);
  assert.match(shell, /Install Evidence/);
  assert.match(serviceApps, /PostInstallStation/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
});


test('Diagnostics migrates only its service-mode surface into Dockview without replacing DiagnosticsStation', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.match(stage, /diagnosticsDockEnabled = service\.id === '10-Diagnostics-Reports' && serviceAppMode/);
  assert.match(stage, /serviceDockEnabled = programsDockEnabled \|\| softwareDockEnabled \|\| postInstallDockEnabled \|\| diagnosticsDockEnabled \|\| performanceDockEnabled \|\| securityDockEnabled \|\| recoveryDockEnabled \|\| servicesDockEnabled/);
  assert.match(stage, /workspace=\{serviceDockWorkspace\}/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(shell, /prefix: 'knoux-diagnostics'/);
  assert.match(shell, /Evidence Lab/);
  assert.match(shell, /Diagnostic Tools/);
  assert.match(shell, /Findings & Reports/);
  assert.match(serviceApps, /DiagnosticsStation/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
});


test('Performance migrates only its service-mode surface into Dockview without replacing PerformanceStation', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.match(stage, /performanceDockEnabled = service\.id === '08-Performance' && serviceAppMode/);
  assert.match(stage, /serviceDockEnabled = programsDockEnabled \|\| softwareDockEnabled \|\| postInstallDockEnabled \|\| diagnosticsDockEnabled \|\| performanceDockEnabled \|\| securityDockEnabled \|\| recoveryDockEnabled \|\| servicesDockEnabled/);
  assert.match(stage, /workspace=\{serviceDockWorkspace\}/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(shell, /prefix: 'knoux-performance'/);
  assert.match(shell, /Performance Observatory/);
  assert.match(shell, /Performance Tools/);
  assert.match(shell, /Resource Evidence/);
  assert.match(shell, /workspace === 'performance' \|\| workspace === 'security' \|\| workspace === 'recovery' \? 560 : workspace === 'services' \? 640 : 420/);
  assert.match(serviceApps, /PerformanceStation/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
});


test('Security migrates only its service-mode surface into Dockview without replacing SecurityStation', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.match(stage, /securityDockEnabled = service\.id === '09-Security' && serviceAppMode/);
  assert.match(stage, /serviceDockEnabled = programsDockEnabled \|\| softwareDockEnabled \|\| postInstallDockEnabled \|\| diagnosticsDockEnabled \|\| performanceDockEnabled \|\| securityDockEnabled \|\| recoveryDockEnabled \|\| servicesDockEnabled/);
  assert.match(stage, /workspace=\{serviceDockWorkspace\}/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(shell, /prefix: 'knoux-security'/);
  assert.match(shell, /Security Evidence Center/);
  assert.match(shell, /Security Tools/);
  assert.match(shell, /Protection Evidence/);
  assert.match(shell, /workspace === 'performance' \|\| workspace === 'security' \|\| workspace === 'recovery' \? 560 : workspace === 'services' \? 640 : 420/);
  assert.match(serviceApps, /SecurityStation/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
});


test('Backup & Recovery migrates only its service-mode surface into Dockview without replacing RecoveryStation', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.match(stage, /recoveryDockEnabled = service\.id === '11-Backup-Recovery' && serviceAppMode/);
  assert.match(stage, /serviceDockEnabled = programsDockEnabled \|\| softwareDockEnabled \|\| postInstallDockEnabled \|\| diagnosticsDockEnabled \|\| performanceDockEnabled \|\| securityDockEnabled \|\| recoveryDockEnabled \|\| servicesDockEnabled/);
  assert.match(stage, /workspace=\{serviceDockWorkspace\}/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(shell, /prefix: 'knoux-recovery'/);
  assert.match(shell, /Recovery Vault/);
  assert.match(shell, /Recovery Tools/);
  assert.match(shell, /Continuity Evidence/);
  assert.match(shell, /workspace === 'performance' \|\| workspace === 'security' \|\| workspace === 'recovery' \? 560 : workspace === 'services' \? 640 : 420/);
  assert.match(serviceApps, /RecoveryStation/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
});


test('Services & Processes migrates only its service-mode surface into Dockview without replacing ServicesStation', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.match(stage, /servicesDockEnabled = service\.id === '07-Services-Processes' && serviceAppMode/);
  assert.match(stage, /serviceDockEnabled = programsDockEnabled \|\| softwareDockEnabled \|\| postInstallDockEnabled \|\| diagnosticsDockEnabled \|\| performanceDockEnabled \|\| securityDockEnabled \|\| recoveryDockEnabled \|\| servicesDockEnabled/);
  assert.match(stage, /workspace=\{serviceDockWorkspace\}/);
  assert.match(stage, /embedded=\{serviceDockEnabled\}/);
  assert.match(shell, /prefix: 'knoux-services'/);
  assert.match(shell, /System Topology/);
  assert.match(shell, /Service Tools/);
  assert.match(shell, /Process Evidence/);
  assert.match(shell, /explorerWidth: 140/);
  assert.match(shell, /contextWidth: 150/);
  assert.match(shell, /workspace === 'performance' \|\| workspace === 'security' \|\| workspace === 'recovery' \? 560 : workspace === 'services' \? 640 : 420/);
  assert.match(serviceApps, /ServicesStation/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
});

const FINAL_EIGHT_STATIONS = [
  {
    serviceId: '01-System-Maintenance',
    flag: 'maintenanceDockEnabled',
    kind: 'maintenance',
    prefix: 'knoux-maintenance',
    center: 'System Integrity Center',
    explorer: 'Maintenance Tools',
    context: 'Scan Evidence',
    station: 'MaintenanceStation',
  },
  {
    serviceId: '02-System-Cleanup',
    flag: 'cleanupDockEnabled',
    kind: 'cleanup',
    prefix: 'knoux-cleanup',
    center: 'Space Recovery Map',
    explorer: 'Cleanup Tools',
    context: 'Reclaim Evidence',
    station: 'CleanupStation',
  },
  {
    serviceId: '03-Network-Internet',
    flag: 'networkDockEnabled',
    kind: 'network',
    prefix: 'knoux-network',
    center: 'Network Topology',
    explorer: 'Network Tools',
    context: 'Path Evidence',
    station: 'NetworkStation',
  },
  {
    serviceId: '05-Duplicate-Files',
    flag: 'duplicatesDockEnabled',
    kind: 'duplicates',
    prefix: 'knoux-duplicates',
    center: 'Duplicate Intelligence Lab',
    explorer: 'Duplicate Tools',
    context: 'Restore Evidence',
    station: 'DuplicateStation',
  },
  {
    serviceId: '06-Disk-Space',
    flag: 'diskDockEnabled',
    kind: 'disk',
    prefix: 'knoux-disk',
    center: 'Storage Atlas',
    explorer: 'Storage Tools',
    context: 'Capacity Evidence',
    station: 'DiskSpaceStation',
  },
  {
    serviceId: '13-Privacy',
    flag: 'privacyDockEnabled',
    kind: 'privacy',
    prefix: 'knoux-privacy',
    center: 'Privacy Audit Center',
    explorer: 'Privacy Tools',
    context: 'Permission Evidence',
    station: 'PrivacyStation',
  },
  {
    serviceId: '14-Driver-Management',
    flag: 'driversDockEnabled',
    kind: 'drivers',
    prefix: 'knoux-drivers',
    center: 'Driver Matrix',
    explorer: 'Driver Tools',
    context: 'Device Evidence',
    station: 'DriversStation',
  },
  {
    serviceId: '15-System-Monitoring',
    flag: 'monitoringDockEnabled',
    kind: 'monitoring',
    prefix: 'knoux-monitoring',
    center: 'Live Resource Observatory',
    explorer: 'Monitoring Tools',
    context: 'Sample Evidence',
    station: 'MonitoringStation',
  },
];

for (const station of FINAL_EIGHT_STATIONS) {
  test(`${station.serviceId} migrates its service-mode surface into Dockview and keeps one canonical ${station.station} mount`, () => {
    const stage = read('src/components/premium/FamilyLiveStage.tsx');
    const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
    const serviceApps = read('src/components/ServiceApps.tsx');

    assert.match(stage, new RegExp(`${station.flag} = service\\.id === '${station.serviceId}' && serviceAppMode`));
    assert.match(stage, new RegExp(`'${station.serviceId}': '${station.kind}'`));
    assert.match(stage, new RegExp(`'${station.serviceId}': \\{\\s*\\n\\s*en: '[^']+',`));
    assert.match(stage, new RegExp(`'${station.serviceId}': \\{\\s*\\n\\s*en: '[^']+',\\s*\\n\\s*ar: '[^']*[\\u0600-\\u06FF][^']*',`));
    assert.match(stage, new RegExp(`\\|\\| ${station.flag}`));
    assert.match(shell, new RegExp(`\\b${station.kind}: \\{\\s*\\n\\s*prefix: '${station.prefix}'`));
    assert.match(shell, new RegExp(`\\b${station.kind}: \\{[\\s\\S]*?center: panelText\\(lang, '${station.center}'`));
    assert.match(shell, new RegExp(`\\b${station.kind}: \\{[\\s\\S]*?explorer: panelText\\(lang, '${station.explorer}'`));
    assert.match(shell, new RegExp(`\\b${station.kind}: \\{[\\s\\S]*?context: panelText\\(lang, '${station.context}'`));
    assert.match(shell, new RegExp(`'${station.kind}',`));
    assert.match(serviceApps, new RegExp(station.station));
    assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
  });
}

test('all 18 canonical services now resolve a Dockview workspace kind', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const serviceIds = [
    '01-System-Maintenance', '02-System-Cleanup', '03-Network-Internet',
    '04-Programs-Applications', '05-Duplicate-Files', '06-Disk-Space',
    '07-Services-Processes', '08-Performance', '09-Security', '10-Diagnostics-Reports',
    '11-Backup-Recovery', '13-Privacy', '14-Driver-Management', '15-System-Monitoring',
    '16-Software-Environment', '17-PostInstall-Setup',
  ];
  for (const serviceId of serviceIds) {
    assert.match(stage, new RegExp(`'${serviceId}': '[a-z]+'`), `${serviceId} must map to a dock workspace`);
  }
  assert.match(stage, /'01-System-Maintenance': 'maintenance'/);
  assert.match(stage, /'15-System-Monitoring': 'monitoring'/);
  assert.doesNotMatch(stage, /\|\|\s*undefined/);
});

test('Dockview renders the three locked panels inside their own groups, not a hidden overlay', () => {
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  assert.equal((shell.match(/renderer: 'always'/g) ?? []).length, 0);
  assert.equal((shell.match(/renderer: 'onlyWhenVisible'/g) ?? []).length, 3);
});

test('Duplicate Files keeps exactly one canonical mount through FamilyLiveStage and ServiceApps', () => {
  const familyPage = read('src/components/premium/FamilyPage.tsx');
  const serviceApps = read('src/components/ServiceApps.tsx');

  assert.doesNotMatch(familyPage, /showDuplicateStudio/);
  assert.doesNotMatch(familyPage, /DuplicateStation/);
  assert.doesNotMatch(familyPage, /ExecutionConfirmDialog/);
  assert.match(familyPage, /<FamilyLiveStage/);
  assert.equal((familyPage.match(/<FamilyLiveStage/g) ?? []).length, 1);
  assert.match(familyPage, /'05-Duplicate-Files',/);
  assert.match(serviceApps, /<DuplicateStation/);
  assert.equal((serviceApps.match(/<DuplicateStation/g) ?? []).length, 1);
});
