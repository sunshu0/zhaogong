// The Anthropic client for chat posting (#102). Server only: the key comes from the server's environment
// (ANTHROPIC_API_KEY, a Cloudflare secret in production) and never reaches the browser or the repository.
import Anthropic from "@anthropic-ai/sdk";
import type { SendMessage } from "./turn";

let client: Anthropic | undefined;

/** One request, at most 20 s and one retry: the employer is waiting in the chat. */
export const claudeSend: SendMessage = (params) => {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Pinned, so a base URL set on the machine for other tools is not picked up; AI_POST_BASE_URL overrides it.
    baseURL: process.env.AI_POST_BASE_URL || "https://api.anthropic.com",
    timeout: 20_000,
    maxRetries: 1,
  });
  return client.beta.messages.create(params);
};
