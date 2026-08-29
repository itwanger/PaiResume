const MIN_PDF_PREVIEW_OUTPUT_SCALE = 2
const MAX_PDF_PREVIEW_OUTPUT_SCALE = 3

export function resolvePdfPreviewOutputScale(devicePixelRatio: number): number {
  const normalizedRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1

  return Math.min(
    MAX_PDF_PREVIEW_OUTPUT_SCALE,
    Math.max(MIN_PDF_PREVIEW_OUTPUT_SCALE, normalizedRatio),
  )
}
