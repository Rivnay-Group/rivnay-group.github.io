# Rivnay Group website

Source for the Rivnay Group site (Laboratory for Organic & Hybrid Bioelectronics, Northwestern University). Built with Jekyll and hosted on GitHub Pages. No JavaScript framework, one CSS file, content in data files.

Live: https://rivnay-group.github.io/ (moves to https://rivnay.northwestern.edu/ once Northwestern IT points the domain at GitHub)

## Editing content

Everything routine is a data file or a markdown file. Edit on GitHub in the browser and commit; the site rebuilds in about a minute.

| To change | Edit |
|---|---|
| A person, their role, email or bio | `_data/people.yml` (one entry per person, grouped by the `group` key) |
| Add a headshot | drop a square JPEG (600×600 works well) in `assets/img/people/` and reference it as `photo:` |
| Alumni | `_data/alumni.yml` (`now:` is the institution or company; add `role:` only for academic destinations, e.g. `faculty`, `postdoc`, `PhD student`; `linkedin:` links the name to a public profile) |
| Publications | run `python3 scripts/publications.py` (see below), do not edit `_data/publications.json` by hand |
| Fix or exclude a publication | `_data/publications_manual.json` (`exclude` a DOI, or `add` an entry) then rerun the script |
| Add a news post | create `_posts/YYYY-MM-DD-short-title.md` with the front matter shown below |
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
image: /assets/img/news/2026-09-01-example.jpg   # optional, 1400px wide max
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

Requires Ruby 3+ and Jekyll (`brew install ruby`, then `gem install jekyll jekyll-seo-tag webrick`).

```
jekyll serve
```

Then open http://127.0.0.1:4000/.

## Custom domain (rivnay.northwestern.edu)

1. Ask Northwestern IT to point `rivnay.northwestern.edu` at GitHub Pages with a CNAME record to `rivnay-group.github.io`.
2. In this repo: add a file named `CNAME` containing `rivnay.northwestern.edu`, and change `baseurl` in `_config.yml` to `""`.
3. In GitHub → Settings → Pages, enter the custom domain and enable "Enforce HTTPS" once the certificate is issued.

GitHub's guide: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
