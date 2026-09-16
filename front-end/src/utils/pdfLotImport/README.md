# PDF lot detection

The detector returns unselected candidates for human review. It does not create database records or place the plan on the satellite map.

## Reading different CAD exports

- `paths.js` retains stroked vector paths and identifies individual curved subpaths. Filled glyphs, invisible strokes and dashed guides are excluded.
- `planSymbols.js` identifies small numbered circles as block annotations. It fits adjoining printed lines to restore junctions hidden by these circles; other curves remain parcel boundaries.
- `geometry.js` reconstructs enclosed faces. Short divider gaps can extend along their original direction to an existing boundary, capped at 1.4 page points and 5% of divider length. Unrelated nearby corners are not joined.
- `labels.js` reads explicit lot/area labels, supported CAD font encodings, and rotated text positions. Joined numeric runs receive approximate positions and an additional review warning.
- Numeric plans require repeated spatial lot/area pairs in the text's own orientation. Numeric value alone does not determine whether `80` is a lot number or an area. Both members of a pair must lie in the same face.
- `tableRegions.js` removes connected table cells. A summary table does not exclude lots elsewhere at the same vertical position.
- A face containing multiple lot labels is omitted instead of becoming one merged lot. Block suggestions follow adjoining boundaries and nearby block symbols. Duplicate identities remain flagged for correction.

## Saved drafts

Increment `PDF_LOT_DETECTOR_VERSION` when a detection change requires rescanning. Existing browser drafts retain their edits and receive a **Replace file** notice. Replacing the PDF runs detection again; it does not alter existing property records.

## Verification

Run the frontend tests from `front-end`:

```powershell
$env:CI = 'true'
node ../node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
```

The September 10, 2026 local regression check used page 1 of four client PDFs with the application's PDF.js 2.16.105 reader:

| Plan | Saleable candidates | Other candidates |
| --- | ---: | ---: |
| Lot 3847, Pagsanga-an, Pavia | 132 | 1 excluded area without a readable area |
| Lot 3896, Abilay Norte, Oton | 198 | 9 parks, facilities or excluded areas |
| Lot 18, Abilay Norte, Oton | 163 | 3 parks, facilities or excluded areas |
| Lot 4, Nanga, Guimbal | 213 | 9 parks, facilities or excluded areas |

These are detected shapes, not approved inventory totals. Some block/lot identifiers are duplicated or inferred, and surrounding cadastral labels are deliberately not treated as lots. All 728 candidate polygons passed the existing backend polygon and overlap checks after a sample coordinate projection. The client PDFs are local ignored files, so they are not dependencies of the automated test suite.

Scanned image PDFs, missing boundaries, unusual text layouts and unsupported clipping can still require manual tracing or corrections. Geometry remains a suggestion to check against the visible plan after alignment.

## Automatic map cutout

PDF upload now builds a transparent, non-rectangular cutout from detected parcel boundaries, including non-saleable areas. A bounded mask joins narrow internal road gaps and retains enclosed site areas while removing remote tables, title blocks and vicinity maps. The crop follows detected parcels; missing detections and roads outside their footprint can require adjustment.

The full original page and original PDF coordinates remain in the saved draft. Only the displayed satellite overlay is cropped, while the review screen uses the original page so its lot boxes remain aligned. Existing saved uploads are preserved; use **Replace file** to run automatic cutout on them.

When there are too few usable boundaries (including image-only scans), upload retains the full page. No lots are created automatically by cropping.

Local browser verification on September 15, 2026 covered the four sample plans above: automatic cutout retained all 728 detected candidates inside the crop bounds, produced transparent backgrounds and preserved the original images.
