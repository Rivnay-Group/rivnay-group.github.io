#!/usr/bin/env python3
# Rebuild the publication list for the Rivnay Group site. Standard library only.
#
#   python3 scripts/publications.py                       # live fetch from OpenAlex
#   python3 scripts/publications.py --from-json dump.json # offline, from a saved dump
#
# Writes _data/publications.json and prints a diff report to stdout; keep it with
#   python3 scripts/publications.py > docs/superpowers/specs/publications-report.txt
# Hand edits go in _data/publications_manual.json ("exclude" DOIs/OpenAlex ids,
# "add" entries in the same shape as publications.json, "oa_via_doi" DOIs whose
# open-access link should be the DOI), never in publications.json. It refuses to
# shrink the list by more than 10% (an empty or partial OpenAlex reply); --force
# overrides.
"""Publication pipeline for the Rivnay Group (OpenAlex author A5066036682).

Filter rules (spec: docs/superpowers/specs/2026-09-06-rivnay-lab-site-design.md,
"Publication pipeline rules"):
  1. keep type in {article, book-chapter, review}; drop preprint, dataset, erratum,
     peer-review, conference-abstract, conference-paper, editorial, other, paratext
  2. drop works whose primary_location.source.type is "repository"
  3. drop is_retracted
  4. drop anything listed in publications_manual.json "exclude" (DOI or OpenAlex id)
  5. dedupe by normalised title (lowercase, alphanumerics only), keeping the copy
     with a journal source, then one with a DOI, then the fullest biblio, then
     the earliest publication date
  6. append publications_manual.json "add" entries, replacing any with the same DOI
  7. pre_northwestern = year < 2017, or the manual entry says so
  8. sort by year desc, then publication_date desc (created_date where OpenAlex
     pads a year-only date to Jan 1)
Authors are "initials + surname" (J. Rivnay, J.-P. Dupont, E. van Doremaele), all
authors listed. Titles lose trailing periods and HTML entities. "oa" is a link to
a free copy when OpenAlex knows of one.
"""
import argparse
import difflib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_data" / "publications.json"
MANUAL = ROOT / "_data" / "publications_manual.json"
OLD_LIST = ROOT / "scripts" / "old-site-publications.txt"

AUTHOR = "A5066036682"
FIELDS = ("id,doi,title,display_name,publication_year,publication_date,type,"
          "primary_location,authorships,biblio,ids,open_access,is_retracted,created_date")
API = ("https://api.openalex.org/works?filter=author.id:%s&per-page=200&cursor=%%s"
       "&select=%s" % (AUTHOR, FIELDS))

KEEP_TYPES = {"article", "book-chapter", "review"}
PARTICLES = {"van", "de", "der", "den", "von", "da", "di", "del", "della", "la",
             "le", "du", "dos", "das", "el", "al", "ten", "ter", "y"}
SUFFIXES = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}
REVIEW_JOURNAL = re.compile(r"bulletin|magazine|government|abstracts|news", re.I)

# Old-site titles that are working/preprint titles of a paper OpenAlex holds under
# its published title (fuzzy match fails). old title -> OpenAlex id.
ALIASES = {
    "PEDOT-NHS as a Versatile Conjugated Polyelectrolyte for Bioelectronics": "W4313421854",
    "Sodium and potassium selective conjugated polymers for optical solid state sensors": "W2223366270",
    "Enhanced and tunable ion mobility in hydrophilic and biocompatible conducting polymer composites": "W2110979089",
    "General fabrication of polymer multielectrode arrays": "W2028671743",
}

JOURNALS = {  # OpenAlex display_name drops the colon (and JVST B's commas)
    "Journal of Polymer Science Part B Polymer Physics": "Journal of Polymer Science Part B: Polymer Physics",
    "Journal of Vacuum Science & Technology B Microelectronics and Nanometer Structures Processing Measurement and Phenomena": "Journal of Vacuum Science & Technology B",
}

