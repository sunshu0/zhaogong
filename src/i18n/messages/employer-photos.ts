// F8 (ADR 0052): 企业主页的门店照片和福利. Covers /employer/photos (components/employer/CompanyPhotos.tsx), the photo
// strip and benefits on the public page (components/seeker/EmployerPublicPage.tsx), the moderators' 门店照片 queue
// (app/admin/_components/PhotoQueue.tsx) and app/employer/photo-notifications.ts.
import type { Dictionary } from "@/i18n/messages";

const employerPhotosZh = {
  page: {
    title: "门店照片和福利",
    description: "上传门店照片、勾选福利，审核通过后显示在企业主页上。",
    viewPage: "看企业主页",
  },

  /** CompanyPhotos.tsx: the photos part. */
  photos: {
    heading: "门店照片",
    intro: "最多 6 张，审核员看过才会公开。照片里不要有电话、微信、二维码，也不要拍到能认出的顾客或员工。",
    count: (n: number, max: number) => `${n} / ${max} 张`,
    choose: "选择照片",
    uploading: "正在上传…",
    uploaded: "已上传，等审核员看过就会公开。",
    pending: "等待审核",
    approved: "已公开",
    rejected: (reason: string) => `被退回：${reason}`,
    remove: "删除",
    removeLabel: (n: number) => `删除第 ${n} 张照片`,
    confirmRemove: "确认删除",
    confirmRemoveLabel: (n: number) => `确认删除第 ${n} 张照片`,
    cancel: "取消",
    removed: "照片已删除。",
    photoAlt: (n: number) => `第 ${n} 张门店照片`,
    empty: "还没有门店照片。",
    noBusiness: "需要先开通雇主身份、填好企业资料，才能上传门店照片。",
    notAdmin: "只有团队管理员能上传或删除门店照片、修改福利。",
    full: "已经有 6 张了：删掉一张再上传。",
    tooMany: "今天上传的照片太多了，请明天再试。",
    tooBig: "这张照片太大了，换一张小一点的试试。",
    notImage: "只能上传 JPG、PNG 或 WebP 图片。",
    cutImage: "这张图片不完整，请重新保存后再上传。",
    failed: "上传没有成功，请再试一次。",
  },

  /** CompanyPhotos.tsx: the benefits part. */
  benefits: {
    heading: "福利",
    hint: "勾选你们店真的有的。法律规定人人都有的（带薪年假、KiwiSaver 等）不用勾。",
    save: "保存福利",
    saved: "福利已保存。",
    failed: "没有保存成功，请再试一次。",
    labels: {
      meals: "包餐",
      housing: "包住",
      tips: "小费分给员工",
      staff_discount: "员工折扣",
      paid_training: "带薪培训",
      flexible_shifts: "灵活排班",
      transport: "交通补贴",
      bonus: "节日红包 / 奖金",
    },
  },

  /** company-photos.ts PHOTO_REJECT_REASONS: what the business reads when a photo is sent back. */
  rejectReasons: {
    contact: "照片里有电话、微信、二维码等联系方式",
    faces: "能认出顾客或员工的脸",
    unrelated: "和门店无关",
    unclear: "看不清",
    inappropriate: "内容不合适",
  },

  /** EmployerPublicPage.tsx */
  public: {
    photosHeading: "门店照片",
    photoAlt: (name: string, n: number) => `${name} 的门店照片 ${n}`,
    benefitsHeading: "福利",
    addPhotos: "上传门店照片和福利",
  },

  /** PhotoQueue.tsx in /admin. */
  admin: {
    tab: "门店照片",
    card: (shop: string) => `门店照片：${shop}`,
    uploaded: (time: string) => `${time}上传`,
    approve: "通过",
    reject: "退回",
    reason: "退回理由",
    choose: "选择理由",
    noReason: "请选择退回理由。",
    photoAlt: (shop: string) => `${shop} 上传的门店照片`,
    // The words LoadFailed puts before 没取到.
    listName: "待审核的门店照片",
    empty: "没有等待审核的门店照片。",
    gone: "这张照片已经处理过或被删除了。",
  },

  /** photo-notifications.ts */
  notifications: {
    type: "门店照片",
    rejectedTitle: "有一张门店照片被退回",
    rejectedDetail: (reason: string) => `${reason}。删掉它，换一张再传。`,
  },
};

export const employerPhotosMessages: Dictionary<typeof employerPhotosZh> = {
  key: "employerPhotos",
  zh: employerPhotosZh,
};
