# Site Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Act on the 41 verified findings of the 2026-09-16 audit of rivnay.northwestern.edu: restore the old Squarespace URLs, fix the measured layout, behaviour, performance and content defects, then add the small navigation and presentation enhancements, all without changing the design decisions John and Jonathan have already made.

**Architecture:** The site is a plain Jekyll build on GitHub Pages (one stylesheet, one deferred script, content in `_data/` and `_posts/`). Every task edits the existing files in place and verifies the result by building, serving `_site/` locally and measuring the rendered page in headless Chrome with `scripts/shot.mjs` (added in Task 0). No framework, no build tooling, no new third-party script; the three new plugins are all on the GitHub Pages whitelist.

**Tech Stack:** Jekyll 4.4 locally (`/opt/homebrew/lib/ruby/gems/4.0.0/bin/jekyll`), Jekyll 3.10 on GitHub Pages, Liquid, plain CSS and ES5 JavaScript, Python 3 with Pillow for image steps, Node 24 (`~/.nvm/versions/node/v24.13.1/bin/node`) plus Google Chrome for the measuring harness.

**Spec:** `docs/superpowers/specs/2026-09-16-site-audit.md` (the findings, evidence and verifier corrections; each task names the finding it closes as C*n* or I*n*).

## Status

All 22 tasks are merged and live (2026-09-17).

Still open, none of them blocking:

- An email address for Rhea William, whose opened card shows no contact.
- Alumni `now:` for Lucia Galindo (2026) and Boyuan Sun (2022), which render as blank cells.
- The MRSEC cell: the file is an unlabelled icon and the MRSEC site publishes no lockup, so it needs
  a file from their office or a decision to drop the cell.
- DARPA and AFOSR logos, both outside their agencies' published usage policies.
- An Elsevier reader token was scrubbed from `docs/superpowers/specs/copy-fixes.md` but remains in
  git history on a public repo, so treat it as exposed.

## Global Constraints

- Owner decisions stand. Never reintroduce anything the spec's "Refuted" section or the memory notes record as rejected: no eyebrow labels, no label that repeats a heading, no `max-width` on body copy, no hero buttons/tagline/pause control, no purple or lavender footer, no circles for headshots, no role on a closed team card, no Alumni item in the nav, no sticky-pinned team photo, the `doi:` line stays. The group is the "Rivnay Group", never "Rivnay Lab" (the wordmark image is the one exception).
- Figtree only; 12px radius on every image; neutral grey footer `#E9E9E9`; Northwestern purple `#4E2A84`.
- Every asset URL keeps its `?v={{ site.time }}` query.
- Tasks are ordered by impact and share `assets/css/style.css`, `assets/js/site.js` and `_layouts/default.html`; run them **in order, one at a time**, committing after each. Line numbers quoted below are from the audit-day files; earlier tasks shift them, so locate the quoted text rather than the number.
- Before every commit: `jekyll build` succeeds and `python3 scripts/check_links.py` prints no `broken:` lines.
- Do not run `scripts/publications.py` except in Task 20 (it rewrites `_data/publications.json` from OpenAlex).
- Commit messages: imperative, one line, no prefix tags (match `git log`). The commit commands below show the title only; add the trailer as a second message: `-m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`.
- Do not push. John reviews and pushes; GitHub Pages caches HTML for 10 minutes after a push.

### Shell setup used by every task

```bash
cd the repo root
export PATH=""$(dirname "$(which node)")":$PATH"
JEKYLL=/opt/homebrew/lib/ruby/gems/4.0.0/bin/jekyll
$JEKYLL build
# serve the build once, in the background, for the whole session
(cd _site && nohup python3 -m http.server 4002 --bind 127.0.0.1 > /dev/null 2>&1 &)
```

The server serves whatever is in `_site/`, so re-run `$JEKYLL build` after every edit and before every measurement. Measure with `node scripts/shot.mjs <url> [flags]` (Task 0 adds it; flags are documented in its header). `--eval` takes the body of an async function and prints its return value as JSON. `--mobile` emulates a phone viewport, `--touch` makes `(pointer: coarse)` match, `--reduce` sets `prefers-reduced-motion`, `--full --shot out.png` writes a full-page screenshot you can open with the Read tool.

---

### Task 0: Measuring harness and scratch-file cleanup (C20, enabler for every other task)

**Files:**
- Create: `scripts/shot.mjs`
- Delete: `cdp5.mjs`, `assets/img/rivnay_logos.zip`, `assets/img/logos.zip` (untracked)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `node scripts/shot.mjs <url> [--width W] [--height H] [--mobile] [--touch] [--dark] [--reduce] [--scroll N] [--click "css"] [--wait ms] [--eval "js"] [--full] [--shot out.png]`, used by every later task.

- [ ] **Step 1: Write the harness**

```javascript
#!/usr/bin/env node
// Headless-Chrome harness for measuring the local build of the Rivnay Group site.
//   node scripts/shot.mjs <url> [--width 1440] [--height 900] [--mobile] [--touch] [--dark] [--reduce]
//                         [--settle] [--scroll N] [--click "css"] [--wait ms] [--eval "js"]
//                         [--full] [--shot out.png] [--allow-error] [--nojs] [--timeout 15000]
//                         [--max-runtime 60000]
// A whole run is bounded by --max-runtime (plus any --wait): a wedged CDP call once hung this script for
// five and a half hours holding a browser open, so the watchdog kills the browser and exits 124.
// --nojs loads the page with JavaScript disabled, to check what a scripts-off visitor really gets.
// Removing the "js" class by hand is NOT equivalent: it runs after the scripts have already run.
// --eval runs the body of an async function after load + fonts.ready and prints the return value as JSON.
// --full scrolls the whole page first (the scroll reveal is one-shot and would otherwise capture blank),
// then captures everything; without it the capture is the viewport as a visitor sees it.
// --settle does that reveal pass BEFORE --click/--eval: below-the-fold .reveal elements otherwise sit at
// opacity 0 and 16px low, so measure them with --settle or your geometry is off by the reveal transform.
// A failed navigation, an HTTP status >= 400 or a load that never fires is an error, not a silent
// measurement of an error page (--allow-error measures it anyway). Chrome and its profile dir are always
// cleaned up, including on failure. Chrome's plain --screenshot ignores widths under ~500px, hence this.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const url = argv[0];
if (!url || url.startsWith("--")) { console.error("usage: shot.mjs <url> [flags]"); process.exit(2); }
const has = (k) => argv.includes(k);
const opt = (k, d) => {
  const i = argv.indexOf(k);
  if (i < 0) return d;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) { console.error(`${k} needs a value`); process.exit(2); }
  return v;
};
const num = (k, d) => { const v = +opt(k, d); if (Number.isNaN(v)) { console.error(`${k} needs a number`); process.exit(2); } return v; };
const width = num("--width", 1440), height = num("--height", 900), timeout = num("--timeout", 15000);
const maxRuntime = num("--max-runtime", 60000) + num("--wait", 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), "shot-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${dir}`, "--remote-debugging-port=0", `--window-size=${width},${height}`,
  ...(has("--nojs") ? ["--blink-settings=scriptEnabled=false"] : []),
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let sock;
/* hard stop: nothing below may run unbounded, and the browser must never outlive this process */
const watchdog = setTimeout(function () {
  console.error(`shot.mjs: exceeded ${maxRuntime} ms, aborting (${url})`);
  try { if (sock) sock.close(); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
  process.exit(124);
}, maxRuntime);
try {
  let ws;
  for (let i = 0; i < 100 && !ws; i++) {
    await sleep(100);
    const f = join(dir, "DevToolsActivePort");
    if (existsSync(f)) {
      const [port] = readFileSync(f, "utf8").split("\n");
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null);
      const page = list && list.find((t) => t.type === "page");
      if (page) ws = page.webSocketDebuggerUrl;
    }
  }
  if (!ws) throw new Error("Chrome did not start");

  sock = new WebSocket(ws);
  await new Promise((r) => (sock.onopen = r));
  let id = 0; const waiting = new Map(); const events = [];
  sock.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    /* a CDP call that never answers (an awaitPromise on a promise that never settles, say) would
       otherwise wedge the whole run */
    const t = setTimeout(() => { waiting.delete(n); rej(new Error(`CDP ${method} timed out after ${timeout} ms`)); }, timeout);
    waiting.set(n, (m) => { clearTimeout(t); m.error ? rej(new Error(m.error.message)) : res(m.result); });
    sock.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  };
  const scrollTo = (y) => evaluate(`window.scrollTo({ top: ${y}, behavior: "instant" }); true`);   // site.js turns smooth scrolling on after load
  const settle = () => evaluate("document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible', 'no-anim')); true");

  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: has("--mobile") });
  if (has("--touch")) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const features = [];
  if (has("--dark")) features.push({ name: "prefers-color-scheme", value: "dark" });
  if (has("--reduce")) features.push({ name: "prefers-reduced-motion", value: "reduce" });
  if (features.length) await send("Emulation.setEmulatedMedia", { features });

  const nav = await send("Page.navigate", { url });
  if (nav.errorText) throw new Error(`navigation failed: ${nav.errorText} (${url})`);
  const deadline = Date.now() + timeout;
  while (!events.some((e) => e.method === "Page.loadEventFired")) {
    if (Date.now() > deadline) throw new Error(`load event never fired within ${timeout} ms (${url})`);
    await sleep(50);
  }
  if (!has("--allow-error")) {
    const doc = events.filter((e) => e.method === "Network.responseReceived" && e.params.type === "Document").pop();
    const status = doc && doc.params.response.status;
    if (status >= 400) throw new Error(`HTTP ${status} (${url}) — did you forget to rebuild, or mistype the path?`);
    const href = await evaluate("location.href");
    if (!href || href.startsWith("chrome-error://")) throw new Error(`page did not load (${url})`);
  }
  /* document.fonts.ready never settles when page scripts are disabled, and awaiting it there wedged this
     script for hours, so in that mode poll the status from here instead, where each call is bounded */
  if (has("--nojs")) {
    for (let i = 0; i < 40; i++) {
      if (await evaluate("document.fonts ? document.fonts.status : 'loaded'") === "loaded") break;
      await sleep(100);
    }
  } else {
    await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
  }
  await sleep(400);

  const scroll = has("--scroll") ? num("--scroll", 0) : null;
  if (has("--settle")) { await settle(); await sleep(100); }
  if (scroll !== null) { await scrollTo(scroll); await sleep(500); }
  const click = has("--click") ? opt("--click") : null;
  if (click) { await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(click)}); if (!e) throw new Error("no match for " + ${JSON.stringify(click)}); e.click(); return true; })()`); await sleep(500); }
  const wait = num("--wait", 0); if (wait) await sleep(wait);

  const code = has("--eval") ? opt("--eval") : null;
  if (code) { const v = await evaluate(`(async () => { ${code} })()`); console.log(JSON.stringify(v === undefined ? null : v, null, 1)); }

  const shot = has("--shot") ? opt("--shot") : null;
  if (shot) {
    let params = { format: "png" };
    if (has("--full")) {
      const total = await evaluate("document.documentElement.scrollHeight");
      for (let y = 0; y < total; y += Math.floor(height * 0.5)) { await scrollTo(y); await sleep(200); }
      await settle();
      await scrollTo(scroll !== null ? scroll : 0);
      await sleep(700);
      const h = await evaluate("Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))");
      params = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } };
    }
    const { data } = await send("Page.captureScreenshot", params);
    writeFileSync(shot, Buffer.from(data, "base64"));
    console.error("wrote", shot);
  }
} finally {
  clearTimeout(watchdog);
  try { if (sock) sock.close(); } catch {}
  chrome.kill();
  /* wait for it to actually exit: kill() only sends the signal, and a Chrome still shutting down
     writes its profile back over a directory we have already deleted */
  await new Promise((r) => { chrome.once("exit", r); setTimeout(r, 3000); });
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
```

