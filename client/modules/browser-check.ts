/**
 * Browser Check Module
 *
 * Checks if the browser is Chrome-based and displays a warning if not.
 */

export function checkBrowser(): void {
  // Check for "Chrome" in userAgent. This covers Chrome, Edge, Brave, Opera (Chromium-based).
  // Firefox and Safari do not have "Chrome" in their userAgent.
  const isChrome = navigator.userAgent.indexOf("Chrome") > -1;

  if (!isChrome) {
    const warningDiv = document.createElement("div");
    warningDiv.className = "browser-warning";
    warningDiv.textContent = "Warning: This application is tested on Chrome only. You may experience issues on other browsers.";
    document.body.appendChild(warningDiv);
  }
}
