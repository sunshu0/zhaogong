import { expect, it } from "vitest";
import { conversationProfileHref } from "@/components/seeker/chat-client";

it("links static and saved recommendation chats to the counterpart's profile", () => {
  const base = { id: "candidate-lin", person: "林晓", title: "服务员", time: "昨天", avatar: "林", job: null };
  expect(conversationProfileHref(base, true)).toBe("/candidates/candidate-lin");
  expect(conversationProfileHref({ ...base, id: "recommend:local-demo:j1" }, true)).toBe("/candidates/local-demo");
  expect(conversationProfileHref({ ...base, id: "recommend:old:j1", candidateId: "local-new" }, true)).toBe(
    "/candidates/local-new",
  );
  expect(conversationProfileHref({ ...base, employerId: "e5" }, false)).toBe("/employers/e5");
  expect(conversationProfileHref(base, false)).toBeUndefined();
});