- [ ] **Step 2: Prove it emulates a phone and touch**

Run (after the shell setup above, with the server running):
```bash
node --check scripts/shot.mjs && node scripts/shot.mjs http://127.0.0.1:4002/ --width 390 --height 844 --mobile --touch --eval "return { w: innerWidth, coarse: matchMedia('(pointer: coarse)').matches, fonts: document.fonts.check('700 1em Figtree') }"
```
Expected: `{"w": 390, "coarse": true, "fonts": true}`. If `coarse` is false, keep the flag anyway (Task 16 then verifies its CSS by reading the rules rather than by emulation) and note it in the commit message.

Then prove it fails loudly rather than measuring an error page, because every later task's "Expected:" gates on this tool:
```bash
node scripts/shot.mjs http://127.0.0.1:4002/does-not-exist/ --eval "return document.title"; echo "exit=$?"
node scripts/shot.mjs http://127.0.0.1:9999/ --eval "return 1"; echo "exit=$?"
node scripts/shot.mjs http://127.0.0.1:4002/ --full --shot; echo "exit=$?"
```
Expected: `HTTP 404`, then `navigation failed: net::ERR_CONNECTION_REFUSED`, then `--shot needs a value`, each with a non-zero exit. And prove it does not litter: record `ls -d "$TMPDIR"shot-* | wc -l`, run a failing and a passing invocation, and confirm the count is unchanged (the predecessor harness left 1203 profile directories and 219 stray Chrome processes, 10 GB, before this was fixed).

One behaviour to know before writing any measurement: below-the-fold elements carrying `.reveal` sit at `opacity: 0` and 16px low until the scroll reveal fires, so `getBoundingClientRect()` on them is 16px off. Pass `--settle` whenever you measure a `.reveal` element (the team cards are `details.person reveal`); `--full` screenshots settle on their own.

- [ ] **Step 3: Remove the scratch files and stop them coming back**

```bash
git rm cdp5.mjs assets/img/rivnay_logos.zip
rm -f assets/img/logos.zip
printf '*.zip\n__MACOSX/\n' >> .gitignore
$JEKYLL build && ls _site/cdp5.mjs _site/assets/img/*.zip 2>&1
```
Expected: the `ls` reports `No such file or directory` for all three.

- [ ] **Step 4: Commit**

```bash
git add scripts/shot.mjs .gitignore
git commit -m "Add the headless measuring harness; drop the scratch files that shipped in the build"
```

---

### Task 1: Redirect every old Squarespace URL (C1, high)

**Files:**
- Create: `scripts/old-site-sitemap.xml`, `scripts/redirects.py`
- Modify: `_config.yml`, every `_posts/*.md` that had an old URL (61 files), `index.html`, `research.html`, `team.html`, `publications.html`, `news.html`, `join.html`

**Interfaces:**
- Produces: `redirect_from:` front-matter lists consumed by the `jekyll-redirect-from` plugin, which writes a meta-refresh page with a canonical link at each old path.

- [ ] **Step 1: Install the plugin locally and save the archived sitemap**

```bash
/opt/homebrew/opt/ruby/bin/gem install jekyll-redirect-from
curl -sL "https://web.archive.org/web/20250504135022id_/https://rivnay.northwestern.edu/sitemap.xml" -o scripts/old-site-sitemap.xml
grep -c '<loc>' scripts/old-site-sitemap.xml
```
Expected: `83`. If the Wayback fetch fails, retry with `web/2025id_/` in place of the timestamp; the file must contain 61 `/new-blog/YYYY/M/D/` entries.

- [ ] **Step 2: Enable the plugin**

In `_config.yml` change
```yaml
plugins:
  - jekyll-seo-tag
```
to
```yaml
plugins:
  - jekyll-seo-tag
  - jekyll-redirect-from   # old Squarespace URLs: redirect_from lists in the posts and pages
```

- [ ] **Step 3: Write the generator**

`scripts/redirects.py`:
```python
#!/usr/bin/env python3
"""Add the old Squarespace URL of every news post to its front matter as redirect_from.

    python3 scripts/redirects.py

Reads scripts/old-site-sitemap.xml (the archived Squarespace sitemap) and, for each
/new-blog/YYYY/M/D/slug entry, finds the post whose file name minus its date is a prefix
of that slug, or an ALIASES entry for the few slugs that changed. Idempotent: a path
already present is not added twice. Prints anything it cannot map and exits 1 if any.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "_posts"
SITEMAP = ROOT / "scripts" / "old-site-sitemap.xml"

# old slug -> current post file: three renamed "rivnay-lab" slugs and one Squarespace hash
ALIASES = {
    "the-rivnay-lab-is-excited-to-finally-move-into": "2020-02-24-the-rivnay-group-is-excited-to-finally-move-into.md",
    "the-rivnay-labs-photo-was-chosen-as-the-cover-of-nature-materials-january-issue": "2019-12-19-the-rivnay-groups-photo-was-chosen-as-the-cover-of-nature.md",
    "rivnay-lab-arriving-at-nu": "2017-01-01-rivnay-group-arriving-at-nu.md",
    "jphq5nl7tddu4nkc2b08srjz1huwem": "2019-02-04-mayra-wins-third-place-in-image-contest-at-sqi.md",
}


def main():
    by_slug = {p.name[11:-3]: p.name for p in POSTS.glob("*.md")}   # strip "YYYY-MM-DD-" and ".md"
    urls = re.findall(r"<loc>https?://[^/<]+(/[^<]*)</loc>", SITEMAP.read_text(encoding="utf-8"))
    post_urls, unmapped, changed = 0, [], 0
    for url in urls:
        m = re.match(r"^/new-blog/\d{4}/\d{1,2}/\d{1,2}/([^/]+)$", url)
        if not m:
            continue
        post_urls += 1
        slug = m.group(1)
        name = ALIASES.get(slug)
        if not name:
            # The migration truncated long slugs, so a post matches when its slug starts the old one.
            # Take the LONGEST match: "welcome-new-members" and "welcome-new-members-1" are both
            # prefixes of the second URL, and only the longer one is the post it belongs to.
            cands = sorted((s for s in by_slug if slug.startswith(s)), key=len, reverse=True)
            if len(cands) > 1:
                print("ambiguous: %s -> %s (taking %s)" % (url, ", ".join(cands), cands[0]))
            name = by_slug[cands[0]] if cands else None
        if not name:
            unmapped.append(url)
            continue
        path = POSTS / name
        text = path.read_text(encoding="utf-8")
        if "  - %s\n" % url in text:   # the whole line, so a shorter URL is not "found" inside a longer one
            continue
        head, body = text.split("\n---\n", 1)
        if "\nredirect_from:" in head:
            head = head.replace("\nredirect_from:\n", "\nredirect_from:\n  - %s\n" % url, 1)
        else:
            head += "\nredirect_from:\n  - %s" % url
        path.write_text(head + "\n---\n" + body, encoding="utf-8")
        changed += 1
    print("old post urls: %d, mapped: %d, files changed: %d" % (post_urls, post_urls - len(unmapped), changed))
    for u in unmapped:
        print("UNMAPPED", u)
    return 1 if unmapped else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run it twice**

```bash
python3 scripts/redirects.py && python3 scripts/redirects.py
grep -l '^redirect_from:' _posts/*.md | wc -l
grep -A1 '^redirect_from:' _posts/2019-02-04-mayra-wins-third-place-in-image-contest-at-sqi.md
```
Expected: first run `old post urls: 61, mapped: 61, files changed: 61`, second run `files changed: 0`; the count is `61`; the Mayra post shows `  - /new-blog/2019/2/4/jphq5nl7tddu4nkc2b08srjz1huwem`. Two posts have no old URL (the two 2026 posts) and that is correct. One `ambiguous:` line is expected and correct: `/new-blog/2024/8/7/welcome-new-members-1` matches both `welcome-new-members` and `welcome-new-members-1`, and the archived bodies confirm the longer one (Yebin and Priscila) is right. If "files changed" is less than "mapped", two URLs have landed on one post: find it with `grep -c '^  - /new-blog' _posts/*.md | grep -v ':1$'` and check both against the Wayback copy before accepting it.

- [ ] **Step 5: Page redirects**

List each old path in BOTH forms, with and without a trailing slash: the plugin writes `foo.html` for `/foo` and `foo/index.html` for `/foo/`, a static host does not serve one for the other, and old links circulate both ways. (`scripts/redirects.py` does this for the posts by itself.) So `research.html` gets `/funding`, `/funding/`, `/resources`, `/resources/`, and so on for each list below:

`index.html`:
```yaml
redirect_from:
  - /home
```
`research.html`:
```yaml
redirect_from:
  - /funding
  - /resources
```
`team.html`:
```yaml
redirect_from:
  - /people-1
  - /people-1-1
  - /jonathan-rivnay
```
`publications.html`:
```yaml
redirect_from:
  - /our-publications-1
```
`join.html`:
```yaml
redirect_from:
  - /opportunities
```
`news.html`:
```yaml
redirect_from:
  - /new-blog
  - /new-blog/category/Papers
  - /new-blog/category/Publications
  - /new-blog/category/awards
  - /new-blog/category/images
  - /new-blog/tag/Awards
  - /new-blog/tag/NEWS
  - /new-blog/tag/People
  - /new-blog/tag/Publications
  - /new-blog/tag/awards
  - /new-blog/tag/bioelectronics
  - /new-blog/tag/conference
  - /new-blog/tag/papers
```

- [ ] **Step 6: Build and check the generated pages**

```bash
$JEKYLL build
ls _site/new-blog/2022/9/6/ _site/home* _site/opportunities* _site/new-blog.html 2>&1
grep -o 'url=[^"]*' _site/new-blog/2022/9/6/jonathan-promoted*.html _site/new-blog/2022/9/6/jonathan-promoted/index.html 2>/dev/null
grep -o '<link rel="canonical"[^>]*' _site/new-blog/2022/9/6/jonathan-promoted*.html _site/new-blog/2022/9/6/jonathan-promoted/index.html 2>/dev/null
python3 scripts/check_links.py
```
Expected: both `jonathan-promoted.html` and `jonathan-promoted/index.html` exist; each one's refresh `url=` and canonical point at `https://rivnay.northwestern.edu/news/2022/09/06/jonathan-promoted/`; `home.html`, `opportunities.html` and `new-blog.html` exist; the link checker prints no `broken:` lines. Count the stubs with `grep -rl "Click here if you are not redirected" _site | wc -l`: on macOS expect **162**, not the 164 the arithmetic suggests, because `/new-blog/tag/awards` and `/new-blog/tag/Awards` differ only in case and collide on a case-insensitive filesystem. Both redirect to `/news/`, so the survivor serves the right content and GitHub Pages (case-sensitive) writes all 164. Do not "fix" this locally; verify it live in Step 9. GitHub Pages serves `/foo` from `foo.html`, and 301s a bare `/foo` to `/foo/` when only a directory exists, so either output form works live. The local Python server does not do extensionless lookups, so test locally with the `.html` name.

- [ ] **Step 7: Note it in the README**

In `README.md` under the "Preview locally" heading, change the gem line to
```
gem install jekyll jekyll-seo-tag jekyll-redirect-from webrick
```
and add after the `jekyll serve` block:
```
Old Squarespace URLs redirect via `redirect_from:` in each post and page; `python3 scripts/redirects.py` regenerates the post entries from `scripts/old-site-sitemap.xml`.
```

- [ ] **Step 8: Commit**

```bash
git add _config.yml scripts/old-site-sitemap.xml scripts/redirects.py _posts index.html research.html team.html publications.html news.html join.html README.md
git commit -m "Redirect every old Squarespace URL to its new page"
```

- [ ] **Step 9: After John pushes (not part of the commit)**

Ten minutes after the push:
```bash
for u in /home /people-1 /our-publications-1 /new-blog /opportunities /funding /new-blog/2022/9/6/jonathan-promoted /new-blog/2019/2/4/jphq5nl7tddu4nkc2b08srjz1huwem; do printf '%-60s ' "$u"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://rivnay.northwestern.edu$u"; done
echo "--- the trailing-slash form, and the two case-colliding tag paths:"
for u in /new-blog/ /funding/ /new-blog/2022/9/6/jonathan-promoted/ /new-blog/tag/awards /new-blog/tag/Awards; do printf '%-60s ' "$u"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://rivnay.northwestern.edu$u"; done
```
Expected: every line `200` (the redirect page itself) or `301` to the same path with a trailing slash; none `404`. The second group is the one the local build cannot prove: the slashed forms come from the doubled entries, and the two tag paths collide on macOS but are distinct files on GitHub Pages, so this is the only place they are both checked.

---

### Task 2: Fetch the hero clip only when its turn comes (C6, med)

**Files:**
- Modify: `index.html:7`, `assets/js/site.js` (hero block, lines 20-49)

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/ --eval "const v = document.querySelector('.hero-bg'); return { src: !!v.currentSrc, ready: v.readyState, buffered: v.buffered.length ? v.buffered.end(0) : 0, preload: v.preload }"
```
Expected before the fix: `src: true, ready: 4, buffered: 5, preload: "auto"` (the whole 1.84 MB clip is fetched at load while a still covers it).

- [ ] **Step 2: Change the video element**

In `index.html` replace line 7
```html
  <video class="hero-bg" src="{{ '/assets/video/giwaxs-p3meeet.mp4' | relative_url }}" poster="{{ '/assets/img/research/giwaxs-poster.jpg' | relative_url }}" width="1030" height="1064" autoplay muted loop playsinline preload="auto" aria-hidden="true" tabindex="-1"></video>
```
with
```html
  <video class="hero-bg" data-src="{{ '/assets/video/giwaxs-p3meeet.mp4' | relative_url }}" poster="{{ '/assets/img/research/giwaxs-poster.jpg' | relative_url }}" width="1030" height="1064" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
```

- [ ] **Step 3: Change the rotation**

In `assets/js/site.js` replace the hero block (from `/* ---- home hero` to the end of the `motionQuery.addEventListener("change", ...)` call) with:
```javascript
  /* ---- home hero: the stills in order, then the clip, then back ---- */
  var hero = d.querySelector(".hero");
  var slides = hero ? [].slice.call(hero.querySelectorAll(".hero-slide")) : [];
  var clip = hero ? hero.querySelector("video[data-src]") : null;
  if (slides.length && !reduce) {
    var cur = 0, timer = 0;
    function turn() {
      cur = cur + 1 >= slides.length ? -1 : cur + 1;
      slides.forEach(function (s, k) { s.classList.toggle("is-on", k === cur); });
      if (clip) {
        /* the clip is fetched two stills ahead, so it has ~13 s to buffer 1.8 MB and does not stutter on
           a slow connection; it still costs nothing at page load, and under reduced motion or without
           script it is never fetched at all. currentTime is reset so every cycle starts from the top.
           preload goes to "auto" first: leaving it at "none" while asking the element to load makes
           Chrome fetch metadata, suspend, then resume with a range request, and that resumed transfer
           fails against jekyll serve about two times in three (MEDIA_ERR_NETWORK, a dead hero). The
           attribute stays "none" in the HTML, so a visitor who never reaches this line fetches nothing. */
        if (cur >= slides.length - 2 && !clip.getAttribute("src")) { clip.preload = "auto"; clip.src = clip.getAttribute("data-src"); clip.load(); }
        if (cur === -1) { clip.currentTime = 0; var p = clip.play(); if (p && p.catch) p.catch(function () {}); }
        else clip.pause();
      }
      timer = setTimeout(turn, cur === -1 ? 9000 : 6500);
    }
    function start() {
      if (d.hidden) { addEventListener("visibilitychange", start, { once: true }); return; }
      /* fetch the remaining stills now, and start the clock only once they are ready to paint */
      Promise.all(slides.map(function (s) {
        s.src = s.getAttribute("data-src") || s.src;
        return (s.decode ? s.decode() : Promise.resolve()).then(function () { return s; }, function () { s.remove(); return null; });
      })).then(function (ok) {
        if (motionQuery.matches) return;   /* it was switched on while the stills were decoding */
        slides = ok.filter(Boolean);
        if (slides.length) timer = setTimeout(turn, cur === -1 ? 9000 : 6500);
      });
    }
    start();
    motionQuery.addEventListener("change", function (e) {
      if (!e.matches) return;
      clearTimeout(timer); timer = 0; cur = 0;
      slides.forEach(function (s, k) { s.classList.toggle("is-on", k === 0); });
      if (clip) clip.pause();
    });
  }
