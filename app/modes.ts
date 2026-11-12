import { AudioLines, Blend, BookOpen, CircleHelp, Keyboard, Layers3 } from "lucide-react";
import type { Mode } from "../lib/study";

export const modes = {
  smart: { title: "مرور ترکیبی", description: "ترکیبی از فلش‌کارت، تست و تایپ", icon: BookOpen, tone: "green" },
  flash: { title: "فلش‌کارت", description: "اول از حافظه بگو، بعد جواب را ببین", icon: Layers3, tone: "green" },
  choice: { title: "تست دوطرفه", description: "معادل درست را از میان گزینه‌ها پیدا کن", icon: CircleHelp, tone: "blue" },
  type: { title: "تایپ جواب", description: "معنی فارسی یا واژهٔ انگلیسی را بنویس", icon: Keyboard, tone: "purple" },
  listen: { title: "دیکتهٔ شنیداری", description: "تلفظ را بشنو و کلمه را تایپ کن", icon: AudioLines, tone: "peach" },
  match: { title: "جفت‌کردن واژه‌ها", description: "هر واژه را به معنی‌اش وصل کن", icon: Blend, tone: "blue" },
} as const satisfies Record<Mode, { title: string; description: string; icon: typeof BookOpen; tone: string }>;
