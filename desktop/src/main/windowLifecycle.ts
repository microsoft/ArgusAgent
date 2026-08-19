/** Pure desktop-window lifetime policy, kept independent of Electron for tests. */

/** Only an ordinary user close hides the shell; quit/session-end must close. */
export function shouldHideWindowOnClose(
  quitting: boolean,
  windowsSessionEnding = false,
): boolean {
  return !quitting && !windowsSessionEnding;
}

/** Default app exit detaches the owned backend for later authenticated adoption. */
export function shouldStopBackendOnQuit(stopBackendAndQuitRequested: boolean): boolean {
  return stopBackendAndQuitRequested;
}
