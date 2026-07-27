import {
  RESUME_CREATE_PATH,
  buildResumeEditorPath,
} from '../config/site'

export const RESUME_TITLE_MAX_LENGTH = 128

export function normalizeResumeTitle(value: string): string {
  return value.trim()
}

export function getResumeImportTitle(title: string, fileName: string): string {
  const normalizedTitle = normalizeResumeTitle(title)
  const fileNameWithoutExtension = fileName
    .replace(/\.[^./\\]+$/, '')
    .trim()
  const resolvedTitle = normalizedTitle || fileNameWithoutExtension || '导入的简历'
  const truncatedTitle = resolvedTitle.slice(0, RESUME_TITLE_MAX_LENGTH)
  const lastCodeUnit = truncatedTitle.charCodeAt(truncatedTitle.length - 1)

  return lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF
    ? truncatedTitle.slice(0, -1)
    : truncatedTitle
}

export function getResumeTitleError(value: string): string | null {
  const normalizedTitle = normalizeResumeTitle(value)

  if (!normalizedTitle) {
    return '请输入简历名称'
  }

  if (normalizedTitle.length > RESUME_TITLE_MAX_LENGTH) {
    return `简历名称不能超过 ${RESUME_TITLE_MAX_LENGTH} 个字符`
  }

  return null
}

export function hasResumeCreateIntent(search: string): boolean {
  return new URLSearchParams(search).get('create') === '1'
}

export function getResumeEditorEntryPath(
  resumeList: Array<{ id: number }>,
): string {
  const mostRecentlyUpdatedResume = resumeList[0]
  return mostRecentlyUpdatedResume
    ? buildResumeEditorPath(mostRecentlyUpdatedResume.id)
    : RESUME_CREATE_PATH
}
