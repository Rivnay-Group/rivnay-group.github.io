#!/usr/bin/env python3
"""Check internal links and asset references in the built site.

Usage: jekyll build && python3 scripts/check_links.py [_site] [/baseurl]
Reports hrefs/srcs that point inside the site but do not resolve to a file,
plus root-relative asset paths that skip the baseurl (they break on GitHub Pages
until the custom domain is live).
"""
import os, re, sys, html
from urllib.parse import urlsplit, unquote

site = sys.argv[1] if len(sys.argv) > 1 else "_site"
baseurl = sys.argv[2] if len(sys.argv) > 2 else ""
attr = re.compile(r'(?:href|src|poster)="([^"]+)"|srcset="([^"]+)"')
problems, checked = [], 0

def exists(path):
    p = os.path.join(site, unquote(path).lstrip("/"))
    return os.path.isfile(p) or os.path.isfile(os.path.join(p, "index.html"))

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
                if path.startswith("/") and not path.startswith(baseurl + "/") and path != baseurl:
                    problems.append(f"{page}: missing baseurl: {url}")
                    continue
                rel = path[len(baseurl):] if path.startswith(baseurl) else os.path.join(os.path.relpath(root, site), path)
                if not exists(rel):
                    problems.append(f"{page}: broken: {url}")

print(f"checked {checked} internal references")
for p in problems:
    print(p)
sys.exit(1 if problems else 0)
