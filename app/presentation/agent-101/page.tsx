import type { Metadata } from "next";
import Agent101Experience from "./experience";

export const metadata: Metadata = {
  title: "AI Agent × 数学建模 — Quark Space",
  description: "从模型、API、Tool Calling 到 Agent、Skill、MCP，再把它们拼成数学建模比赛工作流。",
};

export default function Agent101Page() {
  return <Agent101Experience />;
}