```

- [ ] **Step 4: Measure the fix**

```bash
$JEKYLL build
node scripts/shot.mjs http://127.0.0.1:4002/ --eval "const v = document.querySelector('.hero-bg'); return { src: !!v.currentSrc, ready: v.readyState, preload: v.preload }"
node scripts/shot.mjs http://127.0.0.1:4002/ --reduce --wait 15000 --eval "const v = document.querySelector('.hero-bg'); return { src: !!v.currentSrc }"
node scripts/shot.mjs http://127.0.0.1:4002/ --wait 21000 --eval "const v = document.querySelector('.hero-bg'); return { src: !!v.currentSrc, paused: v.paused, time: v.currentTime, stillOn: !!document.querySelector('.hero-slide.is-on') }"
```
Run the whole set at least FIVE times, not once: the failure this catches is intermittent, and a single clean pass once hid a two-in-three failure rate. Expected: first `src: false, ready: 0, preload: "none"`; second (reduced motion, 15 s in) `src: false`; third (21 s in) `src: true, paused: false, time > 0, stillOn: false` (the clip is playing and visible). Add a fourth at `--wait 8000`: `src: true` with `fibers.jpg` on top, which is the point of the change — the clip is buffered two stills ahead rather than at page load. Two stills of lead, not one: throttled to 500 kbps a single still's 6.5 s leaves the clip stalling at `readyState` 2-3 and advancing 1.5 s of content over its whole 9 s window, while ~13 s buffers it. Check against `jekyll serve` (port 4000), not only a static file server: WEBrick exposes media-fetch bugs that `python3 -m http.server` does not, and it is what the preview uses. The Research page's own clip is untouched, but do not check it with `.paused`: it is below the fold and headless Chrome reports `paused: true` for it both before and after this change, so the only meaningful check there is that the value is the same as on the previous commit.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/js/site.js
git commit -m "Hero: fetch the GIWAXS clip only while the last still is up"
```

---

### Task 3: Real thumbnails for the news lists (C4, C9, med)

**Files:**
- Create: `scripts/thumbs.py`, 39 files `assets/img/news/*-thumb.jpg`
- Modify: `news.html:19`, `index.html:63`, `README.md`

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/news/ --eval "const im = [...document.querySelectorAll('.news-list .thumb img')]; return { n: im.length, naturalWidths: im.slice(0, 5).map(i => i.naturalWidth), tabbableThumbs: [...document.querySelectorAll('a.thumb')].filter(a => a.tabIndex >= 0).length }"
```
Expected before: natural widths of 468 to 1400 for images drawn at 104px; `tabbableThumbs: 39`.

- [ ] **Step 2: Write the thumbnail script**

`scripts/thumbs.py`:
```python
#!/usr/bin/env python3
"""Write a 208x156 thumbnail beside every news post image, as <name>-thumb.jpg.

    python3 scripts/thumbs.py

Run it after adding a post with an image, and commit the thumbnail with the post: the news list
and the home page show it at 104x78 CSS px, so 208x156 stays sharp on 2x screens. Thumbnails newer
than their source are skipped. Needs Pillow (python3 -m pip install pillow).
"""
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SIZE = (208, 156)


def main():
    made = skipped = 0
    for post in sorted((ROOT / "_posts").glob("*.md")):
        m = re.search(r"^image:\s*(\S+)", post.read_text(encoding="utf-8"), re.M)
        if not m:
            continue
        src = ROOT / m.group(1).lstrip("/")
        dst = src.with_name(src.stem + "-thumb.jpg")
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            continue
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        ImageOps.fit(im, SIZE, Image.LANCZOS).save(dst, quality=82, optimize=True, progressive=True)
        made += 1
    print("thumbnails written: %d, already current: %d" % (made, skipped))


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Generate**

```bash
python3 scripts/thumbs.py && python3 scripts/thumbs.py
ls assets/img/news/*-thumb.jpg | wc -l
du -ch assets/img/news/*-thumb.jpg | tail -1
```
Expected: `thumbnails written: 39` then `already current: 39`; count `39`; total under 500K.

- [ ] **Step 4: Use them, and take the thumbnail links out of the tab order**

`news.html` line 19 becomes:
```liquid
      {% if post.image %}<a class="thumb" href="{{ post.url | relative_url }}" tabindex="-1" aria-hidden="true"><img src="{{ post.image | replace: '.jpg', '-thumb.jpg' | relative_url }}" alt="" loading="lazy" width="104" height="78"></a>{% endif %}
```
`index.html` line 63 becomes the identical line. The title link beside it already goes to the same post, so screen readers and keyboard users lose nothing.

- [ ] **Step 5: README**

In the `README.md` table row `| Add a news post | ... |` append: ` If it has an image, run `python3 scripts/thumbs.py` afterwards and commit the `-thumb.jpg` it writes.`

- [ ] **Step 6: Measure the fix**

```bash
$JEKYLL build && python3 scripts/check_links.py
node scripts/shot.mjs http://127.0.0.1:4002/news/ --eval "const im = [...document.querySelectorAll('.news-list .thumb img')]; return { n: im.length, naturalWidths: [...new Set(im.map(i => i.naturalWidth))], tabbableThumbs: [...document.querySelectorAll('a.thumb')].filter(a => a.tabIndex >= 0).length, hidden: [...document.querySelectorAll('a.thumb')].every(a => a.getAttribute('aria-hidden') === 'true') }"
```
Expected: `naturalWidths: [208]` (loaded ones; 0 for lazy ones not yet fetched is fine), `tabbableThumbs: 0`, `hidden: true`, and the link checker prints no `broken:` lines.

- [ ] **Step 7: Commit**

```bash
git add scripts/thumbs.py assets/img/news/*-thumb.jpg news.html index.html README.md
git commit -m "News lists: 208px thumbnails instead of full post photos; thumbnail links out of the tab order"
```

---

### Task 4: Mobile menu as a real button (C3, C14, med)

