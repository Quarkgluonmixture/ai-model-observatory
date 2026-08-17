import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Persona Lab — quarkspace",
  description: "用 Qwen 生成 Encode Persona 候选，并直接运行可复现的角色探针实验。",
};

export default function PersonaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
