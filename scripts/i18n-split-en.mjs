// #240: moves a dictionary's English side out of src/i18n/messages/<module>.ts into src/i18n/messages/en/<module>.ts,
// so the browser loads it only on English pages (src/i18n/english.ts). Each line runs it on its own dictionaries:
//
//   node scripts/i18n-split-en.mjs src/i18n/messages/chat.ts [more files…]
//
// For every `export const xMessages: Dictionary<…> = { zh: …, en: { … } }` in a file it:
// - writes `export const xEn: Messages<(typeof xMessages)["zh"]> = { … }` to en/<module>.ts, with the helpers and
//   imports the English side uses (copied; a helper only the English side used leaves the Chinese file);
// - leaves `{ key: "x", zh: … }` in the Chinese file;
// - adds the English to en/index.ts.
// Then run prettier on the files it names, and tsc.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const EN_DIR = "src/i18n/messages/en";
const INDEX = `${EN_DIR}/index.ts`;

function topLevelNames(sf) {
  // name → statement, for top-level declarations other than the dictionary exports and the Chinese side.
  const map = new Map();
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) map.set(d.name.text, st);
    if ((ts.isFunctionDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && st.name)
      map.set(st.name.text, st);
  }
  return map;
}

function importedNames(sf) {
  // local name → { from, imported, typeOnly }
  const map = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const from = st.moduleSpecifier.text;
    const clauseTypeOnly = st.importClause.isTypeOnly;
    const bindings = st.importClause.namedBindings;
    if (st.importClause.name)
      map.set(st.importClause.name.text, { from, imported: "default", typeOnly: clauseTypeOnly });
    if (bindings && ts.isNamedImports(bindings))
      for (const el of bindings.elements)
        map.set(el.name.text, {
          from,
          imported: (el.propertyName ?? el.name).text,
          typeOnly: clauseTypeOnly || el.isTypeOnly,
        });
  }
  return map;
}

function identifiersIn(node, out = new Set()) {
  if (ts.isIdentifier(node)) out.add(node.text);
  // Property names in `a.b` and `{ b: … }` are not references.
  if (ts.isPropertyAccessExpression(node)) {
    identifiersIn(node.expression, out);
    return out;
  }
  if (ts.isPropertyAssignment(node)) {
    if (ts.isComputedPropertyName(node.name)) identifiersIn(node.name, out);
    identifiersIn(node.initializer, out);
    return out;
  }
  // A callback that returns something stops forEachChild: return nothing.
  ts.forEachChild(node, (child) => {
    identifiersIn(child, out);
  });
  return out;
}

