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
    post_urls, unmapped, changed, taken = 0, [], 0, {}
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
            cands = sorted((s for s in by_slug if slug == s or slug.startswith(s + "-")), key=len, reverse=True)
            if len(cands) > 1:
                print("ambiguous: %s -> %s (taking %s)" % (url, ", ".join(cands), cands[0]))
            name = by_slug[cands[0]] if cands else None
        if not name:
            unmapped.append(url)
            continue
        if name in taken and taken[name] != url:
            print("COLLISION: %s and %s both map to %s" % (taken[name], url, name))
        taken.setdefault(name, url)
        path = POSTS / name
        text = path.read_text(encoding="utf-8")
        head, body = text.split("\n---\n", 1)
        wrote = False
        # both forms: a stub written as foo.html does not answer a request for foo/, and old links
        # circulate both ways. The plugin writes foo.html for "/foo" and foo/index.html for "/foo/".
        for u in (url, url + "/"):
            # match the whole line inside the FRONT MATTER only: a shorter URL must not be "found" inside
            # a longer one, and an indented list line in the body must not look like an entry
            if "  - %s\n" % u in head + "\n":
                continue
            if "\nredirect_from:\n" in head:
                head = head.replace("\nredirect_from:\n", "\nredirect_from:\n  - %s\n" % u, 1)
            elif "\nredirect_from:" in head:
                raise SystemExit("%s has a redirect_from in a form this script cannot extend; fix it by hand" % name)
            else:
                head += "\nredirect_from:\n  - %s" % u
            wrote = True
        if not wrote:
            continue
        path.write_text(head + "\n---\n" + body, encoding="utf-8")
        changed += 1
    print("old post urls: %d, mapped: %d, files changed: %d" % (post_urls, post_urls - len(unmapped), changed))
    for u in unmapped:
        print("UNMAPPED", u)
    return 1 if unmapped else 0


if __name__ == "__main__":
    sys.exit(main())
