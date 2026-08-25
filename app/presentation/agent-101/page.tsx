import type { Metadata } from "next";
import Agent101Experience from "./experience";

export const metadata: Metadata = {
  title: "AI Agent × 数学建模 — Quark Space",
  description: "用可视化把 API Key、Agent、Skill、MCP 和数学建模里的实际用法真正讲明白。",
};

export default function Agent101Page() {
  return <Agent101Experience />;
}
