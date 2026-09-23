# Derived image manifest

Generated from lab originals; sources are not modified. Every raster listed below is EXIF-transposed to RGB and at most 1600 px on the long edge. JPEGs start at quality 82 and step down one point at a time until the file is at or under the size cap of 300,000 bytes (the spec's "about 300 KB"); the quality actually used is in the Notes column. The video poster is the first frame (frame 0) so autoplay does not jump.

| File | Source | Dimensions | Bytes | Notes |
|---|---|---|---|---|
| `img/og-image.jpg` | `img/research/giwaxs-poster.jpg` (frame 0 of the P3MEEET GIWAXS clip) | 1200x630 | 33261 | bottom-weighted crop for social previews |
| `img/research/giwaxs-poster.jpg` | `website/science photos/GIWAXS_P3MEEET_HighMw_NaCl.mp4` | 1029x1064 | 60,386 | frame 0 (t=0) decoded with cv2, cropped to the 1029 px display width; q82 |
| `video/giwaxs-p3meeet.mp4` | `website/science photos/GIWAXS_P3MEEET_HighMw_NaCl.mp4` | 1029x1064 (5 s) | 1,884,203 | byte-identical copy, 5 s |
| `img/research/pedot-fiber-histology.jpg` | `website/science photos/PEDOT fiber in ESKM_Masson_s trichrome staining.tif` | 1600x1200 | 297,132 | full frame; q71 |
| `img/research/organoid-die.jpg` | `website/organoid sensor/on wafer/full die.png` | 1600x1067 | 161,420 | full frame; q82 |
| `img/research/organoid-assembly.jpg` | `website/organoid sensor/full assembly/1.png` | 1600x1067 | 225,496 | 3:2 crop (1489,876)-(6745,4380) centred on holder and gloved hand; q82 |
| `img/research/cell-clusters.jpg` | old site home page image `Rat 3 009 Merged (002).png` (922x922) | 922x922 | 216,127 | Living electronics section; saved at q86 |
| `img/research/pedot-eskm-if.jpg` | `science photos/xinran's photos/no scalebar label/PEDOT_whole ESKM_IF_3.png` (2086x842) | 1600x646 | 191558 | Living electronics section; scale bar 1 mm per the caption |
| `img/research/oxygen-chips.jpg` | `hero/1 (1).png` (6000x4000) | 1600x1067 | 127512 | Oxygen-generation devices; Sensors & circuits section, paired with the die |
| `img/research/giwaxs-low-poster.jpg` | frame 0 of `GIWAXS_P3MEEET_LowMw_NaCl.mp4` (copied to `video/giwaxs-p3meeet-low.mp4`) | 1030x1064 | 34021 | Fundamentals section, full frame (the detector band is acceptable here per the user) |
