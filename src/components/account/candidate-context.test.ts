import { describe, expect, it } from "vitest";
import { candidateContext } from "./candidate-context";

const chats = [
  { id: "other", job: "j9", candidateId: "candidate-chen" },
  { id: "candidate-lin", job: "j1" },
  { id: "recommend:candidate-lin:j3", job: "j3", candidateId: "candidate-lin" },
];

describe("candidateContext", () => {
  it("uses the job from the link and the chat about that job", () => {
    expect(candidateContext(chats, "candidate-lin", "j3")).toEqual({
      jobId: "j3",
      conversationId: "recommend:candidate-lin:j3",
    });
  });

  it("has no chat to go back to when the linked job was never discussed", () => {
    expect(candidateContext(chats, "candidate-lin", "j7")).toEqual({ jobId: "j7", conversationId: null });
  });

  it("falls back to the job of an existing chat", () => {
    expect(candidateContext(chats, "candidate-lin", null)).toEqual({ jobId: "j1", conversationId: "candidate-lin" });
  });

  it("knows nothing about someone you never talked to", () => {
    expect(candidateContext(chats, "candidate-wang", null)).toEqual({ jobId: null, conversationId: null });
  });
});
