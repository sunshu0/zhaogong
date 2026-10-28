import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), moderator: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/db/conversations", () => ({ findSharedConversation: mocks.find }));
vi.mock("@/db/moderators", () => ({ isModerator: mocks.moderator }));
const { GET } = await import("./route");
const origin = "https://zhaogong.example";
const open = (role: string, conversation: string) =>
  GET(new Request(`${origin}/api/push/open?role=${role}&conversation=${encodeURIComponent(conversation)}`));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ email: "me@example.com", activeRole: "seeker" });
  mocks.moderator.mockResolvedValue(false);
});
describe("push notification click authorization", () => {
  it("requires sign-in and retains only a same-origin return path", async () => {
    mocks.session.mockResolvedValue(null);
    const result = await open("seeker", "employer:e1:j1");
    const location = new URL(result.headers.get("Location")!);
    expect(location.origin).toBe(origin);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/api/push/open?role=seeker&conversation=employer%3Ae1%3Aj1");
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
  it("never changes role or looks up another identity's private chat", async () => {
    expect((await open("employer", "chat:12345678")).headers.get("Location")).toBe(
      `${origin}/account?pushRole=employer`,
    );
    mocks.moderator.mockResolvedValue(true);
    expect((await open("seeker", "employer:e1:j1")).headers.get("Location")).toContain("/account?");
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("checks conversation ownership with the current account before opening it", async () => {
    mocks.find.mockResolvedValue(undefined);
    expect((await open("seeker", "employer:e1:j1")).headers.get("Location")).toBe(`${origin}/messages`);
    expect(mocks.find).toHaveBeenCalledWith(
      { side: "seeker", email: "me@example.com" },
      { employerId: "e1", jobId: "j1" },
    );
    mocks.find.mockResolvedValue({ id: "owned" });
    expect((await open("seeker", "employer:e1:j1")).headers.get("Location")).toBe(
      `${origin}/messages?conversation=employer%3Ae1%3Aj1`,
    );
    mocks.session.mockResolvedValue({
      email: "boss@example.com",
      activeRole: "employer",
      employer: { id: "current-business" },
    });
    await open("employer", "chat:12345678");
    expect(mocks.find).toHaveBeenLastCalledWith(
      { side: "employer", employerId: "current-business" },
      { rowId: "12345678" },
    );
  });
  it("does not turn malformed or external-looking input into an external redirect", async () => {
    for (const value of ["https://evil.example", "//evil.example", "chat:short", "employer:a:b:c"]) {
      expect((await open("seeker", value)).headers.get("Location")).toBe(`${origin}/messages`);
    }
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
