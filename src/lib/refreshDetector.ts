/**
 * Detects if the current page load is a browser reload (F5 / Ctrl+F5).
 * Uses the Navigation Timing API (PerformanceNavigationTiming).
 */
export function isPageReload(): boolean {
  try {
    const nav = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming | undefined;
    if (nav) return nav.type === "reload";
    // Deprecated fallback for older browsers
    return performance.navigation?.type === 1;
  } catch {
    return false;
  }
}
