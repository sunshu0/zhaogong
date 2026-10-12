// Pieces of the landing page that are not markup. Everything said here must be true of the product today.

/** 1234 → "1,234". Counts are shown exactly as counted, never rounded up. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("zh-CN").format(n);
}

/** 我们的定位: what the product does now, in a line each. */
export const POSITIONING = [
  { title: "中文为主", text: "全中文页面，职位标题和描述中英文对照，不用猜英文。" },
  { title: "发布前查合规", text: "时薪不能低于最低工资；押金、介绍费、包签、限华人等说法会被拦下或要求修改。" },
  { title: "雇主可信", text: "核对过企业登记的雇主带认证标志；联系方式登录后才显示；每个职位都能举报，有人审核。" },
  { title: "对求职者免费", text: "浏览职位、注册、查看雇主联系方式，都不收费。" },
];
