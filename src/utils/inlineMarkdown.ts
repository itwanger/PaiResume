export interface InlineMarkdownSegment {
  text: string
  bold: boolean
}

export function parseInlineMarkdownSegments(value: string): InlineMarkdownSegment[] {
  if (!value) {
    return []
  }

  const segments: InlineMarkdownSegment[] = []
  let cursor = 0

  while (cursor < value.length) {
    const openIndex = value.indexOf('**', cursor)
    if (openIndex === -1) {
      segments.push({ text: value.slice(cursor), bold: false })
      break
    }

    if (openIndex > cursor) {
      segments.push({ text: value.slice(cursor, openIndex), bold: false })
    }

    const contentStart = openIndex + 2
    const closeIndex = value.indexOf('**', contentStart)

    if (closeIndex === -1) {
      segments.push({ text: value.slice(openIndex), bold: false })
      break
    }

    const boldText = value.slice(contentStart, closeIndex)
    if (boldText) {
      segments.push({ text: boldText, bold: true })
    } else {
      segments.push({ text: '****', bold: false })
    }

    cursor = closeIndex + 2
  }

  return segments.filter((segment) => segment.text.length > 0)
}