**Files:**
- Modify: `_layouts/default.html:23-25`, `assets/css/style.css` (lines 140-146 and the 860px block at 154-166), `assets/js/site.js` (after `setHeaderH`)

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/research/ --width 390 --height 844 --mobile --click "label[for=nav-toggle]" --eval "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return { control: document.querySelector('#nav-toggle').tagName, expanded: document.querySelector('[aria-expanded]') ? 'has' : 'none', openAfterEscape: getComputedStyle(document.querySelector('.site-nav')).display }"
```
Expected before: `control: "INPUT", expanded: "none", openAfterEscape: "block"`.

- [ ] **Step 2: Markup**

In `_layouts/default.html` replace
```html
    <input type="checkbox" id="nav-toggle" class="nav-toggle">
    <label for="nav-toggle" class="nav-toggle-label" aria-label="Menu"><span></span></label>
    <nav class="site-nav" aria-label="Main">
```
with
```html
    <button type="button" class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="site-nav"><span></span></button>
    <nav class="site-nav" id="site-nav" aria-label="Main">
```

- [ ] **Step 3: CSS**

Replace the six lines from `.nav-toggle { display: none; }` through `.nav-toggle-label span::after { position: absolute; top: 7px; }` with:
```css
.nav-toggle { display: none; cursor: pointer; background: none; border: 0; padding: 0; color: var(--ink); }
.nav-toggle span, .nav-toggle span::before, .nav-toggle span::after {
  display: block; width: 22px; height: 2px; background: currentColor; position: relative; content: "";
}
.nav-toggle span::before { position: absolute; top: -7px; }
.nav-toggle span::after { position: absolute; top: 7px; }
```
Inside `@media (max-width: 860px) { ... }` replace the three rules `.nav-toggle { display: block; position: absolute; ... }`, `.nav-toggle:focus-visible + .nav-toggle-label { ... }` and `.nav-toggle-label { display: grid; ... }` with:
```css
  .nav-toggle { display: grid; place-items: center; min-width: 44px; min-height: 44px; margin: -0.4rem -0.7rem -0.4rem 0; }
```
and replace
```css
  .site-nav {
    position: absolute; top: 100%; left: 0; right: 0;
    background: var(--paper); border-bottom: 1px solid var(--line); display: none;
  }
  .nav-toggle:checked ~ .site-nav { display: block; }
```
with
```css
  .site-nav {
    position: absolute; top: 100%; left: 0; right: 0;
    background: var(--paper); border-bottom: 1px solid var(--line);
  }
  /* without script the menu simply stays open under the bar; with it the button opens and closes it */
  .js .site-nav { display: none; }
  .js .site-header.nav-open .site-nav { display: block; }
```

- [ ] **Step 4: Script**

In `assets/js/site.js`, after the `addEventListener("resize", setHeaderH);` line, add:
```javascript
  /* ---- mobile menu ---- */
  var toggle = d.querySelector(".nav-toggle");
  if (toggle && header) {
    var setMenu = function (open) {
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    toggle.addEventListener("click", function () { setMenu(!header.classList.contains("nav-open")); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("nav-open")) { setMenu(false); toggle.focus(); }
    });
    d.addEventListener("click", function (e) { if (!header.contains(e.target)) setMenu(false); });
    /* coming back through the back-forward cache restores the page with the menu still open */
    addEventListener("pageshow", function (e) { if (e.persisted) setMenu(false); });
  }
```

- [ ] **Step 5: Measure the fix**

```bash
$JEKYLL build
node scripts/shot.mjs http://127.0.0.1:4002/research/ --width 390 --height 844 --mobile --click ".nav-toggle" --eval "const b = document.querySelector('.nav-toggle'), n = document.querySelector('.site-nav'); const open = getComputedStyle(n).display; const exp = b.getAttribute('aria-expanded'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const afterEsc = getComputedStyle(n).display; b.click(); document.querySelector('main').click(); const afterOutside = getComputedStyle(n).display; return { tag: b.tagName, open, exp, afterEsc, afterOutside, focusBack: document.activeElement === b, size: b.getBoundingClientRect().height }"
node scripts/shot.mjs http://127.0.0.1:4002/research/ --width 1440 --height 900 --eval "return getComputedStyle(document.querySelector('.nav-toggle')).display"
```
Expected: `tag: "BUTTON", open: "block", exp: "true", afterEsc: "none", afterOutside: "none", focusBack: true, size >= 44`; desktop `"none"`. Take `--full --shot` screenshots at 390 with the menu open and compare with the previous look (same white panel, same five links, current page tinted).

- [ ] **Step 6: Commit**

```bash
git add _layouts/default.html assets/css/style.css assets/js/site.js
git commit -m "Mobile menu: a button with aria-expanded that closes on Escape, outside tap and Back"
```

---

### Task 5: Team stage that fits its screen, and no empty stage on phones (C2, C15, med)

**Files:**
- Modify: `assets/css/style.css` (team block, lines 266-278)

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/team/ --width 1280 --height 620 --eval "const r = s => document.querySelector(s).getBoundingClientRect(); return { headerBottom: r('.site-header').bottom, h1Top: r('.team-stage h1').top, imgBottom: r('.team img').bottom, captionBottom: r('.team figcaption').bottom, vh: innerHeight }"
node scripts/shot.mjs http://127.0.0.1:4002/team/ --width 390 --height 844 --mobile --eval "const r = s => document.querySelector(s).getBoundingClientRect(); return { h1Top: r('.team-stage h1').top, rosterTop: r('.roster').top, vh: innerHeight, snap: getComputedStyle(document.documentElement).scrollSnapType }"
```
Expected before: desktop `h1Top == headerBottom` (about 60) and `imgBottom` 684 and `captionBottom` 713, both past `vh` 620; phone `h1Top` about 303 and `rosterTop` 844 == `vh`, `snap: "y proximity"`.

- [ ] **Step 2: Replace the stage rules**

Replace the block from `html.snap { scroll-snap-type: y proximity; }` through `@media (prefers-reduced-motion: reduce) { html.snap { scroll-snap-type: none; } }` (keeping the comment above it) with:
```css
.team-stage { display: flex; flex-direction: column; justify-content: center; padding-bottom: 2rem; }
.team { margin: 0; }
.team img { display: block; width: auto; max-width: 100%; height: auto; margin-inline: auto; border-radius: var(--radius); }
.roster { padding-top: 1rem; }
/* From 700px the photo can fill a screen of its own: the stage takes the viewport, the photo is capped so the
   heading and caption always fit beside it (11rem = heading, its paddings, caption and stage padding), and the
   snap points apply. Below that, phones get a plain page: heading, photo, caption, roster. */
@media (min-width: 700px) {
  html.snap { scroll-snap-type: y proximity; }
  .team-stage {
    min-height: calc(100vh - var(--header-h, 61px));
    min-height: calc(100svh - var(--header-h, 61px));   /* exclude the collapsible browser chrome */
    scroll-snap-align: start; scroll-margin-top: var(--header-h, 61px);
  }
  .team-stage .page-head { padding-top: 1.5rem; }
  .team img { max-height: calc(100svh - var(--header-h, 61px) - 11rem); }
  .roster { scroll-snap-align: start; scroll-margin-top: var(--header-h, 61px); }
}
@media (prefers-reduced-motion: reduce) { html.snap { scroll-snap-type: none; } }
```

- [ ] **Step 3: Measure the fix**

Re-run both commands from Step 1 after `$JEKYLL build`, plus the desktop reference:
```bash
node scripts/shot.mjs http://127.0.0.1:4002/team/ --width 1440 --height 900 --eval "const r = s => document.querySelector(s).getBoundingClientRect(); return { imgWidth: r('.team img').width, imgLeft: r('.team img').left, rosterTop: r('.roster').top }"
```
Expected: 1280x620 `h1Top >= headerBottom + 20`, `captionBottom <= 620`; 390 mobile `h1Top` about 109 (same as other pages), `rosterTop` well under 844, `snap: "none"`; 1440x900 `imgWidth: 1072, imgLeft: 184, rosterTop: 900` (unchanged from before). If `captionBottom` still exceeds the viewport at 1280x620, raise `11rem` by the overshoot and re-measure. Also check the wheel behaviour John chose still holds at 1440x900: `--scroll 150 --wait 900 --eval "return scrollY"` → `0`, and `--scroll 900 --wait 900 --eval "return scrollY"` → `900`.

- [ ] **Step 4: Commit**

```bash
git add assets/css/style.css
git commit -m "Team: cap the photo to the stage on short screens; plain page below 700px"
```

---

### Task 6: Pre-Northwestern list loses its indent on phones (C8, med)

