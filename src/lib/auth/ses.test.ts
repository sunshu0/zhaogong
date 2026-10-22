import { describe, expect, it, vi } from "vitest";
import { sendSesEmail, sesConfig, type SesConfig } from "@/lib/auth/ses";

const config: SesConfig = {
  region: "ap-southeast-2",
  from: "找工 <no-reply@example.com>",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret-example",
};
const mail = { to: "mei@example.com", subject: "找工登录验证码：123456", text: "你的找工登录验证码是 123456。" };

describe("SES settings (#16)", () => {
  it("are there only when all four are set, trimmed", () => {
    const env = {
      SES_REGION: " ap-southeast-2 ",
      MAIL_FROM: "找工 <no-reply@example.com>",
      SES_ACCESS_KEY_ID: "AKIDEXAMPLE",
      SES_SECRET_ACCESS_KEY: "secret-example",
    };
    expect(sesConfig(env)).toEqual(config);
    for (const name of Object.keys(env)) expect(sesConfig({ ...env, [name]: " " })).toBeUndefined();
    expect(sesConfig({})).toBeUndefined();
  });
});

describe("sending one email through SES", () => {
  it("posts the SES v2 request to the region's endpoint, signed for ses in that region", async () => {
    const fetchImpl = vi.fn<(request: Request, init?: RequestInit) => Promise<Response>>(async () =>
      Response.json({ MessageId: "m-1" }),
    );
    expect(await sendSesEmail(config, mail, fetchImpl as unknown as typeof fetch)).toEqual({
      ok: true,
      messageId: "m-1",
    });
    const [request, init] = fetchImpl.mock.calls[0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://email.ap-southeast-2.amazonaws.com/v2/email/outbound-emails");
    expect(request.headers.get("authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/ap-southeast-2\/ses\/aws4_request, SignedHeaders=.*, Signature=[0-9a-f]{64}$/,
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(await request.text())).toEqual({
      FromEmailAddress: "找工 <no-reply@example.com>",
      Destination: { ToAddresses: ["mei@example.com"] },
      Content: {
        Simple: {
          Subject: { Data: "找工登录验证码：123456", Charset: "UTF-8" },
          Body: { Text: { Data: "你的找工登录验证码是 123456。", Charset: "UTF-8" } },
        },
      },
    });
  });

  it("gives back SES's status and error type when it refuses, without throwing", async () => {
    const refuse = async () =>
      Response.json(
        { message: "Email address is not verified." },
        { status: 400, headers: { "x-amzn-errortype": "MessageRejected:http://internal.amazon.com/" } },
      );
    expect(await sendSesEmail(config, mail, refuse as unknown as typeof fetch)).toEqual({
      ok: false,
      status: 400,
      error: "MessageRejected",
    });
    const noType = async () => Response.json({ message: "Throttling" }, { status: 429 });
    expect(await sendSesEmail(config, mail, noType as unknown as typeof fetch)).toEqual({
      ok: false,
      status: 429,
      error: "Throttling",
    });
  });

  it("counts an unreachable or slow SES as not sent (status 0)", async () => {
    const down = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await sendSesEmail(config, mail, down as unknown as typeof fetch)).toEqual({
      ok: false,
      status: 0,
      error: "TypeError",
    });
    const slow = async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    };
    expect(await sendSesEmail(config, mail, slow as unknown as typeof fetch)).toEqual({
      ok: false,
      status: 0,
      error: "TimeoutError",
    });
  });
});
