// Pushes one message to PushPlus (WeChat). Reads the title from argv, the body from stdin.
//
//   printf '%s' "$body" | node scripts/notify-pushplus.mjs "观测台 · 新模型"
//
// No token, no message, no failure. Same contract as the Artificial Analysis source: an absent
// credential means this step has nothing to say, not that the job is broken. The daily workflow
// must never go red because a notification channel was not configured — the finding it was
// reporting is still in the issue and in the step summary.
//
// It also never fails the caller on a delivery error. A push that does not arrive is a real
// problem, but it is not a reason to fail a job whose actual work already succeeded; it is
// printed as a workflow warning instead. The heartbeat is what makes silence diagnosable:
// if the weekly "nothing new" message stops arriving, the channel is down, not the upstream.

const TOKEN = process.env.PUSHPLUS_TOKEN;
const title = process.argv[2] ?? "AI Model Observatory";

const body = await new Promise((resolve) => {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { buffer += chunk; });
  process.stdin.on("end", () => resolve(buffer.trim()));
});

if (!TOKEN) {
  console.log("PUSHPLUS_TOKEN is not set; skipping the WeChat push (the report is in the issue).");
  process.exit(0);
}
if (!body) {
  console.log("Nothing to push.");
  process.exit(0);
}

// PushPlus caps a message body; a gap report can be far longer than that, and a truncated
// message that does not say it was truncated reads as a complete one.
const LIMIT = 4000;
const content = body.length > LIMIT
  ? `${body.slice(0, LIMIT)}\n\n…以下省略 ${body.length - LIMIT} 字,完整报告见 GitHub issue。`
  : body;

try {
  const response = await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: TOKEN, title, content, template: "markdown" }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.code !== 200) {
    console.log(`::warning::PushPlus rejected the message: ${response.status} ${JSON.stringify(result)}`);
    process.exit(0);
  }
  console.log(`Pushed to WeChat: ${title}`);
} catch (error) {
  console.log(`::warning::PushPlus unreachable: ${error.message}`);
}
