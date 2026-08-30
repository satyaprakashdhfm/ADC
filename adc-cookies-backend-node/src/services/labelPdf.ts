/*
 * Re-stamp Delhivery's shipping label onto a real 4x6 page.
 *
 * WHY THIS EXISTS. Their `pdf=true` label is mis-composed and no parameter we send fixes it:
 * `pdf_size=4R` is ignored on that path (verified 2026-08-30 — the request went out as 4R and the
 * PDF still measured 595x842pt, A4 exactly). The page's entire content stream is
 *
 *   q 0 J 1 w 0 j 0 G 0 g q 0.9470 0 0 1.0131 -230.0000 217.0000 cm /GOFPDITPL0 Do Q Q
 *
 * — one form XObject whose BBox is 792x612 (US Letter, LANDSCAPE) stamped onto an A4 PORTRAIT page,
 * under a non-uniform scale and a negative x offset. So the label lands in the top-left corner
 * occupying about 41% of the width, and a thermal roll gets mostly blank paper.
 *
 * We cannot re-render their design, but we can re-place it: crop to the label and scale it onto a
 * 288x432pt page, which is exactly 4x6in. Uniform scale only — squeezing it to fill the roll would
 * distort the barcodes.
 *
 * FRAGILE BY NATURE, so it fails soft. The crop is where their template puts the ink today,
 * measured by rasterising a real label; if they change the template it will crop wrongly, and
 * DELHIVERY_LABEL_CROP overrides it without a deploy. Any error at all returns the original bytes
 * untouched: a badly placed label still prints, a 500 loses the parcel.
 */
import { PDFDocument } from 'pdf-lib';

/** 4x6 inches at 72pt/in — the thermal roll. */
export const LABEL_W = 288;
export const LABEL_H = 432;

/*
 * Where the ink sits, as FRACTIONS of the page rather than points, so the crop survives their
 * page size changing (A4 vs Letter) as long as the layout does not. Measured on the label for
 * waybill 57064410000206: ink at x 23.3..267.3, y 414.3..833.3 of a 595x842 page.
 */
const DEFAULT_CROP = { x0: 0.0392, x1: 0.4492, y0: 0.4920, y1: 0.9897 };

/** A hair of padding so a hard crop never shaves the barcode's quiet zone. */
const PAD_PT = 3;

function crop() {
  const raw = (process.env.DELHIVERY_LABEL_CROP || '').trim();
  if (!raw) return DEFAULT_CROP;
  // "x0,x1,y0,y1" as fractions, e.g. "0.039,0.449,0.492,0.990"
  const n = raw.split(',').map((v) => Number(v.trim()));
  const [x0, x1, y0, y1] = n;
  const bad = n.length !== 4 ||
    [x0, x1, y0, y1].some((v) => v === undefined || !Number.isFinite(v) || v < 0 || v > 1) ||
    x0! >= x1! || y0! >= y1!;
  if (bad) {
    console.warn(`[LABEL] ⚠ DELHIVERY_LABEL_CROP unusable (${raw}) — using the measured default`);
    return DEFAULT_CROP;
  }
  return { x0: x0!, x1: x1!, y0: y0!, y1: y1! };
}

/**
 * Returns a 4x6 PDF, or the input unchanged if anything about it is not what we expect.
 * Never throws.
 */
export async function to4x6(bytes: Uint8Array): Promise<{ bytes: Uint8Array; converted: boolean; note: string }> {
  const keep = (note: string) => ({ bytes, converted: false, note });
  try {
    const src = await PDFDocument.load(bytes);
    if (src.getPageCount() !== 1) return keep(`skipped: ${src.getPageCount()} pages`);

    const page = src.getPage(0);
    const { width: pw, height: ph } = page.getSize();
    const c = crop();

    // Clamp to the page: a crop that runs off the edge would embed blank space.
    const left = Math.max(0, c.x0 * pw - PAD_PT);
    const right = Math.min(pw, c.x1 * pw + PAD_PT);
    const bottom = Math.max(0, c.y0 * ph - PAD_PT);
    const top = Math.min(ph, c.y1 * ph + PAD_PT);
    const cw = right - left;
    const ch = top - bottom;
    if (cw < 20 || ch < 20) return keep(`skipped: crop degenerate (${cw.toFixed(0)}x${ch.toFixed(0)})`);

    const out = await PDFDocument.create();
    const embedded = await out.embedPage(page, { left, bottom, right, top });

    // Uniform scale, centred. Fitting to BOTH axes independently would stretch the barcodes.
    const scale = Math.min(LABEL_W / cw, LABEL_H / ch);
    const w = cw * scale;
    const h = ch * scale;
    const sheet = out.addPage([LABEL_W, LABEL_H]);
    sheet.drawPage(embedded, { x: (LABEL_W - w) / 2, y: (LABEL_H - h) / 2, width: w, height: h });

    const result = await out.save();
    return {
      bytes: result,
      converted: true,
      note: `${pw.toFixed(0)}x${ph.toFixed(0)} → crop ${cw.toFixed(0)}x${ch.toFixed(0)} → 288x432 @${scale.toFixed(3)}`,
    };
  } catch (err: any) {
    return keep(`unchanged: ${err.message}`);
  }
}
