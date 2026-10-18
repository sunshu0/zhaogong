import type { Metadata } from "next";
import { VerifyBusiness } from "@/components/employer/VerifyBusiness";

export const metadata: Metadata = {
  title: "企业验证",
  description: "用公司名称或 NZBN 核对新西兰企业登记，职位显示「已验证企业」标识。",
};

export default function VerifyPage() {
  return <VerifyBusiness />;
}
