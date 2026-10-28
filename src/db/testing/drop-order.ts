export type TableReferences = { name: string; parents: readonly string[] };

export function sqlIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Compute the entire child-before-parent order before dropping anything. A cross-table cycle fails closed. */
export function childFirstTables(tables: readonly TableReferences[]): string[] {
  const byName = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  if (byName.size !== tables.length) throw new Error("Cannot reset D1: duplicate table name");
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const parentsFirst: string[] = [];

  function visit(key: string): void {
    if (visited.has(key)) return;
    const table = byName.get(key)!;
    if (visiting.has(key)) throw new Error(`Cannot reset D1: foreign-key cycle at ${table.name}`);
    visiting.add(key);
    for (const parent of new Set(table.parents.map((name) => name.toLowerCase()))) {
      // A self-reference disappears with its table; an excluded parent will still exist after this reset.
      if (parent !== key && byName.has(parent)) visit(parent);
    }
    visiting.delete(key);
    visited.add(key);
    parentsFirst.push(table.name);
  }

  for (const key of byName.keys()) visit(key);
  return parentsFirst.reverse();
}
