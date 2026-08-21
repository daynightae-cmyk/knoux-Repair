#define MyAppName "KNOUX Repair"
#define MyAppVersion "2.0.2"
#define MyAppPublisher "Knoux"
#define MyAppExeName "KnouxRepair.exe"

[Setup]
AppId={{6F1A67E9-1E23-4D90-B0AA-521714953602}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\KNOUX Repair
DefaultGroupName=KNOUX Repair
DisableProgramGroupPage=no
AllowNoIcons=yes
OutputDir=Output
OutputBaseFilename=KNOUX-Repair-v2.0.2-Setup
SetupIconFile=..\Glass-GUI-Builder\src\KnouxRepair\Assets\KnouxOfficialLogo.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern
WizardImageFile=Branding\KnouxInstallerWelcome.bmp
WizardSmallImageFile=Branding\KnouxInstallerSmall.bmp
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=no
DisableWelcomePage=no
DisableReadyMemo=no
CreateUninstallRegKey=yes
UninstallDisplayName=KNOUX Repair 2.0.2
VersionInfoVersion=2.0.2.0
VersionInfoCompany=Knoux
VersionInfoDescription=KNOUX Repair premium Windows installer
VersionInfoProductName=KNOUX Repair
VersionInfoProductVersion=2.0.2

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce
Name: "startmenuicon"; Description: "Create a &Start Menu shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce

[Files]
Source: "Staging\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\KNOUX Repair"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{group}\KNOUX Repair"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: startmenuicon
Name: "{group}\Uninstall KNOUX Repair"; Filename: "{uninstallexe}"; Tasks: startmenuicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch KNOUX Repair"; Flags: nowait postinstall skipifsilent

[Code]
function UpdateReadyMemo(Space, NewLine, MemoUserInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result :=
    'KNOUX Repair ' + '{#MyAppVersion}' + NewLine + NewLine +
    'Installation folder:' + NewLine + MemoDirInfo + NewLine + NewLine +
    'Shortcuts:' + NewLine + MemoTasksInfo + NewLine + NewLine +
    'The installer calculates the required disk space from the application files before installation.';
end;
