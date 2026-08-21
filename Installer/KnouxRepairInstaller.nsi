; KNOUX Repair v2.0.2 — x64 NSIS installer
; Keep registry keys stable between releases to support in-place upgrades.
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 32

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

!define PRODUCT_NAME "KNOUX Repair"
!define PRODUCT_VERSION "2.0.2"
!define PRODUCT_PUBLISHER "Knoux"
!define PRODUCT_EXE "KnouxRepair.exe"
!define INSTALL_REG_KEY "Software\Knoux\KnouxRepair"
!define UNINSTALL_REG_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\KnouxRepair"
!define DIST_DIR "..\Release\KnouxRepair-v2.0.2-win-x64-distribution"
!define OUT_DIR ".\Release"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${OUT_DIR}\KnouxRepair-v2.0.2-Setup-x64.exe"
InstallDir "$PROGRAMFILES64\KnouxRepair"
InstallDirRegKey HKLM "${INSTALL_REG_KEY}" "InstallLocation"
RequestExecutionLevel admin
BrandingText "Knoux — Glass Nexus"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "2.0.2.0"
VIAddVersionKey /LANG=1033 "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=1033 "FileVersion" "${PRODUCT_VERSION}.0"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright 2026 Knoux. Crafted by Eng. Sadek Elgazar"
VIAddVersionKey /LANG=1033 "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=1033 "FileDescription" "${PRODUCT_NAME} Setup"
VIAddVersionKey /LANG=1033 "OriginalFilename" "KnouxRepair-v2.0.2-Setup-x64.exe"

!define MUI_ABORTWARNING
!define MUI_ICON "assets\KnouxOfficialLogo.ico"
!define MUI_UNICON "assets\KnouxOfficialLogo.ico"
!define MUI_WELCOMEPAGE_TITLE "Welcome to KNOUX Repair Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard installs KNOUX Repair v${PRODUCT_VERSION} for all users of this computer.$\r$\n$\r$\nClose KNOUX Repair before continuing. The application and installer require administrator approval because repair operations use Windows system privileges."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch KNOUX Repair"
!define MUI_FINISHPAGE_LINK "Knoux Repair documentation"
!define MUI_FINISHPAGE_LINK_LOCATION "$INSTDIR\README-START-HERE.md"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Var PreserveGuiSettings

Function .onInit
    ${IfNot} ${RunningX64}
        MessageBox MB_ICONSTOP|MB_OK "KNOUX Repair requires 64-bit Windows 10 or Windows 11."
        Abort
    ${EndIf}
    SetRegView 64
    ReadRegStr $0 HKLM "${INSTALL_REG_KEY}" "InstallLocation"
    ${If} $0 != ""
        StrCpy $INSTDIR $0
    ${EndIf}
FunctionEnd

Section "KNOUX Repair (required)" SEC_MAIN
    SectionIn RO
    SetShellVarContext all
    SetOutPath "$INSTDIR"

    ; Preserve theme/language preferences for an in-place upgrade.
    StrCpy $PreserveGuiSettings "0"
    IfFileExists "$INSTDIR\Config\gui-settings.json" 0 +5
        InitPluginsDir
        CreateDirectory "$PLUGINSDIR\KnouxPreserve"
        CopyFiles /SILENT "$INSTDIR\Config\gui-settings.json" "$PLUGINSDIR\KnouxPreserve"
        StrCpy $PreserveGuiSettings "1"

    ; Self-contained distribution, including .NET runtime and all 18 tool categories.
    File /r "${DIST_DIR}\*.*"

    ${If} $PreserveGuiSettings == "1"
        CopyFiles /SILENT "$PLUGINSDIR\KnouxPreserve\gui-settings.json" "$INSTDIR\Config"
    ${EndIf}

    WriteUninstaller "$INSTDIR\Uninstall.exe"
    CreateDirectory "$SMPROGRAMS\KNOUX Repair"
    CreateShortcut "$SMPROGRAMS\KNOUX Repair\KNOUX Repair.lnk" "$INSTDIR\${PRODUCT_EXE}"
    CreateShortcut "$SMPROGRAMS\KNOUX Repair\Uninstall KNOUX Repair.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\KNOUX Repair.lnk" "$INSTDIR\${PRODUCT_EXE}"

    WriteRegStr HKLM "${INSTALL_REG_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
    WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKLM "${UNINSTALL_REG_KEY}" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
    WriteRegDWORD HKLM "${UNINSTALL_REG_KEY}" "NoModify" 1
    WriteRegDWORD HKLM "${UNINSTALL_REG_KEY}" "NoRepair" 1
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    WriteRegDWORD HKLM "${UNINSTALL_REG_KEY}" "EstimatedSize" "$0"
SectionEnd

