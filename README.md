# Rivnay Group website

Source for the Rivnay Group site (Laboratory for Organic & Hybrid Bioelectronics, Northwestern University). Built with Jekyll and hosted on GitHub Pages. No JavaScript framework, one CSS file, content in data files.

Live: https://rivnay.northwestern.edu/

## Editing content

Everything routine is a data file or a markdown file. Edit on GitHub in the browser and commit; the site rebuilds in about a minute.

| To change | Edit |
|---|---|
| A person, their role, email or bio | `_data/people.yml` (one entry per person, grouped by the `group` key) |
| Add a headshot | drop a square JPEG (600×600 works well) in `assets/img/people/` and reference it as `photo:` |
| Alumni | `_data/alumni.yml` (`now:` is the institution or company; add `role:` only for academic destinations, e.g. `faculty`, `postdoc`, `PhD student`; `linkedin:` links the name to a public profile) |
| Publications | run `python3 scripts/publications.py` (see below), do not edit `_data/publications.json` by hand |
| Fix or exclude a publication | `_data/publications_manual.json` (`exclude` a DOI, or `add` an entry) then rerun the script |
| Add a news post | create `_posts/YYYY-MM-DD-short-title.md` with the front matter shown below. If it has an image, run `python3 scripts/thumbs.py` afterwards and commit the `-thumb.jpg` it writes |
| Research text, funding logos | `research.html`, `_data/support.yml`, `assets/img/logos/` |
| Openings | `join.html` |
| Nav, footer, addresses | `_layouts/default.html` |
| Colours, type, spacing | `assets/css/style.css` (tokens at the top) |

Post front matter:

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

## Updating publications

```
python3 scripts/publications.py
```

Fetches every work for Jonathan Rivnay from OpenAlex, keeps journal articles and book chapters, drops preprints and duplicates, applies `_data/publications_manual.json`, and rewrites `_data/publications.json`. It prints a report of anything it excluded or could not match. Needs only Python 3, no packages.

## Preview locally

Requires Ruby 3+ and Jekyll (`brew install ruby`, then `gem install jekyll jekyll-seo-tag jekyll-redirect-from jekyll-sitemap jekyll-feed webrick`).

```
jekyll serve
```

Then open http://127.0.0.1:4000/.

After `jekyll build`, `python3 scripts/check_links.py` reports any internal link or asset that does not resolve.

Old Squarespace URLs redirect via `redirect_from:` in each post and page; `python3 scripts/redirects.py` regenerates the post entries from `scripts/old-site-sitemap.xml`.

## Domain

rivnay.northwestern.edu is a CNAME to rivnay-group.github.io (set by Northwestern IT), the `CNAME` file in this repo names it, and "Enforce HTTPS" is on under Settings -> Pages. Nothing to do unless the repo moves; then change `url:` in `_config.yml`, the `CNAME` file and the DNS record together.
