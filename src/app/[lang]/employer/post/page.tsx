import type { Metadata } from "next";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { PostFlow } from "@/components/employer/PostFlow";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await messages(employerPostMessages);
  return { title: pages.postTitle, description: pages.postDescription };
}

export default function PostPage() {
  return <PostFlow country={DEFAULT_COUNTRY} />;
}