Function un.onInit
    SetRegView 64
FunctionEnd

Section "Uninstall"
    SetShellVarContext all

    ; Retain real user settings and Reports; remove only installation-owned content.
    StrCpy $PreserveGuiSettings "0"
    IfFileExists "$INSTDIR\Config\gui-settings.json" 0 +5
        InitPluginsDir
        CreateDirectory "$PLUGINSDIR\KnouxPreserve"
        CopyFiles /SILENT "$INSTDIR\Config\gui-settings.json" "$PLUGINSDIR\KnouxPreserve"
        StrCpy $PreserveGuiSettings "1"

    Delete "$DESKTOP\KNOUX Repair.lnk"
    Delete "$SMPROGRAMS\KNOUX Repair\KNOUX Repair.lnk"
    Delete "$SMPROGRAMS\KNOUX Repair\Uninstall KNOUX Repair.lnk"
    RMDir "$SMPROGRAMS\KNOUX Repair"

    RMDir /r "$INSTDIR\Core"
    RMDir /r "$INSTDIR\Docs"
    RMDir /r "$INSTDIR\01-System-Maintenance"
    RMDir /r "$INSTDIR\02-System-Cleanup"
    RMDir /r "$INSTDIR\03-Network-Internet"
    RMDir /r "$INSTDIR\04-Programs-Applications"
    RMDir /r "$INSTDIR\05-Duplicate-Files"
    RMDir /r "$INSTDIR\06-Disk-Space"
    RMDir /r "$INSTDIR\07-Services-Processes"
    RMDir /r "$INSTDIR\08-Performance"
    RMDir /r "$INSTDIR\09-Security"
    RMDir /r "$INSTDIR\10-Diagnostics-Reports"
    RMDir /r "$INSTDIR\11-Backup-Recovery"
    RMDir /r "$INSTDIR\12-Developer-Tools"
    RMDir /r "$INSTDIR\13-Privacy"
    RMDir /r "$INSTDIR\14-Driver-Management"
    RMDir /r "$INSTDIR\15-System-Monitoring"
    RMDir /r "$INSTDIR\16-Software-Environment"
    RMDir /r "$INSTDIR\17-PostInstall-Setup"
    RMDir /r "$INSTDIR\18-Project-Sonar"
    RMDir /r "$INSTDIR\Config"

    ${If} $PreserveGuiSettings == "1"
        CreateDirectory "$INSTDIR\Config"
        CopyFiles /SILENT "$PLUGINSDIR\KnouxPreserve\gui-settings.json" "$INSTDIR\Config"
    ${EndIf}

    Delete "$INSTDIR\*.dll"
    Delete "$INSTDIR\*.exe"
    Delete "$INSTDIR\*.json"
    Delete "$INSTDIR\*.md"
    Delete "$INSTDIR\*.txt"
    Delete "$INSTDIR\*.pdb"
    Delete "$INSTDIR\*.xml"
    Delete "$INSTDIR\*.dat"
    Delete "$INSTDIR\*.ini"
    RMDir "$INSTDIR"

    DeleteRegKey HKLM "${UNINSTALL_REG_KEY}"
    DeleteRegKey HKLM "${INSTALL_REG_KEY}"
SectionEnd
