import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kisho-bot | 和歌山みかん気象",
  description: "気象庁アメダスの川辺・湯浅の気温と降水量を確認する気象アプリ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
