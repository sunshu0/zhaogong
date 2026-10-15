// Which job an employer is looking at a job seeker for (C6): the `job` in the link (推荐人才 adds it), else the
// job of an existing chat with them. A chat for that job means 回到聊天; without one the page offers 发起聊天.
type ConversationRef = { id: string; job: string | null; candidateId?: string };

export type CandidateContext = { jobId: string | null; conversationId: string | null };

/** Chats opened before candidateId was stored keep the candidate in the id (`recommend:<candidate>:<job>`). */
function isWithCandidate(conversation: ConversationRef, candidateId: string): boolean {
  return (
    conversation.candidateId === candidateId ||
    conversation.id === candidateId ||
    conversation.id.startsWith(`recommend:${candidateId}:`)
  );
}

export function candidateContext(
  conversations: readonly ConversationRef[],
  candidateId: string,
  jobParam: string | null,
): CandidateContext {
  const chats = conversations.filter((conversation) => isWithCandidate(conversation, candidateId));
  const jobId = jobParam || chats.find((conversation) => conversation.job)?.job || null;
  const chat = jobId ? chats.find((conversation) => conversation.job === jobId) : chats[0];
  return { jobId, conversationId: chat?.id ?? null };
}
