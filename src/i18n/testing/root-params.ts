// Stands in for next/root-params in unit tests (vitest.config.mts): the real module is a placeholder that only
// Next's compiler fills in, and it throws when imported anywhere else. Outside app/[lang] there is no root
// parameter, so serverLang() reads Chinese; a test that needs English mocks next/root-params itself.
export async function lang(): Promise<string | undefined> {
  return undefined;
}
