; Argus intentionally maps a normal window close to "hide in tray". NSIS must
; therefore terminate the old release explicitly before its built-in running-
; app check; sending WM_CLOSE alone can never prove that the process exited.
!macro forceStopArgus
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "Argus.exe"'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "argus-backend.exe"'
  Sleep 750
!macroend

; Runs before install-mode setup and therefore also protects the legacy
; uninstaller that the new installer invokes during an in-place upgrade.
!macro customInit
  !insertmacro forceStopArgus
!macroend

; Replace electron-builder's dialog-based check in every generated installer
; and uninstaller pass. Its normal graceful WM_CLOSE path maps to "hide in
; tray" in Argus, so waiting/retrying can never establish process exit.
!macro customCheckAppRunning
  !insertmacro forceStopArgus

  ; Some legacy 0.1.2 uninstallers return exit code 2 even with no Argus
  ; process, causing installUtil.nsh to retry and misreport appCannotBeClosed.
  ; Keep INSTALL_REGISTRY_KEY so initMultiUser retains the chosen directory,
  ; but remove the obsolete uninstaller registration immediately before the
  ; install section calls uninstallOldVersion. The new package then overwrites
  ; the dedicated app directory in place and writes a fresh registration.
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
!macroend
