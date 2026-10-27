// Its own module so a page that only polls (审核后台's 聊天, #407) does not load the whole chat client for it.

/** How often an open chat page reads again while it is in front. */
export const CHAT_REFRESH_MS = 10_000;
