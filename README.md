# Rivnay Group website

Source for the Rivnay Group site (Laboratory for Organic & Hybrid Bioelectronics, Northwestern University). Built with Jekyll and hosted on GitHub Pages. No JavaScript framework, one CSS file, content in data files.

Live: https://rivnay.northwestern.edu/

## Editing content

Everything routine is a data file or a markdown file. Edit on GitHub in the browser and commit; the site rebuilds in about a minute. If it has not changed after a few minutes, look for a red X next to your commit (or under the Actions tab) and open it to see the file and line that failed.

Before uploading any photo, remove its location: on a Mac open it in Preview, choose Tools > Show Inspector, open the GPS tab and click Remove Location Info, then save. On an iPhone, tap Options at the top of the share sheet and turn Location off. Anything committed stays in the public git history even if you delete it later.

| To change | Edit |
|---|---|
| A person, their role, email or bio | `_data/people.yml` (one entry per person, grouped by the `group` key) |
| Add a headshot | drop a square JPEG (324×324 works well) in `assets/img/people/` and set `photo:` to the file name only, e.g. `photo: jane-doe.jpg` |
| Alumni | `_data/alumni.yml` (`now:` is the institution or company; add `role:` only for academic destinations, e.g. `faculty`, `postdoc`, `PhD student`; `linkedin:` links the name to a public profile) |
| Publications | run `python3 scripts/publications.py` (see below), do not edit `_data/publications.json` by hand |
| Fix or exclude a publication | `_data/publications_manual.json` (`exclude` a DOI, or `add` an entry) then rerun the script |
| Add a news post | create `_posts/YYYY-MM-DD-short-title.md` with the front matter shown below. If it has an image (a JPEG whose name ends in lowercase `.jpg`; on an iPhone, export or share it as JPEG, not HEIC), run `python3 scripts/thumbs.py` afterwards and commit the `-thumb.jpg` it writes. That needs Pillow; a browser edit can skip it, and the news lists then show the full image until someone runs it |
| Research text, selected papers, funding logos | `research.html`, `_data/theme_papers.yml`, `_data/support.yml`, `assets/img/logos/` |
| Openings | `join.html` |
| Nav, footer, addresses | `_layouts/default.html` |
| Colours, type, spacing | `assets/css/style.css` (tokens at the top) |

Post front matter:

```yaml
---
title: "Congratulations Dr. Example!"   # keep the quotes: an unquoted colon fails the build
date: 2026-09-01    # goes live as soon as it is committed, even if this date is in the future
kind: people        # paper | award | people | group
image: /assets/img/news/2026-09-01-example.jpg   # optional; a JPEG ending in lowercase .jpg (not .JPG, .jpeg, .png or .heic); 1600px wide max, about 300 KB
image_width: 1400   # pixel size of the file, so the page does not jump while it loads
image_height: 561
image_caption: "Optional caption under the lead photo"
image_alt: "Describe the image when it is the news itself (a journal cover, a contest image); leave out for decorative photos or when the caption already says what it is"
excerpt: "Optional one-sentence teaser for the news list; otherwise the first paragraph is cut at 32 words"
link: https://doi.org/...                         # optional; adds a "Read the paper" link (kind: paper) or "Read more", unless the body already links it
---
Body text in markdown.
```

## Updating publications

```
python3 scripts/publications.py
```

Fetches every work for Jonathan Rivnay from OpenAlex, keeps journal articles and book chapters, drops preprints and duplicates, applies `_data/publications_manual.json`, and rewrites `_data/publications.json`. It prints a report of anything it excluded or could not match. Needs only Python 3, no packages.

## Preview locally

Requires Ruby 3+ and Jekyll (`brew install ruby`, then `gem install jekyll jekyll-seo-tag jekyll-redirect-from jekyll-sitemap jekyll-feed webrick`), then put the gem bin directory on your PATH (brew prints this too): `echo 'export PATH="$(gem env gemdir)/bin:$PATH"' >> ~/.zshrc`, and open a new terminal.

```
jekyll serve
```

Then open http://127.0.0.1:4000/.

After `jekyll build`, `python3 scripts/check_links.py` reports any internal link or asset that does not resolve.

Old Squarespace URLs redirect via `redirect_from:` in each post and page; `python3 scripts/redirects.py` regenerates the post entries from `scripts/old-site-sitemap.xml`.

## Domain

rivnay.northwestern.edu is a CNAME to rivnay-group.github.io (set by Northwestern IT), the `CNAME` file in this repo names it, and "Enforce HTTPS" is on under Settings -> Pages. The domain is verified for the Rivnay-Group org (Organization settings -> Pages); the DNS TXT record `_github-pages-challenge-rivnay-group.rivnay.northwestern.edu` must stay, so ask IT not to remove it. Nothing else to do unless the repo moves; then change `url:` in `_config.yml`, the `CNAME` file and the DNS record together.

www.rivnay.northwestern.edu is still a CNAME to Squarespace, which redirects it here. Before cancelling Squarespace, have IT point www at rivnay-group.github.io (or an NU redirect).
