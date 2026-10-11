import type { Metadata } from "next";
import { MePage } from "@/components/seeker/MePage";

export const metadata: Metadata = { title: "我的", robots: { index: false } };

export default function Me() {
  return (
    <>
      <h1 className="mb-3 text-lg font-semibold">我的</h1>
      <MePage />
    </>
  );
}
