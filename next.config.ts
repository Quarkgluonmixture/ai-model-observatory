import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `/deepseek` is a static game (`public/deepseek/`), not a Next route. Next serves files from
  // `public/` by exact path only: it does not resolve a directory to its `index.html`, so measured
  // against a local production build `/deepseek` answered 404 and `/deepseek/` answered 308 into
  // that same 404. Only `/deepseek/index.html` worked.
  //
  // The redirect points at the file rather than rewriting the directory, because the game's asset
  // paths are all relative (`game.js`, `icons/…`, `./sw.js`) — they resolve correctly under
  // `/deepseek/index.html` and would break one directory up under a bare `/deepseek`. Landing on
  // the real file URL also keeps the service worker's scope (`/deepseek/`) covering the page that
  // registers it, which is what makes the offline/PWA path work.
  //
  // 307, not 308: the shareable URL is `/deepseek`, and a permanent redirect would be cached in
  // every phone that ever opened it, making the shape of this route impossible to change later.
  async redirects() {
    return [{ source: "/deepseek", destination: "/deepseek/index.html", permanent: false }];
  },
};

export default nextConfig;
