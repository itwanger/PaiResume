export const AUTHENTICATED_HOME_PATH = '/dashboard'

export const RESUME_CREATE_PATH = '/dashboard?create=1'

export const RESUME_EDITOR_ENTRY_PATH = '/editor'

export function buildResumeEditorPath(resumeId: number | string) {
  return `/editor/${resumeId}?moduleType=basic_info`
}

export const GITHUB_REPOSITORY_URL = 'https://github.com/itwanger/PaiResume'
