; BeeboScore installer additions.
; A fresh install (not an auto-update) leaves a marker; on first launch the app clears the
; name-autocomplete history so a new install always starts clean. Layouts and settings are kept.
!macro customInstall
  ${ifNot} ${isUpdated}
    FileOpen $0 "$INSTDIR\resources\fresh-install" w
    FileWrite $0 "1"
    FileClose $0
  ${endIf}
!macroend
