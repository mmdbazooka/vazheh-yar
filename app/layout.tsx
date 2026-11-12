import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";

export const metadata: Metadata = {
  title: "واژه‌یار | تمرین واژگان انگلیسی",
  description: "فلش‌کارت، تمرین واژگان و مرور فاصله‌دار انگلیسی و فارسی",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: 'try{var t=JSON.parse(localStorage.getItem("vazheyar.v1")||"null")?.theme;document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch{}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
