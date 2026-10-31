import { expect, it } from "vitest";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";
import { seekerEmployerEn as en } from "@/i18n/messages/en/seeker-employer";

const zh = seekerEmployerMessages.zh;

// A real business's page says nothing of demo data, and no page shows the internal id (user feedback 10-30 #2,
// UI review 3 C1–C3); the demo data's pages still say 演示企业.
it("says demo only on the demo data, in both languages", () => {
  expect(zh.eyebrow(false)).toBe("企业主页");
  expect(zh.eyebrow(true)).toBe("企业主页 · 演示企业");
  expect(en.eyebrow(false)).toBe("Business page");
  expect(en.eyebrow(true)).toBe("Business page · Demo business");
  for (const t of [zh, en]) {
    expect(t.accreditedYes).not.toMatch(/演示|demo/i);
    expect(t.verificationNote(false)).not.toMatch(/演示|demo/i);
    expect(t.verificationNote(true)).toMatch(/演示|demo/i);
    expect(t.eyebrow(true)).not.toMatch(/ID/);
  }
});