function split(file) {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const moduleName = path.basename(file, ".ts");
  const helpers = topLevelNames(sf);
  const imports = importedNames(sf);

  const found = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.name.text.endsWith("Messages") || !d.initializer) continue;
      if (!ts.isObjectLiteralExpression(d.initializer)) continue;
      const en = d.initializer.properties.find(
        (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "en",
      );
      if (!en) continue;
      found.push({ exportName: d.name.text, literal: d.initializer, en });
    }
  }
  if (found.length === 0) {
    console.log(`${file}: no inline English left, nothing to do`);
    return [];
  }

  // What the English sides use: helpers (and the helpers they use), and imports.
  const usedHelpers = new Set();
  const usedImports = new Set();
  const visit = (names) => {
    for (const name of names) {
      if (helpers.has(name) && !usedHelpers.has(name) && !found.some((f) => f.exportName === name)) {
        usedHelpers.add(name);
        visit(identifiersIn(helpers.get(name)));
      } else if (imports.has(name)) usedImports.add(name);
    }
  };
  for (const f of found) visit(identifiersIn(f.en.initializer));

  // The Chinese file without the English sides; then which helpers it still uses.
  let zhText = source;
  const edits = [];
  for (const f of found) {
    const key = f.exportName.replace(/Messages$/, "");
    const props = f.literal.properties.filter((p) => p !== f.en);
    const body = props.map((p) => p.getText(sf)).join(", ");
    edits.push({ start: f.literal.getStart(sf), end: f.literal.getEnd(), text: `{ key: "${key}", ${body} }` });
  }
  for (const e of edits.sort((a, b) => b.start - a.start))
    zhText = zhText.slice(0, e.start) + e.text + zhText.slice(e.end);
  const zhAfter = ts.createSourceFile(file, zhText, ts.ScriptTarget.Latest, true);
  const stillUsed = new Set();
  for (const st of zhAfter.statements) {
    const declared = new Set();
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) declared.add(d.name.text);
    if ((ts.isFunctionDeclaration(st) || ts.isTypeAliasDeclaration(st)) && st.name) declared.add(st.name.text);
    if (ts.isImportDeclaration(st)) continue;
    for (const name of identifiersIn(st)) if (!declared.has(name)) stillUsed.add(name);
  }
  // Drop helpers the Chinese file no longer uses (moved, not copied).
  const drop = [...usedHelpers].filter((name) => !stillUsed.has(name));
  if (drop.length) {
    const sf2 = ts.createSourceFile(file, zhText, ts.ScriptTarget.Latest, true);
    const cuts = [];
    for (const st of sf2.statements) {
      const names = ts.isVariableStatement(st)
        ? st.declarationList.declarations.map((d) => d.name.getText(sf2))
        : (ts.isFunctionDeclaration(st) || ts.isTypeAliasDeclaration(st)) && st.name
          ? [st.name.text]
          : [];
      if (names.length && names.every((n) => drop.includes(n)))
        cuts.push({ start: st.getFullStart(), end: st.getEnd() });
    }
    for (const c of cuts.sort((a, b) => b.start - a.start)) zhText = zhText.slice(0, c.start) + zhText.slice(c.end);
  }
  // Imports the Chinese file no longer uses go too (not the Dictionary type).
  {
    const sf3 = ts.createSourceFile(file, zhText, ts.ScriptTarget.Latest, true);
    const used = new Set();
    for (const st of sf3.statements) if (!ts.isImportDeclaration(st)) identifiersIn(st, used);
    const cuts = [];
    for (const st of sf3.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue;
      const bindings = st.importClause.namedBindings;
      const names = [
        ...(st.importClause.name ? [st.importClause.name.text] : []),
        ...(bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => e.name.text) : []),
      ];
      const keep = names.filter((n) => used.has(n));
      if (keep.length === names.length) continue;
      if (keep.length === 0) {
        // From the import itself, so a comment above it (the file's header) stays.
        cuts.push({ start: st.getStart(sf3), end: st.getEnd() + (zhText[st.getEnd()] === "\n" ? 1 : 0), text: "" });
        continue;
      }
      const typeOnly = st.importClause.isTypeOnly ? "type " : "";
      const els = bindings.elements
        .filter((e) => keep.includes(e.name.text))
        .map((e) => e.getText(sf3))
        .join(", ");
      cuts.push({
        start: st.getStart(sf3),
        end: st.getEnd(),
        text: `import ${typeOnly}{ ${els} } from "${st.moduleSpecifier.text}";`,
      });
    }
    for (const c of cuts.sort((a, b) => b.start - a.start))
      zhText = zhText.slice(0, c.start) + c.text + zhText.slice(c.end);
  }

  // The English file.
  const byModule = new Map();
  for (const name of usedImports) {
    const { from, imported, typeOnly } = imports.get(name);
    const spec = imported === name ? name : `${imported} as ${name}`;
    if (!byModule.has(from)) byModule.set(from, []);
    byModule.get(from).push((typeOnly ? "type " : "") + spec);
  }
  const relZh = `@/i18n/messages/${moduleName}`;
  const lines = [
    `// The English side of ${moduleName}.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).`,
    `// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.`,
    "",
    `import type { Messages } from "@/i18n/messages";`,
    `import type { ${found.map((f) => f.exportName).join(", ")} } from "${relZh}";`,
    ...[...byModule].map(([from, specs]) => `import { ${specs.join(", ")} } from "${from}";`),
    "",
    ...[...usedHelpers].map((name) => helpers.get(name).getText(sf)).filter((v, i, a) => a.indexOf(v) === i),
    "",
    ...found.map((f) => {
      const leading = ts
        .getLeadingCommentRanges(source, f.en.getFullStart())
        ?.map((r) => source.slice(r.pos, r.end))
        .join("\n");
      const name = f.exportName.replace(/Messages$/, "En");
      return `${leading ? `${leading}\n` : ""}export const ${name}: Messages<(typeof ${f.exportName})["zh"]> = ${f.en.initializer.getText(sf)};\n`;
    }),
  ];
  const enFile = `${EN_DIR}/${moduleName}.ts`;
  if (existsSync(enFile)) throw new Error(`${enFile} exists already`);
  writeFileSync(enFile, lines.join("\n"));
  writeFileSync(file, zhText);

  // en/index.ts: one entry per dictionary, keyed like the Chinese side.
  let index = readFileSync(INDEX, "utf8");
  for (const f of found) {
    const key = f.exportName.replace(/Messages$/, "");
    const name = f.exportName.replace(/Messages$/, "En");
    index = index.replace(
      "// imports (scripts/i18n-split-en.mjs)",
      `import { ${name} } from "./${moduleName}";\n// imports (scripts/i18n-split-en.mjs)`,
    );
    index = index.replace(
      "  // entries (scripts/i18n-split-en.mjs)",
      `  ${key}: ${name},\n  // entries (scripts/i18n-split-en.mjs)`,
    );
  }
  writeFileSync(INDEX, index);
  console.log(`${file}: ${found.map((f) => f.exportName).join(", ")} → ${enFile}`);
  return [file, enFile];
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/i18n-split-en.mjs src/i18n/messages/<module>.ts …");
  process.exit(1);
}
const touched = files.flatMap(split);
if (touched.length) console.log(`now: npx prettier --write ${[...touched, INDEX].join(" ")}`);
