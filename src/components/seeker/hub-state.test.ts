import { describe, expect, it } from "vitest";
import { initialProfile, resolveProfiles } from "@/components/seeker/hub-state";
import { identityScope } from "@/components/seeker/identity-scope";

const seeker = (email: string) => ({ email, signedInAt: "", activeRole: "seeker" as const });

describe("the page before anyone changed it (#125)", () => {
  it("is empty for a real account and 林晓 only for a demo account", () => {
    expect(initialProfile(seeker("wang.fang@gmail.com"))).toMatchObject({ name: "", headline: "", bio: "" });
    expect(initialProfile(null).name).toBe("");
    expect(initialProfile(seeker("seeker@example.com")).name).toBe("林晓");
    expect(initialProfile(seeker("demo.apply.1@example.com")).name).toBe("林晓");
    expect(initialProfile(seeker("someone@example.com")).name).toBe("");
  });

  it("is the business's name for a 企业主页", () => {
    expect(
      initialProfile({ email: "boss@example.com", signedInAt: "", activeRole: "employer", employerName: "川味小馆" }),
    ).toMatchObject({ name: "川味小馆", headline: "" });
  });

  it("fills other identities' stored pages the same way, by the email in their scope", () => {
    const real = identityScope(seeker("real@gmail.com"));
    const demo = identityScope(seeker("seeker@example.com"));
    const pages = resolveProfiles({ [real]: { bio: "会做咖啡" }, [demo]: { bio: "会做咖啡" }, "legacy@gmail.com": {} });
    expect(pages[real]).toMatchObject({ name: "", bio: "会做咖啡" });
    expect(pages[demo]).toMatchObject({ name: "林晓", bio: "会做咖啡" });
    expect(pages["legacy@gmail.com"].name).toBe("");
  });
});