# Compound surnames that fmt_author splits (it takes the last word as the surname).
AUTHOR_FIX = {"J. P. I. Tarrés": "J. Pons i Tarrés", "I. E. M. Mahfoud": "I. E. Miniel Mahfoud",
              "T. C. H. Castillo": "T. C. Hidalgo Castillo"}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def short_id(s):
    return (s or "").rsplit("/", 1)[-1]


def norm_doi(s):
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", (s or "").strip(), flags=re.I).lower() or None


def fetch_live():
    works, cursor = [], "*"
    while cursor:
        req = urllib.request.Request(API % urllib.parse.quote(cursor),
                                     headers={"User-Agent": "rivnay-lab-site/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.load(r)
        works += page["results"]
        cursor = page["meta"].get("next_cursor")
        print("fetched %d works" % len(works), file=sys.stderr)
    return works


def clean_title(t):
    t = html.unescape(t or "")
    t = re.sub(r"<[^>]+>", "", t).replace("‐", "-").replace("‑", "-")
    t = re.sub(r"(?<=\w)-\s+(\w{1,4})\s+-(?=\w)", r"-\1-", t)  # "- co -" -> "-co-"
    t = re.sub(r"\s+-(?=\w)", "-", t)                       # "n ‐Type" -> "n-Type"
    return re.sub(r"\s+", " ", t).strip().rstrip(".").strip()


def fmt_author(raw):
    name = html.unescape(raw or "").replace("‐", "-").replace("‑", "-").strip()
    if "," in name:
        last, first = name.split(",", 1)
        name = first.strip() + " " + last.strip()
    toks = name.split()
    if len(toks) < 2:
        return name
    suffix = toks.pop() if toks[-1].lower() in SUFFIXES and len(toks) > 2 else ""
    i = len(toks) - 1
    while i > 1 and toks[i - 1].lower() in PARTICLES and (toks[i - 1].islower() or len(toks) > 2):
        i -= 1

    def ini(tok):
        out = []
        for p in tok.split("-"):
            p = p.replace(".", "")
            if p:
                out.append(". ".join(p) + "." if p.isupper() and len(p) <= 3 else p[0].upper() + ".")
        return "-".join(out)

    parts = [ini(t) for t in toks[:i]] + [" ".join(toks[i:])] + ([suffix] if suffix else [])
    return " ".join(parts)


def pages(b):
    first, last = (b or {}).get("first_page"), (b or {}).get("last_page")
    if first and last and first != last:
        return "%s-%s" % (first, last)
    return first or last or None


def to_entry(w):
    loc = w.get("primary_location") or {}
    src = loc.get("source") or {}
    b = w.get("biblio") or {}
    d = w.get("publication_date") or ""
    c = (w.get("created_date") or "")[:10]   # OpenAlex pads year-only dates (RSC) to Jan 1
    if d.endswith("-01-01") and c[:4] == d[:4]:
        d = c
    names = (fmt_author(a.get("raw_author_name") or (a.get("author") or {}).get("display_name"))
             for a in w.get("authorships") or [])
    j = src.get("display_name") or loc.get("raw_source_name") or None
    oa = re.sub(r"^http://", "https://", (w.get("open_access") or {}).get("oa_url") or "")
    return {
        "year": w.get("publication_year"),
        "authors": ", ".join(AUTHOR_FIX.get(n, n) for n in names),
        "title": clean_title(w.get("title") or w.get("display_name")),
        "journal": JOURNALS.get(j, j),
        "volume": b.get("volume") or None,
        "issue": b.get("issue") or None,
        "pages": pages(b),
        "doi": norm_doi(w.get("doi")),
        "oa": oa if oa.startswith("https://") else None,   # a free copy, where OpenAlex knows one; web links only
        "openalex": short_id(w.get("id")),
        "pre_northwestern": (w.get("publication_year") or 0) < 2017,
        "_date": d,
        "_journal_src": src.get("type") == "journal",
    }


def build(works, manual):
    excluded = {norm_doi(x) for x in manual.get("exclude", [])} | {short_id(x).lower() for x in manual.get("exclude", [])}
    oa_doi = {norm_doi(x) for x in manual.get("oa_via_doi", [])}
    kept, dropped, excl = [], [], []
    for w in works:
        loc = w.get("primary_location") or {}
        src_type = (loc.get("source") or {}).get("type")
        if w.get("type") not in KEEP_TYPES or src_type == "repository" or w.get("is_retracted"):
            dropped.append(w)
        elif short_id(w.get("id")).lower() in excluded or (norm_doi(w.get("doi")) or "") in excluded:
            excl.append(w)
        else:
            kept.append(w)

    by_title = {}
    for e in map(to_entry, kept):
        by_title.setdefault(norm(e["title"]), []).append(e)
    entries = []
    for group in by_title.values():
        # German "Angewandte Chemie" copies of Int. Ed. papers sort last
        group.sort(key=lambda e: (not e["_journal_src"], not e["doi"], e["journal"] == "Angewandte Chemie",
                                  -sum(1 for k in ("volume", "issue", "pages") if e[k]), e["_date"], e["openalex"]))
        entries.append(group[0])

    for m in manual.get("add", []):
        e = {"year": None, "authors": "", "title": "", "journal": None, "volume": None, "issue": None,
             "pages": None, "doi": None, "oa": None, "openalex": None, "pre_northwestern": False}
        e.update(m)
        e["doi"] = norm_doi(e["doi"])
        if e["doi"]:  # the hand-made copy wins over an OpenAlex copy with the same DOI
            entries = [x for x in entries if x["doi"] != e["doi"]]
        e["pre_northwestern"] = bool(e["pre_northwestern"]) or (e["year"] or 0) < 2017
        e["_date"] = ""
        entries.append(e)

    entries.sort(key=lambda e: ((e["year"] or 0), e["_date"]), reverse=True)
    for e in entries:
        if e["doi"] in oa_doi:
            e["oa"] = "https://doi.org/" + e["doi"]
        e.pop("_date", None)
        e.pop("_journal_src", None)
    return entries, dropped, excl


def old_site_titles():
    text = OLD_LIST.read_text(encoding="utf-8")
    head, _, tail = text.partition("Pre-Northwestern publications")
    out = []
    for section, chunk in (("2017-2024", head), ("pre-NU", tail)):
        for m in re.finditer(r"[“\"]([^”\"]+?)[”\"]", chunk):
            t = re.sub(r"\s+", " ", m.group(1)).strip().strip(",. ").strip()
            if len(t) > 8:
                out.append((section, t))
    return out


def best_match(old, entries):
    alias = ALIASES.get(old)
    if alias:
        return next((e for e in entries if e["openalex"] == alias), None), 1.0
    n = norm(old)
    best, score = None, 0.0
    for e in entries:
        m = norm(e["title"])
        r = difflib.SequenceMatcher(None, n, m).ratio()
        contained = len(min(n, m, key=len)) >= 20 and (n in m or m in n)
        if (r >= 0.85 or contained) and r > score:
            best, score = e, r
    return best, score


def desc(w):
    loc = w.get("primary_location") or {}
    src = loc.get("source") or {}
    return "%s | %s | %s | src=%s | %s | %s" % (short_id(w["id"]), w.get("publication_year"), w.get("type"),
                                                src.get("type"), src.get("display_name"), clean_title(w.get("title"))[:90])


def report(entries, dropped, excl, works):
    old = old_site_titles()
    unmatched = 0
    print("== Old-site entries (%s) ==" % OLD_LIST.relative_to(ROOT))
    for section, title in old:
        e, score = best_match(title, entries)
        if e is None:
            unmatched += 1
            print("[%s] UNMATCHED  %s" % (section, title))
        else:
            how = "manual add" if e["openalex"] is None else e["openalex"]
            print("[%s] MATCHED    %s\n    -> %s (%s, %.2f) %s" % (section, title, how, e["year"], score, e["title"]))
    print("\nOld entries: %d, unmatched: %d\n" % (len(old), unmatched))

    print("== Kept 2025-2026 entries (eyeball these) ==")
    for e in entries:
        if (e["year"] or 0) >= 2025:
            print("%s | %s | %s | %s | %s" % (e["year"], e["authors"], e["title"], e["journal"], e["doi"]))

    print("\n== REVIEW (article with no source, or magazine-looking journal) ==")
    kept_ids = {e["openalex"] for e in entries}
    excl_ids = {short_id(w["id"]) for w in excl}
    for w in works:
        src = (w.get("primary_location") or {}).get("source") or {}
        if w.get("type") == "article" and (src.get("type") is None or REVIEW_JOURNAL.search(src.get("display_name") or "")):
            wid = short_id(w["id"])
            status = "KEPT" if wid in kept_ids else "EXCLUDED" if wid in excl_ids else "DROPPED"
            print("%-8s %s" % (status, desc(w)))

    print("\n== EXCLUDED via publications_manual.json ==")
    for w in excl:
        print(desc(w))

    print("\n== DROPPED by type/source/retraction ==")
    for w in dropped:
        print(desc(w))

    years = {}
    for e in entries:
        years[e["year"]] = years.get(e["year"], 0) + 1
    print("\n== Counts ==")
    print("kept %d (pre-Northwestern %d, manual adds %d, excluded %d, dropped %d, unmatched old entries %d)" % (
        len(entries), sum(e["pre_northwestern"] for e in entries), sum(e["openalex"] is None for e in entries),
        len(excl), len(dropped), unmatched))
    print("per year: " + ", ".join("%s: %d" % (y, n) for y, n in sorted(years.items(), reverse=True)))
    return unmatched


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from-json", metavar="PATH", help="use a saved OpenAlex dump instead of fetching")
    ap.add_argument("--force", action="store_true", help="write even if the list shrinks by more than 10%%")
    args = ap.parse_args()
    works = json.load(open(args.from_json, encoding="utf-8")) if args.from_json else fetch_live()
    if isinstance(works, dict):
        works = works["results"]
    manual = json.load(open(MANUAL, encoding="utf-8")) if MANUAL.exists() else {}
    entries, dropped, excl = build(works, manual)
    old = len(json.load(open(OUT, encoding="utf-8"))) if OUT.exists() else 0
    if len(entries) < 0.9 * old and not args.force:
        sys.exit("refusing to replace %d entries with %d; check the OpenAlex reply, or rerun with --force" % (old, len(entries)))
    OUT.write_text(json.dumps(entries, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote %s (%d entries from %d works)\n" % (OUT.relative_to(ROOT), len(entries), len(works)))
    report(entries, dropped, excl, works)


def _selfcheck():
    assert fmt_author("Rivnay, Jonathan") == "J. Rivnay"
    assert fmt_author("Jean-Pierre Dupont") == "J.-P. Dupont"
    assert fmt_author("Eveline R. W. van Doremaele") == "E. R. W. van Doremaele"
    assert fmt_author("Anthony J. Petty II") == "A. J. Petty II"
    assert fmt_author("R.M. Owens") == "R. M. Owens"
    assert fmt_author("Di Zhu") == "D. Zhu"
    assert fmt_author("Enzo Di Fabrizio") == "E. Di Fabrizio"
    assert clean_title("n ‐Type OMIECs.") == "n-Type OMIECs"
    assert clean_title("indacenodithiophene- co -benzothiadiazole") == "indacenodithiophene-co-benzothiadiazole"
    assert clean_title("From p‐ to n‐Type") == "From p- to n-Type"
    assert pages({"first_page": "1", "last_page": "9"}) == "1-9"
    assert pages({"first_page": "e12", "last_page": "e12"}) == "e12"
    assert pages({"first_page": None, "last_page": None}) is None
    assert to_entry({"open_access": {"oa_url": "http://hdl.handle.net/1"}})["oa"] == "https://hdl.handle.net/1"
    assert to_entry({"open_access": {"oa_url": "javascript:alert(1)"}})["oa"] is None
    assert to_entry({"publication_date": "2026-01-01", "created_date": "2026-09-16T00:00:00"})["_date"] == "2026-09-16"


if __name__ == "__main__":
    _selfcheck()
    main()
