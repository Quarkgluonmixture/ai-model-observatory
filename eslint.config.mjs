import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party build artifact, not source: `public/deepseek/game.js` is an esbuild bundle
    // produced by another repository and copied in whole. Measured with `--no-ignore`, linting it
    // emits 627 warnings and 0 errors — so it would not have failed the job, it would have buried
    // every real warning under a minified file nothing here can edit.
    "public/deepseek/**",
  ]),
]);

export default eslintConfig;
