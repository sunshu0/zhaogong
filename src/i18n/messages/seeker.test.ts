import { describe, expect, it } from "vitest";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";
import { seekerHomeMessages } from "@/i18n/messages/seeker-home";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";
import { uiMessages } from "@/i18n/messages/ui";

const DICTIONARIES = {
  "seeker-employer": seekerEmployerMessages,
  "seeker-home": seekerHomeMessages,
  "seeker-jobs": seekerJobsMessages,
  "seeker-me": seekerMeMessages,
  "seeker-profile": seekerProfileMessages,
  ui: uiMessages,
};

/** Chinese the English side keeps on purpose: the product name, the language tab, the stamp, the CV's own title. */
const KEPT = ["找工", "中文", "招", "中英文简历"];
const CJK = /[一-鿿]/;

/** Every text of a side, as key paths; functions are called with stand-in arguments. */
function texts(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") return [[path, String(value(...Array<number>(value.length).fill(2)))]];
  if (Array.isArray(value)) return value.flatMap((item, i) => texts(item, `${path}[${i}]`));
  return Object.entries(value as object).flatMap(([key, item]) => texts(item, path ? `${path}.${key}` : key));
}

describe("line A's dictionaries (Round 20)", () => {
  for (const [name, dictionary] of Object.entries(DICTIONARIES)) {
    it(`${name}: the English side has the Chinese side's keys and no Chinese left in it`, () => {
      const zh = texts(dictionary.zh).map(([path]) => path);
      const en = texts(dictionary.en);
      expect(en.map(([path]) => path)).toEqual(zh);
      const left = en.filter(([, text]) => CJK.test(KEPT.reduce((rest, word) => rest.replaceAll(word, ""), text)));
      expect(left).toEqual([]);
    });
  }
});
