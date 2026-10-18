import { describe, expect, it } from "vitest";
import { getAccountLang, langOnSignIn, setAccountLang } from "@/db/account-lang";
import { exportAccountData } from "@/db/account-data";
import { ensureAccount } from "@/lib/data";

describe("the account's language (Round 20, ADR 0023 §5)", () => {
  it("is null until chosen, then the choice, and comes with the account's data", async () => {
    await ensureAccount("lang.choice@example.com");
    expect(await getAccountLang("lang.choice@example.com")).toBeNull();
    await setAccountLang(" Lang.Choice@Example.com ", "en");
    expect(await getAccountLang("lang.choice@example.com")).toBe("en");
    expect((await exportAccountData("lang.choice@example.com"))?.account.lang).toBe("en");
    expect(await getAccountLang("no.such.account@example.com")).toBeNull();
  });

  it("at sign-in: the account's choice wins; an account that never chose takes the browser's", async () => {
    await ensureAccount("lang.chose@example.com");
    await setAccountLang("lang.chose@example.com", "en");
    expect(await langOnSignIn("lang.chose@example.com", "zh")).toBe("en");
    expect(await getAccountLang("lang.chose@example.com")).toBe("en");

    await ensureAccount("lang.new@example.com");
    expect(await langOnSignIn("lang.new@example.com", "en")).toBe("en");
    expect(await getAccountLang("lang.new@example.com")).toBe("en");
    expect(await langOnSignIn("lang.new@example.com", "zh")).toBe("en"); // now it has chosen
  });
});
