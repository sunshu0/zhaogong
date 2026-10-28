import type { Messages } from "@/i18n/messages";
import type { pushMessages } from "../push";
export const pushEn: Messages<(typeof pushMessages)["zh"]> = {
  title: "Browser message alerts",
  detail: "Show a system notification for new chat messages, without message text or contact details. Enabled only for this browser and identity.",
  enable: "Enable alerts for this identity", disable: "Turn off browser alerts", working: "Working…", checking: "Checking alert settings…",
  enabled: "Alerts are enabled for this browser and identity.", disabled: "Alerts are not enabled for this browser and identity.",
  unavailable: "Browser alerts are not available yet. You can still read messages on the site.",
  unsupported: "This browser does not support web push here. On iPhone or iPad, add the site to your Home Screen and open it from there first.",
  denied: "Notifications are blocked. Allow them in your browser or system settings, then try again.",
  failed: "The change did not finish. Check your connection and try again.", closeFailed: "Site alerts are off, but browser unsubscription failed. Turn off notifications in your browser settings.",
  note: "Requires browser and system permission. Delivery can be delayed or unavailable. Signing out stops alerts; switching identity pauses the previous identity's alerts.",
  roleHint: "This alert belongs to another identity. Switch identity above, then open Messages.",
};
