import type { Dictionary } from "@/i18n/messages";
const pushZh = {
  title: "网页消息提醒",
  detail: "新聊天消息可显示在系统通知中，只提醒有新消息，不显示正文或联系方式。仅对当前浏览器和身份开启。",
  enable: "开启当前身份的提醒",
  disable: "关闭此浏览器提醒",
  working: "正在处理…",
  checking: "正在检查提醒设置…",
  enabled: "此浏览器已开启当前身份的提醒。",
  disabled: "此浏览器尚未开启当前身份的提醒。",
  unavailable: "网页提醒暂未开放，你仍可在站内查看消息。",
  unsupported: "此浏览器暂不支持网页推送。iPhone／iPad请先添加到主屏幕，再从主屏幕打开。",
  coordination: "此浏览器无法安全协调多个页面的推送设置，暂不能开启。你仍可关闭本次登录的站点提醒。",
  denied: "系统已禁止通知。请在浏览器或系统设置中允许后重试。",
  failed: "操作没有完成，请检查网络后重试。",
  closeFailed: "网站提醒已关闭，但浏览器取消订阅失败，请在浏览器设置中关闭通知。",
  browserCloseNeeded: "已停止本次登录的站点推送。请到浏览器或系统设置中关闭通知，完成此浏览器的取消。",
  note: "需浏览器和系统允许，可能延迟或无法送达。退出登录后停止；切换身份后暂停原身份的提醒。",
  roleHint: "这条提醒属于另一个身份。请在上方切换身份后，到消息中查看。",
};
export const pushMessages: Dictionary<typeof pushZh> = { key: "push", zh: pushZh };
