import { notFound } from "next/navigation";

/**
 * Any address with no page (Round 20, ADR 0023 §2): with the pages under app/[lang], an unknown address reaches
 * here and shows [lang]/not-found.tsx, the 404 card in the page's language, like the pages that are there.
 */
export default function Missing() {
  notFound();
}
