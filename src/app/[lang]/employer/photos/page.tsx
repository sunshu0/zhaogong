import type { Metadata } from "next";
import { CompanyPhotos } from "@/components/employer/CompanyPhotos";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await messages(employerPhotosMessages)).page;
  return { title: t.title, description: t.description };
}

export default function PhotosPage() {
  return <CompanyPhotos />;
}