**Files:**
- Modify: `assets/css/style.css` (move one rule from line 385 to before line 359)

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/publications/ --width 390 --height 844 --mobile --click "details.collapsed summary" --eval "const a = document.querySelector('.pub-year .pub-list').getBoundingClientRect(), b = document.querySelector('details.collapsed .pub-list').getBoundingClientRect(); return { yearLeft: a.left, oldLeft: b.left, oldWidth: b.width }"
```
Expected before: `yearLeft: 24, oldLeft: 144, oldWidth: 222`.

- [ ] **Step 2: Move the rule**

Cut the line
```css
details.collapsed .pub-list { margin-top: 1rem; margin-left: 7.5rem; }   /* line up with the year sections above */
```
from after `details.collapsed summary { ... }` and paste it directly above the `@media (max-width: 640px) {` block that contains `details.collapsed .pub-list { margin-left: 0; }`, so the phone override comes later in the cascade and wins.

- [ ] **Step 3: Measure the fix**

Re-run Step 1 after `$JEKYLL build`. Expected: `oldLeft: 24, oldWidth: 342`. At `--width 1440 --height 900` (no `--mobile`) expect `oldLeft: 304` (the 7.5rem indent, matching the year lists).

- [ ] **Step 4: Commit**

```bash
git add assets/css/style.css
git commit -m "Publications: phone override for the pre-Northwestern indent now wins the cascade"
```

---

### Task 7: No layout shift on the Research figures (C10, med)

**Files:**
- Modify: `assets/css/style.css:405`, `research.html:27` and `research.html:71`

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/research/ --eval "return { ratio: getComputedStyle(document.querySelector('.theme figure.natural img')).aspectRatio, shifts: (() => { const s = []; new PerformanceObserver(l => l.getEntries().forEach(e => s.push(e.value))).observe({ type: 'layout-shift', buffered: true }); return s; })() }"
```
Expected before: `ratio: "auto"` and a shift entry about `0.0214`.

- [ ] **Step 2: Keep the ratio on the element**

`assets/css/style.css` line 405 becomes:
```css
.theme figure.natural img, .theme figure.natural video { height: auto; }   /* full frame; the ratio is inline on the element, beside its width/height */
```
`research.html` line 27:
```html
        <img src="{{ '/assets/img/research/pedot-eskm-if.jpg' | relative_url }}" alt="" loading="lazy" width="1600" height="646" style="aspect-ratio: 1600 / 646">
```
`research.html` line 71: add `style="aspect-ratio: 1030 / 1064"` to the `<video ...>` tag, before `aria-label`.

- [ ] **Step 3: Measure the fix**

Re-run Step 1 after `$JEKYLL build`. Expected: `ratio: "1600 / 646"`, `shifts: []`. Screenshot `--full --shot` at 1440 and confirm the immunofluorescence figure and the GIWAXS video still show their whole frame (no 4:3 crop).

- [ ] **Step 4: Commit**

```bash
git add assets/css/style.css research.html
git commit -m "Research: keep the natural figures' aspect ratio so the page does not jump while they load"
```

---

### Task 8: Team cards stay under the pointer, and shared links land once (C13, C11, med)

**Files:**
- Modify: `assets/js/site.js` (team block, lines 88-108)

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/team/ --settle --scroll 600 --eval "const a = document.getElementById('michelle-lotz'), b = document.getElementById('yebin-lee'); a.open = true; await new Promise(r => setTimeout(r, 100)); const before = b.getBoundingClientRect().top; b.querySelector('summary').click(); await new Promise(r => setTimeout(r, 150)); return { before, after: b.getBoundingClientRect().top }"
node scripts/shot.mjs "http://127.0.0.1:4002/team/#royall-mcmahon-ward" --wait 800 --eval "const c = document.getElementById('royall-mcmahon-ward'); return { open: c.open, top: c.getBoundingClientRect().top }"
```
Expected before: the first returns `after` about 290px above `before` (the card jumps); the second returns `top` about 361 (the load-time re-centre moved it away from its scroll margin).

- [ ] **Step 2: Replace the team block**

Replace from `/* ---- team: one bio open at a time` through the closing `}` of `if (people.length) { ... }` with:
```javascript
  /* ---- team: one bio open at a time, and the open one owns the URL ---- */
  var people = [].slice.call(d.querySelectorAll("details.person[id]"));
  if (people.length) {
    /* the toggle event does not bubble, so listen for it on the way down */
    d.addEventListener("toggle", function (ev) {
      var t = ev.target;
      if (!t.matches || !t.matches("details.person[id]")) return;
      if (t.open) {
        var top = t.getBoundingClientRect().top;
        people.forEach(function (p) { if (p !== t) p.open = false; });
        /* closing a card above this one re-flows the grid; keep the clicked card where the pointer is */
        var moved = t.getBoundingClientRect().top - top;
        if (moved) scrollBy({ top: moved, behavior: "instant" });
        history.replaceState(null, "", "#" + t.id);
      } else if (location.hash === "#" + t.id) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    }, true);

    /* arriving with #slug: open that card; the browser's own fragment scroll lands it at its scroll margin */
    var wanted = location.hash.length > 1 && d.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (wanted && wanted.matches("details.person")) wanted.open = true;
  }
```

- [ ] **Step 3: Measure the fix**

Re-run both commands from Step 1 after `$JEKYLL build`. Expected: first `after` within 2px of `before`; second `open: true, top` about 88 (5.5rem scroll margin). Also at `--width 390 --height 844 --mobile`: open `rachel-daso`, then click `royall-mcmahon-ward`'s summary the same way and confirm `after` within 2px of `before`.

- [ ] **Step 4: Commit**

```bash
git add assets/js/site.js
git commit -m "Team: the clicked card stays put when another closes; #slug arrival scrolls once"
```

---

### Task 9: Content fixes in posts and data (C12, C24, C26, C29, C17, I1 welcome excerpt)

**Files:**
- Modify: `_posts/2020-04-07-jonathan-was-recently-chosen-as-one-of-onrs-best.md` (lines 5 and 9), `_posts/2020-04-09-jonathan-was-selected-as-mrss-outstanding-early-career.md` (lines 5 and 9), `_posts/2022-09-06-a-semiconducting-twodimensional-polymer-as-an-organic.md`, `_posts/2022-09-06-chemical-reviews-paper-on-operando-omiec-characterization.md`, `_posts/2026-09-11-welcome-to-our-new-site.md`, `_data/people.yml`, `assets/img/news/2026-09-16-blavatnik-finalist.jpg`

- [ ] **Step 1: Dead links**

In the ONR post replace both occurrences of
`https://www.onr.navy.mil/en/Media-Center/Press-Releases/2020/2020-ONR-YIP-Awardees`
with
`https://www.onr.navy.mil/media-center/news-releases/best-and-brightest-onrs-2020-young-investigators`.
In the MRS post replace both occurrences of `outstanding-early-career-investigator%20.html` with `outstanding-early-career-investigator.html`.
Check: `curl -sIL -o /dev/null -w '%{http_code}\n' <each new URL>` → `200`.

- [ ] **Step 2: Paper links**

Add to the front matter of `2022-09-06-a-semiconducting-twodimensional-polymer-as-an-organic.md`:
```yaml
link: https://doi.org/10.1002/adma.202110703
```
and to `2022-09-06-chemical-reviews-paper-on-operando-omiec-characterization.md`:
```yaml
link: https://doi.org/10.1021/acs.chemrev.1c00597
```
The layout then renders "Read the paper" on both (it is gated on `page.link`).

- [ ] **Step 3: Welcome post teaser**

Jekyll uses a front-matter `excerpt:` in place of the first paragraph. Add to `_posts/2026-09-11-welcome-to-our-new-site.md` front matter:
```yaml
excerpt: "Our first post on the new site rounds up everything that has happened in the group since our last update."
```
This is the whole of the excerpt fix: the verifiers found that a sentence-boundary cut would misfire on the seven posts with "Dr." or "Prof." in their first sentence, so the 32-word teaser stays and any other post whose cut reads badly gets its own one-line `excerpt:` (the README documents the key in Task 11).

- [ ] **Step 4: Data**

In `_data/people.yml` line 29 change `in the Rivnay group,` to `in the Rivnay Group,`. Normalise the six LinkedIn values to the `https://www.linkedin.com/in/<handle>` form:

| line | from | to |
|---|---|---|
| 42 | `https://linkedin.com/in/rachel-nolander` | `https://www.linkedin.com/in/rachel-nolander` |
| 56 | `http://www.linkedin.com/in/catherine-beaumont2` | `https://www.linkedin.com/in/catherine-beaumont2` |
| 72 | `http://www.linkedin.com/in/yebin-lee-4647418b` | `https://www.linkedin.com/in/yebin-lee-4647418b` |
| 89 | `http://www.linkedin.com/in/daeyeon-won-2a362523b` | `https://www.linkedin.com/in/daeyeon-won-2a362523b` |
| 134 | `http://www.linkedin.com/in/albert-lai-` | `https://www.linkedin.com/in/albert-lai-` |
| 172 | `http://linkedin.com/in/zander-schwartz` | `https://www.linkedin.com/in/zander-schwartz` |

Check: `grep -c 'http://' _data/people.yml` → `0`.

- [ ] **Step 5: Re-encode the Blavatnik image**

```bash
python3 -c "
from PIL import Image
p = 'assets/img/news/2026-09-16-blavatnik-finalist.jpg'
im = Image.open(p); print(im.size)
im.convert('RGB').save(p, quality=82, optimize=True, progressive=True)
import os; print(os.path.getsize(p))
"
```
Expected: size `(1400, 561)` unchanged, file about 150,000 bytes (was 584,882). View the file with the Read tool to confirm it looks the same. Then `python3 scripts/thumbs.py` (the source is now newer than its thumbnail) and commit the refreshed thumb.

- [ ] **Step 6: Build and verify**

```bash
$JEKYLL build && python3 scripts/check_links.py
grep -c 'Read the paper' _site/news/2022/09/06/a-semiconducting-twodimensional-polymer-as-an-organic/index.html _site/news/2022/09/06/chemical-reviews-paper-on-operando-omiec-characterization/index.html
node scripts/shot.mjs http://127.0.0.1:4002/ --eval "return [...document.querySelectorAll('.news-list .excerpt')].map(e => e.textContent.slice(-25))"
```
Expected: `1` and `1`; the welcome post's excerpt now ends `...since our last update.` instead of `updates:`.

- [ ] **Step 7: Commit**

```bash
git add _posts _data/people.yml assets/img/news/2026-09-16-blavatnik-finalist.jpg assets/img/news/2026-09-16-blavatnik-finalist-thumb.jpg
git commit -m "News and data: fix two dead links, link two papers, teaser for the welcome post, tidy people.yml"
```

---

### Task 10: MRSEC mark that can be read (C5, med)

**Files:**
- Modify: `assets/img/logos/mrsec.svg` (or add `assets/img/logos/mrsec-lockup.svg`), `_data/support.yml:56-59`

- [ ] **Step 1: Measure the defect**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/research/ --scroll 5200 --wait 800 --eval "const i = document.querySelector('.logo-row img[src*=mrsec]'); return { w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height, cap: getComputedStyle(i).maxHeight }"
```
Expected before: `h: 64` against `cap: "95px"` (the SVG tag's own `width="74.4" height="64"` wins because the CSS only caps).

- [ ] **Step 2: Look for the official lockup**

```bash
curl -sL https://www.mrsec.northwestern.edu/ | grep -oiE '(src|href)="[^"]*(logo|mrsec)[^"]*\.(svg|png)[^"]*"' | sort -u
```
If a horizontal lockup (icon plus "Materials Research Science and Engineering Center" / "Northwestern" wordmark) is listed, download it to `assets/img/logos/mrsec-lockup.svg` (or `.png` at 2x display size, at least 600px wide), measure its ink aspect ratio with the harness (`--eval "const i = new Image(); i.src = '/assets/img/logos/mrsec-lockup.svg'; await i.decode(); return i.naturalWidth / i.naturalHeight"` on any page), set in `_data/support.yml`:
```yaml
  - name: Northwestern Materials Research Science and Engineering Center
    logo: mrsec-lockup.svg
    h: <round(68 * (3 / aspect) ** 0.35)>
    url: https://www.mrsec.northwestern.edu
```
and `git rm assets/img/logos/mrsec.svg`.

- [ ] **Step 3: If no lockup is available, size the icon correctly and flag it**

Edit the `<svg` tag in `assets/img/logos/mrsec.svg` from `width="74.4" height="64"` to `width="110.4" height="95"` (same 53:45.6 ratio as its viewBox) so it renders at the tuned 95px, and add to the "Needs John" list at the end of this plan that the MRSEC cell is an unlabelled icon and should either get the official lockup from the MRSEC office or be dropped.

- [ ] **Step 4: Measure the fix**

Re-run Step 1 after `$JEKYLL build`. Expected: `h: 95` (or the lockup's `h`). Take `--full --shot` of `/research/` at 1440 and check the Facilities row still lines up flush left with the marks at similar visual weight.

- [ ] **Step 5: Commit**

```bash
git add assets/img/logos _data/support.yml
git commit -m "Support: MRSEC mark rendered at its tuned size"
```

---

### Task 11: Repo hygiene and an honest README (C7, C16, C20 remainder, dead baseurl code)

**Files:**
- Move: `assets/img/README.md` → `docs/image-manifest.md`
- Modify: `_layouts/post.html:4,12`, `scripts/check_links.py`, `README.md`

- [ ] **Step 1: Take the manifest out of the build**

```bash
git mv assets/img/README.md docs/image-manifest.md
sed -i '' 's#the lab photo folder/#website/#g' docs/image-manifest.md
$JEKYLL build && ls _site/assets/img/README.md 2>&1
```
Expected: `No such file or directory`.

- [ ] **Step 2: Remove the dead baseurl handling**

In `_layouts/post.html` delete line 4 (`{%- capture assetprefix %}src="{{ site.baseurl }}/assets/{% endcapture -%}`) and change `{{ content | replace: 'src="/assets/', assetprefix }}` to `{{ content }}` (baseurl is `""` for good; the replace was a no-op).

Replace `scripts/check_links.py` with:
```python
#!/usr/bin/env python3
"""Check internal links and asset references in the built site.

Usage: jekyll build && python3 scripts/check_links.py [_site]
Reports every href/src/poster/srcset that points inside the site but does not resolve to a
file, an index.html, or a .html page (GitHub Pages serves /foo from foo.html).
"""
import os, re, sys, html
from urllib.parse import urlsplit, unquote

site = sys.argv[1] if len(sys.argv) > 1 else "_site"
attr = re.compile(r'(?:href|src|poster)="([^"]+)"|srcset="([^"]+)"')
problems, checked = [], 0

def exists(path):
    p = os.path.join(site, unquote(path).lstrip("/"))
    return os.path.isfile(p) or os.path.isfile(os.path.join(p, "index.html")) or os.path.isfile(p + ".html")

for root, _, files in os.walk(site):
    for f in files:
        if not f.endswith(".html"):
            continue
        page = os.path.join(root, f)
        text = open(page, encoding="utf-8").read()
        for m in attr.finditer(text):
            targets = [m.group(1)] if m.group(1) else [t.strip().split(" ")[0] for t in m.group(2).split(",")]
            for raw in targets:
                url = html.unescape(raw)
                if url.startswith(("http:", "https:", "mailto:", "tel:", "data:", "#", "javascript:")):
                    continue
                path = urlsplit(url).path
                if not path:
                    continue
                checked += 1
                rel = path if path.startswith("/") else os.path.join(os.path.relpath(root, site), path)
                if not exists(rel):
                    problems.append(f"{page}: broken: {url}")

print(f"checked {checked} internal references")
for p in problems:
    print(p)
sys.exit(1 if problems else 0)
```
Check: `$JEKYLL build && python3 scripts/check_links.py` → `checked N internal references` and exit 0; `diff <(git show HEAD:_site/index.html 2>/dev/null) /dev/null; grep -c 'src="/assets/' _site/news/2022/09/06/summer-outings-terrariums-and-kayaking/index.html` still finds the post's inline images.

- [ ] **Step 3: README**

Line 5 becomes:
```
Live: https://rivnay.northwestern.edu/
```
Replace the post front-matter example with:
```yaml
---
title: Congratulations Dr. Example!
date: 2026-09-01
kind: people        # paper | award | people | group
image: /assets/img/news/2026-09-01-example.jpg   # optional; 1600px wide max, about 300 KB
image_width: 1400   # pixel size of the file, so the page does not jump while it loads
image_height: 561
image_caption: Optional caption under the lead photo
excerpt: Optional one-sentence teaser for the news list; otherwise the first paragraph is cut at 32 words
link: https://doi.org/...                         # optional, shown as "Read more"
---
Body text in markdown.
```
After the `jekyll serve` block add:
```
After `jekyll build`, `python3 scripts/check_links.py` reports any internal link or asset that does not resolve.
```
Replace the whole "Custom domain (rivnay.northwestern.edu)" section with:
```
## Domain

rivnay.northwestern.edu is a CNAME to rivnay-group.github.io (set by Northwestern IT), the `CNAME` file in this repo names it, and "Enforce HTTPS" is on under Settings → Pages. Nothing to do unless the repo moves; then change `url:` in `_config.yml`, the `CNAME` file and the DNS record together.
```

- [ ] **Step 4: Commit**

```bash
git add -A docs/image-manifest.md assets/img/README.md _layouts/post.html scripts/check_links.py README.md
git commit -m "Hygiene: manifest out of the build, dead baseurl code removed, README matches the live domain"
```

---

### Task 12: Sitemap, feed, share images and the Alumni nav state (C18, I4, I12, C19)

**Files:**
- Modify: `_config.yml`, `_layouts/default.html:6` and `:27-36`, `people.html`, `team.html`, `README.md`

- [ ] **Step 1: Install the plugins locally**

```bash
/opt/homebrew/opt/ruby/bin/gem install jekyll-sitemap jekyll-feed
```

- [ ] **Step 2: Config**

`_config.yml` plugins:
```yaml
plugins:
  - jekyll-seo-tag
  - jekyll-redirect-from   # old Squarespace URLs: redirect_from lists in the posts and pages
  - jekyll-sitemap         # /sitemap.xml and /robots.txt
  - jekyll-feed            # /feed.xml from _posts
```
and add a pages scope to `defaults:` so section pages carry a share image (posts keep their own):
```yaml
defaults:
  - scope:
      path: ""
      type: posts
    values:
      layout: post
  - scope:
      path: ""
    values:
      layout: default
  - scope:
      path: ""
      type: pages
    values:
      image: /assets/img/og-image.jpg
```
In `team.html` front matter add `image: /assets/img/team-2026.jpg`. In `people.html` front matter add `sitemap: false`.

- [ ] **Step 3: Layout**

`_layouts/default.html` line 6: `{% seo %}` becomes `{% seo %}{% feed_meta %}`.

Replace the nav-current test so Alumni lights Team. Before the `{%- for item in items -%}` loop add:
```liquid
        {%- assign here = page.url -%}
        {%- if page.url == "/alumni/" -%}{%- assign here = "/team/" -%}{%- endif -%}
```
and change `{%- elsif page.url contains p[1] -%}` to `{%- elsif here contains p[1] -%}`.

- [ ] **Step 4: README**

Update the gem line to `gem install jekyll jekyll-seo-tag jekyll-redirect-from jekyll-sitemap jekyll-feed webrick`.

- [ ] **Step 5: Verify**

```bash
$JEKYLL build && python3 scripts/check_links.py
grep -c '<loc>' _site/sitemap.xml; grep -c '/people/\|404' _site/sitemap.xml; cat _site/robots.txt; ls -la _site/feed.xml
grep -o 'og:image" content="[^"]*' _site/index.html _site/team/index.html _site/research/index.html
grep -o 'rel="alternate"[^>]*' _site/index.html
node scripts/shot.mjs http://127.0.0.1:4002/alumni/ --eval "return [...document.querySelectorAll('.site-nav a[aria-current]')].map(a => a.textContent)"
```
Expected: `70` `<loc>` entries (7 pages + 63 posts; the plugin leaves out the redirect stubs and pages marked `sitemap: false`); `0` for people/404; robots.txt names the sitemap; feed.xml exists; og:image is `og-image.jpg` on `/` and `/research/` and `team-2026.jpg` on `/team/`; a `rel="alternate" type="application/atom+xml"` link; `["Team"]`.

- [ ] **Step 6: Commit**

```bash
git add _config.yml _layouts/default.html people.html team.html README.md
git commit -m "Sitemap, Atom feed, share images on section pages, and Team stays current on Alumni"
```

---

### Task 13: Stylesheet fixes (C21, C22, C27, C28, C25, I11, dead rules)

**Files:**
- Modify: `assets/css/style.css`

Each step has its own check; commit once at the end.

- [ ] **Step 1: Support grid cannot exceed the viewport (C21)**

Change `.logo-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); ...` to `minmax(min(300px, 100%), 1fr)`.
Check: `node scripts/shot.mjs http://127.0.0.1:4002/research/ --width 320 --height 700 --mobile --eval "return { sw: document.documentElement.scrollWidth, cell: document.querySelector('.logo-row a').getBoundingClientRect().width }"` → `sw: 320, cell: 272`.

- [ ] **Step 2: Footer keeps pairs between 561 and 860px (C22)**

In `@media (max-width: 860px) { .site-footer .wrap { grid-template-columns: 1fr 1fr; } .site-footer .nu { grid-column: 1 / -1; } }` delete `.site-footer .nu { grid-column: 1 / -1; }`.
Check at `--width 768 --height 900`: `--eval "const r = s => document.querySelector(s).getBoundingClientRect(); return { locTop: r('.site-footer address').top, nuTop: r('.site-footer .nu').top, nuLeft: r('.site-footer .nu').left }"` → `nuTop` within 40px of `locTop` and `nuLeft` about 404 (beside Location, not below it).

- [ ] **Step 3: Card hover eases again (C27)**

Change the reveal rule
```css
.reveal-ready .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); transition-delay: var(--reveal-delay, 0ms); }
```
to
```css
.reveal-ready .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s; transition-delay: var(--reveal-delay, 0ms), var(--reveal-delay, 0ms), 0ms; }
```
Check: `--eval "return getComputedStyle(document.querySelector('a.card')).transition"` on `/` contains `border-color 0.15s`.

- [ ] **Step 4: Small lead images are not stretched (C28)**

Change `.post-figure img { border-radius: var(--radius); border: 1px solid var(--line); width: 100%; height: auto; }` to `... width: auto; max-width: 100%; height: auto; margin-inline: auto; }`.
Check on `/news/2024/08/19/tunable-anti-ambipolar-vertical-bilayer-organic/` at 1440: `--eval "const i = document.querySelector('.post-figure img'); return { w: i.getBoundingClientRect().width, natural: i.naturalWidth, centred: Math.abs((i.getBoundingClientRect().left + i.getBoundingClientRect().right) / 2 - innerWidth / 2) < 2 }"` → `w: 468, natural: 468, centred: true`; and on the Blavatnik post `w: 672` (wide images still fill the column).

- [ ] **Step 5: One size for list titles (C25)**

Add `--fs-title: 1.02rem;   /* titles of list items: news, publications, team names */` to the `:root` token block after `--fs-md`. Then use `font-size: var(--fs-title)` in `.news-list .title`, `.pub .title`, `.recent-pubs .title` (add the property), `.theme-pubs a` (add the property) and `.person .name` (replacing `1.06rem`); change `.pi .prose { margin-top: 1rem; font-size: 0.98rem; }` to `font-size: var(--fs-md)`.
Check on `/` at 1440: `--eval "return [ '.news-list .title', '.recent-pubs .title' ].map(s => getComputedStyle(document.querySelector(s)).fontSize)"` → both `16.32px`; on `/team/` at 1440 every `.person .name` still renders on one line: `--eval "return [...document.querySelectorAll('.person .name')].filter(n => n.getBoundingClientRect().height > 24).map(n => n.textContent)"` → `[]`.

- [ ] **Step 6: Air under a bare page title (I11)**

After `.page-head { padding: 3rem 0 1.75rem; }` add:
```css
.page-head:has(> h1:only-child) { padding-bottom: 2.5rem; }   /* a bare title sits as far from the first h2 as h2s sit from each other */
```
Check on `/join/` at 1440: `--eval "const r = s => document.querySelector(s).getBoundingClientRect(); return r('.prose h2').top - r('.page-head h1').bottom"` → `40`; on `/research/` (has an intro) the gap stays `28`.

- [ ] **Step 7: Dead rules and stacked comments**

Delete `.media-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }` and `.media-pair img { aspect-ratio: 1; }` (nothing uses the class: `grep -r media-pair *.html _layouts _includes` is empty). Delete the `--serif: var(--sans);` token line (`grep -c 'var(--serif)' assets/css/style.css` → 0). Above `.logo-row`, keep only the last of the three stacked comment blocks (the one beginning `/* Equal cells, every mark flush to the same left edge`) and delete the two above it.
Check: `$JEKYLL build` and a `--full --shot` of `/research/` at 1440 looks the same as before this task apart from the items above.

- [ ] **Step 8: Commit**

```bash
git add assets/css/style.css
git commit -m "Stylesheet: logo grid fits 320px, footer pairs, card hover eases, lead images unstretched, one list-title size"
```

---

### Task 14: Copy-link feedback that is announced and survives failure (C23, low)

**Files:**
- Modify: `_layouts/post.html:22`, `assets/js/site.js` (copy-link block)

- [ ] **Step 1: Markup**

`_layouts/post.html` line 22: `<span class="share-label">Share</span>` becomes `<span class="share-label" aria-live="polite">Share</span>`.

- [ ] **Step 2: Script**

Replace the copy-link block (from `/* ---- copy a link to the clipboard` to its closing `});`) with:
```javascript
  /* ---- copy a link to the clipboard ---- */
  d.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".copy-link");
    if (!btn) return;
    var url = btn.dataset.url;
    var label = btn.parentNode.querySelector(".share-label");

    /* the share label doubles as the live region: it says what happened, then goes back to "Share" */
    function say(text, done) {
      btn.classList.toggle("is-copied", done);
      btn.querySelector(".i-link").hidden = done;
      btn.querySelector(".i-ok").hidden = !done;
      btn.setAttribute("aria-label", done ? "Link copied" : "Copy link");
      btn.title = done ? "Link copied" : "Copy link";
      if (label) label.textContent = text;
      clearTimeout(btn._t);
      if (text !== "Share") btn._t = setTimeout(function () { say("Share", false); }, 1800);
    }
    function confirmed() { say("Link copied", true); }
    function failed() { say("Copy failed", false); }

    /* the async clipboard refuses when the document is not focused, so keep the old route in reserve */
    function fallback() {
      var ta = d.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      d.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = d.execCommand("copy"); } catch (e) {}
      d.body.removeChild(ta);
      btn.focus();
      if (ok) confirmed(); else failed();
    }

    if (navigator.clipboard) navigator.clipboard.writeText(url).then(confirmed, fallback);
    else fallback();
  });
```

- [ ] **Step 3: Verify both paths**

```bash
$JEKYLL build
node scripts/shot.mjs http://127.0.0.1:4002/news/2026/09/16/jonathan-named-blavatnik-finalist/ --eval "Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() } }); const l = document.querySelector('.share-label'); document.querySelector('.copy-link').click(); await new Promise(r => setTimeout(r, 100)); const during = l.textContent; document.querySelector('.copy-link').click(); await new Promise(r => setTimeout(r, 2100)); return { during, after: l.textContent, live: l.getAttribute('aria-live') }"
node scripts/shot.mjs http://127.0.0.1:4002/news/2026/09/16/jonathan-named-blavatnik-finalist/ --eval "Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) } }); document.execCommand = () => false; const l = document.querySelector('.share-label'); document.querySelector('.copy-link').click(); await new Promise(r => setTimeout(r, 100)); return l.textContent"
```
Expected: `{ during: "Link copied", after: "Share", live: "polite" }` (the second click restarted the timer instead of cutting it short) and `"Copy failed"`.

- [ ] **Step 4: Commit**

```bash
git add _layouts/post.html assets/js/site.js
git commit -m "Copy link: announce the result, report failure, and let a second click restart the timer"
```

---

### Task 15: The postdoc posting reads as its own document (I5, med)

**Files:**
- Modify: `join.html:25`, `assets/css/style.css` (after `.prose h2 { margin: 2.5rem 0 0.8rem; }`)

- [ ] **Step 1: Measure**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/join/ --eval "const h = document.querySelector('#postdoc'); const p = h.previousElementSibling.getBoundingClientRect(), r = h.getBoundingClientRect(); return { gap: r.top - p.bottom, border: getComputedStyle(h).borderTopWidth, dateline: getComputedStyle(h.nextElementSibling).color }"
```
Expected before: `gap: 40, border: "0px", dateline: "rgb(28, 24, 38)"`.

- [ ] **Step 2: Change**

`join.html` line 25: `<p><strong>Northwestern University, McCormick School of Engineering</strong><br>` becomes `<p class="muted"><strong>Northwestern University, McCormick School of Engineering</strong><br>`.
In `assets/css/style.css` after `.prose h2 { margin: 2.5rem 0 0.8rem; }` add:
```css
.prose h2#postdoc { margin-top: 3.5rem; padding-top: 2.5rem; border-top: 1px solid var(--line); }   /* the posting is a separate document: same rule the research themes use */
```

- [ ] **Step 3: Measure the fix**

Re-run Step 1 after `$JEKYLL build`. Expected: `gap: 96, border: "1px", dateline: "rgb(98, 92, 112)"`. Full-page screenshot at 390 mobile to confirm the rule spans the column and the dateline reads as a muted block under the title.

- [ ] **Step 4: Commit**

```bash
git add join.html assets/css/style.css
git commit -m "Join: a rule and a muted dateline set the postdoc posting apart"
```

---

### Task 16: Phone hit areas (I6, I7, med)

**Files:**
- Modify: `assets/css/style.css` (end of the news-list block, end of the publications block, end of the team block)

- [ ] **Step 1: Measure**

```bash
node scripts/shot.mjs http://127.0.0.1:4002/news/ --width 390 --height 844 --mobile --touch --settle --eval "const li = document.querySelector('.news-list li'); const ex = li.querySelector('.excerpt').getBoundingClientRect(); const hit = document.elementFromPoint(ex.left + 40, ex.top + ex.height / 2).closest('a'); return { rowHeight: li.getBoundingClientRect().height, excerptHitsLink: !!hit, coarse: matchMedia('(pointer: coarse)').matches }"
node scripts/shot.mjs http://127.0.0.1:4002/publications/ --width 390 --height 844 --mobile --touch --eval "return document.querySelector('.years a').getBoundingClientRect().height"
```
Expected before: `excerptHitsLink: false`, chip height `24`.

- [ ] **Step 2: Whole rows are the link**

After the `.news-list` rules (before `.kind {`) add:
```css
/* the title is the only link in these rows, so the whole row is its hit area */
.news-list li, .recent-pubs li { position: relative; }
.news-list .title a::after, .recent-pubs a.title::after { content: ""; position: absolute; inset: 0; }
```
(`.recent-pubs li` already exists as a rule; adding `position: relative` in this new rule is enough.)

- [ ] **Step 3: Larger targets on touch screens only**

At the end of the publications block (after the `@media (prefers-reduced-motion: reduce) { .years, ... }` line) add:
```css
@media (pointer: coarse) and (max-width: 1259px) {
  .years { padding-block: 0; }
  .years a { padding: 0.75rem 0.2rem 0.85rem; }   /* the chip fills the 44px strip; the visual stays the same */
}
```
After `.person.no-bio .links { margin-top: 0.4rem; }` add:
```css
@media (pointer: coarse) {
  .ico { width: 44px; height: 44px; }
  .person .links { gap: 0.6rem; }
  .person .links:has(> .ico:first-child) { margin-left: -0.8rem; }
  .alumni th, .alumni td { padding-block: 0.7rem; }
}
```

- [ ] **Step 4: Measure the fix**

Re-run both commands from Step 1 after `$JEKYLL build`. Expected: `excerptHitsLink: true` with an unchanged `rowHeight`; chip height about `44`. Then `node scripts/shot.mjs http://127.0.0.1:4002/team/ --width 390 --height 844 --mobile --touch --click "#rachel-nolander summary" --eval "return [...document.querySelectorAll('#rachel-nolander .ico')].map(i => i.getBoundingClientRect().height)"` → `[44, 44]`. If Task 0 found `coarse: false` under `--touch`, verify instead by reading the rules back with `grep -n 'pointer: coarse' assets/css/style.css` and checking on a real phone after the push.

- [ ] **Step 5: Commit**

```bash
git add assets/css/style.css
git commit -m "Phones: whole news rows tap through, and 44px chips and icons on touch screens"
```

---

### Task 17: A way to Join from Home and Research (I9, med)

**Files:**
- Modify: `index.html` (after the card grid's closing `</div>`), `research.html` (inside `#applications`, after the `.theme-pubs` block and before `</section>`)

- [ ] **Step 1: Change**

`index.html`: after the line `    </div>` that closes `.card-grid` (directly after the Applications card) add:
```liquid
    <p class="more"><a class="go" href="{{ '/join/' | relative_url }}">Join the group</a></p>
```
`research.html`: inside the `#applications` section, after `  {%- endif -%}` of its Selected papers block and before `</section>`, add:
```liquid
  <p class="more"><a class="go" href="{{ '/join/' | relative_url }}">Join the group</a></p>
```
(It must be inside the section: the Support section's top rule comes from `.theme + .section`, which a sibling paragraph would break.)

- [ ] **Step 2: Verify**

```bash
$JEKYLL build
node scripts/shot.mjs http://127.0.0.1:4002/ --eval "return [...document.querySelectorAll('main a[href=\"/join/\"]')].length"
node scripts/shot.mjs http://127.0.0.1:4002/research/ --eval "return { join: document.querySelectorAll('main a[href=\"/join/\"]').length, supportRule: getComputedStyle(document.querySelector('.theme + .section')).borderTopWidth }"
```
Expected: `1`; `{ join: 1, supportRule: "1px" }`. Screenshot both at 1440 and 390 and confirm the link sits in the same style as "All news" and "All publications", with nothing inside the hero.

- [ ] **Step 3: Commit**

```bash
git add index.html research.html
git commit -m "Home and Research: close with a link to Join"
```

---

### Task 18: Filter box on Publications (I3, med)

**Files:**
- Modify: `publications.html` (page head), `assets/css/style.css` (publications block), `assets/js/site.js` (before the year timeline; plus one line in `update()`)

- [ ] **Step 1: Markup**

In `publications.html`, after the `<p class="lead">...</p>` line inside `.page-head`, add:
```html
    <p class="pub-filter"><input type="search" id="pub-filter" placeholder="Filter by title, author or journal" aria-label="Filter publications" autocomplete="off"></p>
    <p class="pub-none" hidden>No papers match.</p>
```

- [ ] **Step 2: CSS**

In the publications block (before `/* year timeline`) add:
```css
.pub-filter { margin-top: 1.2rem; }
.pub-filter input { width: 100%; max-width: 28rem; font: inherit; font-size: var(--fs-md); color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 8px; padding: 0.55rem 0.8rem; }
.pub-filter input:focus { border-color: var(--purple); }
.pub-none { margin-top: 1rem; color: var(--muted); font-size: var(--fs-md); }
```

- [ ] **Step 3: Script**

Before `/* ---- publications: year timeline ---- */` add:
```javascript
  /* ---- publications: filter ---- */
  var filter = d.getElementById("pub-filter");
  if (filter) {
    var pubs = [].slice.call(d.querySelectorAll(".pub"));
    var pubYears = [].slice.call(d.querySelectorAll(".pub-year"));
    var older = d.querySelector("details.collapsed");
    var none = d.querySelector(".pub-none");
    var haystack = pubs.map(function (p) { return p.textContent.toLowerCase(); });
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase();
      var shown = 0;
      pubs.forEach(function (p, i) { p.hidden = !!q && haystack[i].indexOf(q) < 0; if (!p.hidden) shown++; });
      pubYears.forEach(function (s) { s.hidden = !!q && !s.querySelector(".pub:not([hidden])"); });
      if (older) older.open = !!q && !!older.querySelector(".pub:not([hidden])");
      if (none) none.hidden = !q || shown > 0;
    });
  }
```
In the timeline's `update()` loop change
```javascript
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= line) current = sections[i]; else break;
      }
```
to
```javascript
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].hidden) continue;
        if (sections[i].getBoundingClientRect().top <= line) current = sections[i]; else break;
      }
```

- [ ] **Step 4: Verify**

```bash
$JEKYLL build
node scripts/shot.mjs http://127.0.0.1:4002/publications/ --eval "const f = document.getElementById('pub-filter'); const go = q => { f.value = q; f.dispatchEvent(new Event('input')); return { shown: document.querySelectorAll('.pub:not([hidden])').length, years: document.querySelectorAll('.pub-year:not([hidden])').length, older: document.querySelector('details.collapsed').open, none: document.querySelector('.pub-none').hidden }; }; return { hydrogel: go('hydrogel'), rivnay2011: go('malliaras'), nothing: go('zzzz'), cleared: go('') }"
```
Expected: `hydrogel` shows a handful of entries in a few years with `none: true`; `malliaras` opens the pre-Northwestern details (`older: true`); `zzzz` gives `shown: 0, none: false`; `cleared` gives `shown: 182, years: 10, older: false, none: true`. Screenshot the head at 390 mobile: the box spans the column under the lead.

- [ ] **Step 5: Commit**

```bash
git add publications.html assets/css/style.css assets/js/site.js
git commit -m "Publications: a filter box for title, author or journal"
```

---

### Task 19: News grouped by year with the year strip (I2, med)

**Files:**
- Modify: `news.html`

- [ ] **Step 1: Replace the list**

`news.html` body becomes:
```liquid
<div class="wrap">
  <header class="page-head">
    <h1>News</h1>
  </header>
  {% assign groups = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}
  <div><!-- bounds the sticky year strip -->
  <nav class="years" aria-label="Jump to year">
    <span class="years-marker" aria-hidden="true"></span>
    {% for g in groups %}<a href="#{{ g.name }}">{{ g.name }}</a>{% endfor %}
  </nav>
  {% for g in groups %}
  <section class="pub-year" id="{{ g.name }}">
    <h2>{{ g.name }}</h2>
    <ul class="news-list">
      {% for post in g.items %}
      <li class="reveal">
        <p class="when"><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d" }}</time>{% if post.kind %}<span class="kind">{{ post.kind }}</span>{% endif %}</p>
        <div>
          <p class="title"><a href="{{ post.url | relative_url }}">{{ post.title }}</a></p>
          {% assign ex = post.excerpt | strip_html | strip | truncatewords: 32 %}
          {% if ex != "" %}<p class="excerpt">{{ ex }}</p>{% endif %}
        </div>
        {% if post.image %}<a class="thumb" href="{{ post.url | relative_url }}" tabindex="-1" aria-hidden="true"><img src="{{ post.image | replace: '.jpg', '-thumb.jpg' | relative_url }}" alt="" loading="lazy" width="104" height="78"></a>{% endif %}
      </li>
      {% endfor %}
    </ul>
  </section>
  {% endfor %}
  </div>
</div>
```
Keep the front matter (including the `redirect_from:` list from Task 1). The `.pub-year` grid, the `.years` strip/rail and `site.js`'s timeline all key on these class names, so News gets the same year gutter, sticky strip under the header below 1260px and fixed rail above it with no CSS or JS change. The date drops its year because the heading carries it. The kind chips stay as plain tags: a per-kind filter was judged not worth its script once the years give the page its structure.

- [ ] **Step 2: Verify**

```bash
$JEKYLL build && python3 scripts/check_links.py
node scripts/shot.mjs http://127.0.0.1:4002/news/ --eval "return { years: [...document.querySelectorAll('.pub-year h2')].map(h => h.textContent), chips: document.querySelectorAll('.years a').length, items: document.querySelectorAll('.news-list li').length, firstDate: document.querySelector('.news-list time').textContent }"
node scripts/shot.mjs "http://127.0.0.1:4002/news/#2019" --wait 800 --eval "return { top: document.getElementById('2019').getBoundingClientRect().top, active: document.querySelector('.years a.is-active') && document.querySelector('.years a.is-active').textContent }"
node scripts/shot.mjs http://127.0.0.1:4002/news/ --width 390 --height 844 --mobile --scroll 3000 --wait 600 --eval "const y = document.querySelector('.years').getBoundingClientRect(); return { stripTop: y.top, headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom, active: document.querySelector('.years a.is-active').textContent }"
```
Expected: `years: ["2026","2024","2023","2022","2021","2020","2019","2018","2017"]`, `chips: 9`, `items: 63`, `firstDate: "Sep 16"`; the 2019 heading lands at its scroll margin (about 115) with `active: "2019"`; on the phone the strip sits exactly under the header (`stripTop == headerBottom`). Full-page screenshots at 1440 and 390 for the record.

- [ ] **Step 3: Commit**

```bash
git add news.html
git commit -m "News: group posts by year and reuse the publications year strip"
```

---

### Task 20: Open-access links and corresponding-author marks (I8, med)

**Files:**
- Modify: `scripts/publications.py` (`to_entry`, the manual-add block), `publications.html`, `assets/css/style.css`, `_data/publications.json` (regenerated), `_data/publications_manual.json` (only if it has `add` entries)

- [ ] **Step 1: Script**

In `to_entry`, replace
```python
        "authors": ", ".join(fmt_author(a.get("raw_author_name") or (a.get("author") or {}).get("display_name"))
                             for a in w.get("authorships") or []),
```
with
```python
        "authors": ", ".join(fmt_author(a.get("raw_author_name") or (a.get("author") or {}).get("display_name"))
                             + ("*" if a.get("is_corresponding") else "")
                             for a in w.get("authorships") or []),
```
and after the `"doi": norm_doi(w.get("doi")),` line add
```python
        "oa": (w.get("open_access") or {}).get("oa_url") or None,   # a free copy, when OpenAlex knows one
```
In the manual-add block change the template dict to include `"oa": None,` after `"doi": None,`. Update the module docstring's "Authors are ..." sentence to end: `A corresponding author carries a trailing "*".`

- [ ] **Step 2: Regenerate**

```bash
python3 scripts/publications.py > docs/superpowers/specs/publications-report.txt
git diff --stat _data/publications.json
python3 -c "import json; d = json.load(open('_data/publications.json')); print(len(d), sum(1 for p in d if p.get('oa')), sum(1 for p in d if '*' in p['authors']))"
```
Expected: about `182`, about `100` with `oa`, about `150` with a mark. Read the report for anything newly excluded or added and mention it in the commit message; OpenAlex may have new 2026 papers since the last run, which is fine.

- [ ] **Step 3: Template and CSS**

In `publications.html`, both `.pub` renderings (the year sections and the pre-Northwestern list): replace
```liquid
        {% if p.doi %}<p class="doi">doi:{{ p.doi }}</p>{% endif %}
```
with
```liquid
        <p class="doi">{% if p.doi %}doi:{{ p.doi }}{% endif %}{% if p.oa %}{% if p.doi %} · {% endif %}<a class="oa" href="{{ p.oa }}">Open access</a>{% endif %}</p>
```
After the `<p class="lead">` in the page head add:
```html
    <p class="pub-key">* corresponding author</p>
```
CSS, in the publications block: `.pub-key { margin-top: 0.6rem; font-size: var(--fs-sm); color: var(--muted); }`. The `.doi` line already carries the muted small style; `a.oa` inherits the purple link style.

- [ ] **Step 4: Verify**

```bash
$JEKYLL build && python3 scripts/check_links.py
node scripts/shot.mjs http://127.0.0.1:4002/publications/ --eval "return { oa: document.querySelectorAll('a.oa').length, marked: [...document.querySelectorAll('.pub .authors')].filter(a => a.textContent.includes('*')).length, rivnayBoldStar: [...document.querySelectorAll('.pub .authors')].some(a => a.innerHTML.includes('</strong>*')) }"
```
Expected: `oa` about 100, `marked` about 150, `rivnayBoldStar: true`. Screenshot one year at 1440: the `Open access` link sits after the doi on the small muted line.

- [ ] **Step 5: Commit**

```bash
git add scripts/publications.py _data/publications.json docs/superpowers/specs/publications-report.txt publications.html assets/css/style.css
git commit -m "Publications: open-access links and corresponding-author marks from OpenAlex"
```

---

### Task 21: Previous and next on post pages (I10, low)

**Files:**
- Modify: `_layouts/post.html` (after the `.post-foot` div), `assets/css/style.css` (post block)

- [ ] **Step 1: Markup**

After the closing `</div>` of `.post-foot` in `_layouts/post.html` add:
```liquid
  {% if page.previous or page.next %}
  <nav class="post-nav" aria-label="More news">
    {% if page.previous %}<a class="back" rel="prev" href="{{ page.previous.url | relative_url }}">{{ page.previous.title }}</a>{% else %}<span></span>{% endif %}
    {% if page.next %}<a class="go" rel="next" href="{{ page.next.url | relative_url }}">{{ page.next.title }}</a>{% endif %}
  </nav>
  {% endif %}
```
(`page.previous` is the older post, `page.next` the newer; the back chevron points at older news.)

- [ ] **Step 2: CSS**

After `.share .copy-link.is-copied { color: var(--purple); }` add:
```css
.post-nav { display: flex; justify-content: space-between; gap: 1rem 1.5rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--line); font-size: var(--fs-sm); }
.post-nav .back { margin-top: 0; }
.post-nav a[rel="next"] { text-align: right; margin-left: auto; }
@media (max-width: 600px) { .post-nav { flex-direction: column; } .post-nav a[rel="next"] { text-align: left; margin-left: 0; } }
```

- [ ] **Step 3: Verify**

```bash
$JEKYLL build && python3 scripts/check_links.py
node scripts/shot.mjs http://127.0.0.1:4002/news/2026/09/11/welcome-to-our-new-site/ --eval "return [...document.querySelectorAll('.post-nav a')].map(a => [a.rel, a.getAttribute('href')])"
node scripts/shot.mjs http://127.0.0.1:4002/news/2017/01/01/rivnay-group-arriving-at-nu/ --eval "return [...document.querySelectorAll('.post-nav a')].map(a => a.rel)"
```
Expected: the welcome post lists `["prev", "/news/2024/08/19/..."]` and `["next", "/news/2026/09/16/jonathan-named-blavatnik-finalist/"]`; the oldest post lists only `["next"]`. Screenshot at 390: the two links stack.

- [ ] **Step 4: Commit**

```bash
git add _layouts/post.html assets/css/style.css
git commit -m "Posts: previous and next links"
```

---

## Needs John (not tasks; answer these and the executor can finish)

- **Alumni "Now" for Lucia Galindo (2026) and Boyuan Sun (2022)**: `_data/alumni.yml` has no `now:` for either, so the table shows a blank cell. Supply the institution or company, written out in full, or say to leave blank.
- **Gianmaria vs Giovanni Maria Matrone**: `_data/alumni.yml` and the welcome post say "Gianmaria"; his LinkedIn handle and the publication record ("G. M. Matrone") suggest "Giovanni Maria". Confirm the spelling.
- **Eight members without an email** (Zach Hoegberg, Michelle Lotz, Rhea William, Liangying Chen, Ziyi Liu, Julia Ostrander, Ella Spena, Shwe Yee Phu): their opened cards show no contact.
- **MRSEC mark**: if Task 10 found no official horizontal lockup, decide between asking the MRSEC office for one and dropping the cell.
- **DARPA and AFOSR logos** (from the 2026-09-11 logo review, unchanged): both are outside their agencies' published usage policies; replace with text or seek a licence.
- **Hero clip re-encode** (optional, C6 second half): `ffmpeg -i assets/video/giwaxs-p3meeet.mp4 -c:v libx264 -crf 27 -preset slow -an -movflags +faststart giwaxs-p3meeet-crf27.mp4` typically halves the 1.84 MB; keep it only if the banner looks identical (check the crop rows per the memory note), and only if you want it.

## After the last task

1. `git log --oneline` shows one commit per task above.
2. John pushes; after ten minutes run the Task 1 Step 9 live checks plus `curl -sI https://rivnay.northwestern.edu/sitemap.xml | head -1` (`200`) and `curl -sI https://rivnay.northwestern.edu/cdp5.mjs | head -1` (`404`).
3. Open the home page, Team, Publications and News on a phone.
