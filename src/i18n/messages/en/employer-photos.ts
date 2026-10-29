// The English side of employer-photos.ts (F8, ADR 0052): the browser loads it on English pages only
// (src/i18n/english.ts). Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { employerPhotosMessages } from "@/i18n/messages/employer-photos";

export const employerPhotosEn: Messages<(typeof employerPhotosMessages)["zh"]> = {
  page: {
    title: "Shop photos and benefits",
    description: "Upload photos of your shop and tick your benefits; they show on your business page once approved.",
    viewPage: "View business page",
  },

  photos: {
    heading: "Shop photos",
    intro:
      "Up to 6. A moderator looks at each before it is public. Leave out phone numbers, WeChat, QR codes, and customers or staff who could be recognised.",
    count: (n, max) => `${n} / ${max} photos`,
    choose: "Choose photos",
    uploading: "Uploading…",
    uploaded: "Uploaded. It goes public once a moderator has looked at it.",
    pending: "Waiting for review",
    approved: "Public",
    rejected: (reason) => `Sent back: ${reason}`,
    remove: "Delete",
    removeLabel: (n) => `Delete photo ${n}`,
    removed: "Photo deleted.",
    photoAlt: (n) => `Shop photo ${n}`,
    empty: "No shop photos yet.",
    notAdmin: "Only a team admin can upload or delete shop photos and change benefits.",
    full: "You already have 6: delete one to upload another.",
    tooMany: "Too many photos uploaded today. Please try again tomorrow.",
    tooBig: "This photo is too large. Try a smaller one.",
    notImage: "Only JPG, PNG or WebP images can be uploaded.",
    cutImage: "This image is incomplete. Save it again, then upload it.",
    failed: "The upload didn't work. Please try again.",
  },

  benefits: {
    heading: "Benefits",
    hint: "Tick what your shop really offers. Leave out what the law gives everyone (paid annual leave, KiwiSaver and so on).",
    save: "Save benefits",
    saved: "Benefits saved.",
    failed: "That didn't save. Please try again.",
    labels: {
      meals: "Meals",
      housing: "Accommodation",
      tips: "Tips shared with staff",
      staff_discount: "Staff discount",
      paid_training: "Paid training",
      flexible_shifts: "Flexible shifts",
      transport: "Transport allowance",
      bonus: "Holiday bonus",
    },
  },

  rejectReasons: {
    contact: "It shows contact details such as a phone number, WeChat or a QR code",
    faces: "Customers or staff can be recognised",
    unrelated: "It isn't about the shop",
    unclear: "It's hard to see",
    inappropriate: "The content isn't suitable",
  },

  public: {
    photosHeading: "Shop photos",
    photoAlt: (name, n) => `Shop photo ${n} of ${name}`,
    benefitsHeading: "Benefits",
    addPhotos: "Add shop photos and benefits",
  },

  admin: {
    tab: "Shop photos",
    card: (shop) => `Shop photo: ${shop}`,
    uploaded: (time) => `Uploaded ${time}`,
    approve: "Approve",
    reject: "Send back",
    reason: "Reason",
    choose: "Choose a reason",
    noReason: "Choose a reason for sending it back.",
    photoAlt: (shop) => `Shop photo uploaded by ${shop}`,
    listName: "shop photos waiting for review",
    empty: "No shop photos waiting for review.",
    gone: "This photo has already been handled or deleted.",
  },

  notifications: {
    type: "Shop photo",
    rejectedTitle: "A shop photo was sent back",
    rejectedDetail: (reason) => `${reason}. Delete it and upload another.`,
  },
};
