// Round 20 (ADR 0023): the business verification queue on the moderation pages — VerificationQueue.tsx and
// verification-actions.ts. The checklist items, the rejection reasons and the badge names (已验证企业, 认证雇主) are
// in B's employer-verify dictionary (employer/verification.ts, which employers see too): this one takes them as
// words passed in (导师决定（补充）).

import type { Dictionary } from "@/i18n/messages";

const adminVerificationZh = {
  listName: "企业验证申请",
  empty: "没有待审核的企业验证。",
  howTo:
    "逐项核对后打勾，必做的都打勾才能通过。电话要打公开渠道查到的公司电话，不只打申请人填的号码。核对结果和备注会存进审核记录。",
  cardLabel: (tradingName: string) => `企业验证：${tradingName}`,
  applyingFor: (badge: string) => `申请${badge}`,
  banned: "已封禁",
  submitted: (when: string) => `提交于 ${when}`,
  register: {
    heading: "企业登记（示例登记）",
    legalName: "登记名",
    notInRegister: "登记里没有这个 NZBN",
    status: "状态",
    registered: "已登记",
    removed: "已注销",
    tradingNames: "商号",
    list: (names: readonly string[]) => names.join("、"),
  },
  applicant: {
    heading: "雇主填的",
    company: "公司名",
    contact: "联系人",
    contactWithRole: (name: string, role: string) => `${name}（${role}）`,
    phone: "公司电话",
    website: "网站",
    notGiven: "没有填",
  },
  checklist: "核对清单",
  optional: "（选填）",
  noteLabel: (item: string) => `${item}的备注`,
  notePlaceholder: "备注（选填）",
  approve: "通过",
  reject: "驳回",
  unchecked: (items: readonly string[]) => `还没打勾：${items.join("、")}`,
  rejectLegend: "驳回理由（雇主会看到）",
  rejectNote: "说明",
  confirmReject: "确定驳回",
  errors: {
    gone: "这份申请已经处理过，或者不存在。",
    banned: "这家店已被封禁，不能通过验证。",
    unchecked: (items: readonly string[]) => `还有核对项没打勾：${items.join("、")}。`,
  },
  // What the log keeps with the decision: the badge and NZBN, or the reason and the moderator's note.
  logApproved: (badge: string, nzbn: string) => `${badge}，NZBN ${nzbn}`,
  logRejected: (reason: string, note: string) => `${reason}：${note}`,
};

export const adminVerificationMessages: Dictionary<typeof adminVerificationZh> = {
  key: "adminVerification",
  zh: adminVerificationZh,
};
