# Derived image manifest

Generated from lab originals; sources are not modified. Unless its Notes say otherwise, every raster listed below is EXIF-transposed to RGB and at most 1600 px on the long edge. JPEGs start at quality 82 and step down one point at a time until the file is at or under the size cap of 300,000 bytes (the spec's "about 300 KB"); the quality actually used is in the Notes column. The video poster is the first frame (frame 0) so autoplay does not jump.

| File | Source | Dimensions | Bytes | Notes |
|---|---|---|---|---|
| `img/og-image.jpg` | `img/research/giwaxs-poster.jpg` (frame 0 of the P3MEEET GIWAXS clip) | 1200x630 | 33261 | bottom-weighted crop for social previews |
| `img/research/giwaxs-poster.jpg` | `website/science photos/GIWAXS_P3MEEET_HighMw_NaCl.mp4` | 1029x368 | 21,128 | frame 0 (t=0) decoded with cv2, cropped to the 1029 px display width, then to the hero band (0,556)-(1029,924); q82 |
| `video/giwaxs-p3meeet.mp4` | `website/science photos/GIWAXS_P3MEEET_HighMw_NaCl.mp4` | 1030x368 (5 s) | 241,928 | the hero band only: `ffmpeg -vf crop=1030:368:0:556 -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -an -movflags +faststart`; 72 fps, 5 s, as the 1030x1064 source |
| `img/research/pedot-fiber-histology.jpg` | `website/science photos/PEDOT fiber in ESKM_Masson_s trichrome staining.tif` | 1600x1200 | 297,132 | full frame; q71 |
| `img/research/organoid-die.jpg` | `website/organoid sensor/on wafer/full die.png` | 1600x1067 | 161,420 | full frame; q82 |
| `img/research/organoid-assembly.jpg` | `website/organoid sensor/full assembly/1.png` | 1600x1067 | 225,496 | 3:2 crop (1489,876)-(6745,4380) centred on holder and gloved hand; q82 |
| `img/research/cell-clusters.jpg` | old site home page image `Rat 3 009 Merged (002).png` (922x922) | 922x922 | 216,127 | Living electronics section; saved at q86 |
| `img/research/pedot-eskm-if.jpg` | `science photos/xinran's photos/no scalebar label/PEDOT_whole ESKM_IF_3.png` (2086x842) | 1600x646 | 191558 | Living electronics section; scale bar 1 mm per the caption |
| `img/research/oxygen-chips.jpg` | `hero/1 (1).png` (6000x4000) | 1600x1067 | 127512 | Oxygen-generation devices; Sensors & circuits section, paired with the die |
| `img/research/giwaxs-low-poster.jpg` | frame 0 of `GIWAXS_P3MEEET_LowMw_NaCl.mp4` (copied to `video/giwaxs-p3meeet-low.mp4`) | 1030x1064 | 34021 | Fundamentals section, full frame (the detector band is acceptable here per the user) |
| `img/hero/oxygen-chips-portrait.jpg` | `img/hero/oxygen-chips.jpg` (2800x1000) | 1400x1000 | 103,652 | portrait screens; crop at x=700; q82, as its source |
| `img/hero/fibers-portrait.jpg` | `img/hero/fibers.jpg` (2800x1000) | 1400x1000 | 106,003 | portrait screens; crop at x=952, which keeps the still's 68% framing; q80, as its source |
| `img/hero/d7-die-portrait.jpg` | `img/hero/d7-die.jpg` (2800x1000) | 1400x1000 | 318,862 | portrait screens; crop at x=700; q72, as its source, which is also over the size cap |
| `img/research/pedot-eskm-if-1040.jpg` | `img/research/pedot-eskm-if.jpg` | 1040x420 | 64,893 | 1040w srcset copy; q82 |
| `img/research/organoid-die-1040.jpg` | `img/research/organoid-die.jpg` | 1040x694 | 71,898 | 1040w srcset copy; q82 |
| `img/research/oxygen-chips-1040.jpg` | `img/research/oxygen-chips.jpg` | 1040x694 | 60,164 | 1040w srcset copy; q82 |
| `img/research/organoid-assembly-1040.jpg` | `img/research/organoid-assembly.jpg` | 1040x694 | 111,614 | 1040w srcset copy; q82 |
| `img/research/pedot-fiber-histology-1040.jpg` | `img/research/pedot-fiber-histology.jpg` | 1040x780 | 202,145 | 1040w srcset copy; q82 |
| `img/research/shiny-spedot.jpg` | the previous 1200x1600 file, resized in place | 750x1000 | 161,072 | never shown wider than 368 CSS px; q82 |
| `img/team-2026-2160.jpg` | the 4032x2268 group photo original | 2160x1080 | 714,787 | same crop (0,180)-(4032,2196) as `team-2026.jpg`, LANCZOS; q82; over the 1600 px and size caps so 2x laptop screens stay sharp |
| `img/people/jonathan-rivnay.jpg` | the previous 600x600 file, downscaled in place | 400x400 | 21,405 | 2x the 200 px PI photo; `ImageOps.fit`, LANCZOS; q82 |
| `img/people/*.jpg` (the other 28) | the previous 600x600 files, downscaled in place | 324x324 | 470,052 in total (11,868-23,233 each) | 2x the 162 px headshot; `ImageOps.fit`, LANCZOS; q82. The 600 px files stay in git history, and for the older photos they are the only masters |
| `img/news/2019-08-19-our-post-doc-bryan-recently-reviewed-mixed-ionicelectronic.jpg` | the old site's lead image (commit d076f50) | 1065x1347 | 317,686 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |
| `img/news/2019-12-19-self-aligned-laser-cut-organic-electrochemical-transistors.jpg` | the old site's lead image (commit d076f50) | 784x1098 | 138,820 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |
| `img/news/2020-01-29-new-jove-video-article-led-by-the-shull-group-and-our-own.jpg` | the old site's lead image (commit d076f50) | 1072x1324 | 215,129 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |
| `img/news/2020-06-24-bryan-and-reem-also-have-published-a-review-article.jpg` | the old site's lead image (commit d076f50) | 914x1212 | 152,571 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |
| `img/news/2020-06-24-our-lab-has-published-two-review-papers-recently.jpg` | the old site's lead image (commit d076f50) | 984x1306 | 202,940 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |
| `img/news/2021-05-12-xudongs-nature-communications-paper-featured-in-northwestern.jpg` | the old site's lead image (commit d076f50) | 1298x1426 | 166,976 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |
| `img/news/2021-08-30-bryan-and-reem-collaborated-on-a-published-study-in-journal.jpg` | the old site's lead image (commit d076f50) | 1116x1374 | 253,919 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |
| `img/news/2021-08-30-bryans-review-published-in-annual-reviews-of-materials.jpg` | the old site's lead image (commit d076f50) | 1164x1364 | 146,072 | 7 px black frame from the old site cropped from every side; q85; its `-thumb.jpg` (208x156) regenerated with `scripts/thumbs.py` |

Whoever replaces a hero still must replace its `-portrait` crop too, and whoever replaces one of the five Research figures above must replace its `-1040` copy.

Removed: `img/news/2021-08-30-reem-xudong-and-professor-rivnay-have-published-a-review.jpg` and its `-thumb.jpg`. That post no longer has a lead image.
