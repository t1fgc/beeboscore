; BeeboScore (developed by Beebo): the portable Testbuild's launcher — electron-builder's portable.nsi, changed so the
; unpacked app is kept between launches (tools/portable-cache.js puts it in place before a Testbuild is built).
!include "common.nsh"
!include "extractAppPackage.nsh"

# https://github.com/electron-userland/electron-builder/issues/3972#issuecomment-505171582
CRCCheck off
WindowIcon Off
AutoCloseWindow True
RequestExecutionLevel ${REQUEST_EXECUTION_LEVEL}

Function .onInit
  !ifndef SPLASH_IMAGE
    SetSilent silent
  !endif

  !insertmacro check64BitAndSetRegView
FunctionEnd

Function .onGUIInit
  InitPluginsDir

  !ifdef SPLASH_IMAGE
    File /oname=$PLUGINSDIR\splash.bmp "${SPLASH_IMAGE}"
    BgImage::SetBg $PLUGINSDIR\splash.bmp
    BgImage::Redraw
  !endif
FunctionEnd

Section
  !ifdef SPLASH_IMAGE
    HideWindow
  !endif

  StrCpy $INSTDIR "$PLUGINSDIR\app"
  !ifdef UNPACK_DIR_NAME
    StrCpy $INSTDIR "$TEMP\${UNPACK_DIR_NAME}"
  !endif

  ; BeeboScore 1.12.16: keep the unpacked app between launches. The folder is named after the version
  ; (unpackDirName), and .beebo-ready-<version> is written only once everything is in place, so a copy that was cut short is
  ; unpacked again. The app removes other versions' folders itself once it's running (desktop/main.js).
  ${IfNot} ${FileExists} "$INSTDIR\.beebo-ready-${VERSION}"
  RMDir /r $INSTDIR
  SetOutPath $INSTDIR

  !ifdef APP_DIR_64
    !ifdef APP_DIR_ARM64
      !ifdef APP_DIR_32
        ${if} ${IsNativeARM64}
          File /r "${APP_DIR_ARM64}\*.*"
        ${elseif} ${RunningX64}
          File /r "${APP_DIR_64}\*.*"
        ${else}
          File /r "${APP_DIR_32}\*.*"
        ${endIf}
      !else
        ${if} ${IsNativeARM64}
          File /r "${APP_DIR_ARM64}\*.*"
        ${else}
          File /r "${APP_DIR_64}\*.*"
        {endIf}
      !endif
    !else
      !ifdef APP_DIR_32
        ${if} ${RunningX64}
          File /r "${APP_DIR_64}\*.*"
        ${else}
          File /r "${APP_DIR_32}\*.*"
        ${endIf}
      !else
        File /r "${APP_DIR_64}\*.*"
      !endif
    !endif
  !else
    !ifdef APP_DIR_32
      File /r "${APP_DIR_32}\*.*"
    !else
      !insertmacro extractEmbeddedAppPackage
    !endif
  !endif

  FileOpen $1 "$INSTDIR\.beebo-ready-${VERSION}" w
  FileWrite $1 "ready"
  FileClose $1
  ${EndIf}
  SetOutPath $INSTDIR

  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_DIR", "$EXEDIR").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_FILE", "$EXEPATH").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_APP_FILENAME", "${APP_FILENAME}").r0'
  ${StdUtils.GetAllParameters} $R0 0

  !ifdef SPLASH_IMAGE
    BgImage::Destroy
  !endif

	ExecWait "$INSTDIR\${APP_EXECUTABLE_FILENAME} $R0" $0
  SetErrorLevel $0

  SetOutPath $EXEDIR
SectionEnd
