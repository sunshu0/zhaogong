import type { Metadata } from "next";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { PostFlow } from "@/components/employer/PostFlow";

export const metadata: Metadata = {
  title: "发布招聘",
  description: "粘贴招聘消息，自动整理成中英文职位，发布前检查是否合规。",
};

export default function PostPage() {
  return <PostFlow country={DEFAULT_COUNTRY} />;
}
