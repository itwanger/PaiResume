/** 中文逐字、英文单词（含技术名词中的数字）按一字计数；忽略空白。 */
export function countDisplayCharacters(value: string): number {
  return value.match(/[A-Za-z][A-Za-z0-9]*(?:['’-][A-Za-z0-9]+)*|[^\s]/gu)?.length ?? 0
}
