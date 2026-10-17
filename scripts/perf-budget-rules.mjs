// Rules of the performance budget (#169): how much JavaScript each route makes a browser download before the page
// works (its first load), gzip-compressed, against the budget in scripts/perf-budget.json. The numbers come from
// the build's own diagnostics (.next/diagnostics/route-bundle-stats.json: each route's first-load chunks).
// Kept apart from perf-budget.mjs, which reads the files, so the rules have unit tests.

/** Headroom over the measured size when budgets are set (导师 10-18: 10–15%, never change pages to fit). */
export const MARGIN = 0.12;

/**
 * Each route's first-load size in bytes: the sum of its chunks' sizes, each chunk once. `sizeOf(path)` gives one
 * chunk's (compressed) size; paths in the stats use the platform's separator and are relative to the project.
 */
export function routeSizes(stats, sizeOf) {
  return stats.map(({ route, firstLoadChunkPaths }) => {
    const paths = [...new Set(firstLoadChunkPaths.map((p) => p.replaceAll("\\", "/")))];
    return { route, bytes: paths.reduce((sum, p) => sum + sizeOf(p), 0) };
  });
}

/** A budget in KB (1024 bytes): the size plus the margin, rounded up to a whole KB. */
export function budgetKb(bytes, margin = MARGIN) {
  // Round the bytes first: 102400 * 1.12 is 114688.00000000001 in floating point, which would round up a KB.
  return Math.ceil(Math.round(bytes * (1 + margin)) / 1024);
}

/**
 * Budgets for every route from measured sizes, and a default for a route that has none yet: the largest route
 * budget, so a new page may be as heavy as the heaviest one today but no heavier.
 */
export function makeBudgets(sizes, margin = MARGIN) {
  const routes = Object.fromEntries(
    [...sizes]
      .sort((a, b) => a.route.localeCompare(b.route))
      .map(({ route, bytes }) => [route, budgetKb(bytes, margin)]),
  );
  return { margin, defaultKb: Math.max(0, ...Object.values(routes)), routes };
}

/**
 * Each route against its budget, heaviest first. `over`: larger than its budget (or than the default when it has
 * none). `unbudgeted`: a route the budget file does not list yet.
 */
export function checkBudgets(sizes, budgets) {
  return sizes
    .map(({ route, bytes }) => {
      const unbudgeted = !(route in budgets.routes);
      const limitKb = unbudgeted ? budgets.defaultKb : budgets.routes[route];
      const kb = Math.round((bytes / 1024) * 10) / 10;
      return { route, kb, limitKb, over: bytes > limitKb * 1024, unbudgeted };
    })
    .sort((a, b) => b.kb - a.kb);
}
