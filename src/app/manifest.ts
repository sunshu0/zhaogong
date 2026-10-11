import type { MetadataRoute } from "next";
import { PRODUCT_NAME } from "@/i18n/labels";

// Colours repeat the tokens in globals.css (--brand, --background); manifest.test.ts keeps them in step.
// Icons in public/icons/ were rendered from a white 找 (Microsoft YaHei Bold) on the brand colour.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT_NAME} · 奥克兰中文工作`,
    short_name: PRODUCT_NAME,
    description: "奥克兰的中文工作信息：时薪、地区、签证要求一目了然，雇主经过验证。",
    lang: "zh-CN",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#0f766e",
    background_color: "#f7f7f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
