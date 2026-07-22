import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  AUTHENTICATED_HOME_PATH,
  buildResumeEditorPath,
  GITHUB_REPOSITORY_URL,
  RESUME_EDITOR_ENTRY_PATH,
} from '../../config/site'
import { useAuthStore } from '../../store/authStore'
import { useResumeStore } from '../../store/resumeStore'
import { getResumeImporter, resumeImporters, type ResumeImportType } from '../../utils/importers'
import {
  CREATOR_MARKETPLACE_PATH,
  EXCELLENT_RESUMES_PATH,
} from '../../utils/navigation'
import { LogoMark } from '../branding/LogoMark'

const IMPORT_LOG_PREFIX = '[resume-import]'
const MARKDOWN_FILE_PATTERN = /\.(md|markdown|txt)$/i
const NAVBAR_EMAIL_VISIBLE_CHARACTERS = 7

function getNavbarEmailLabel(email?: string): string {
  const normalizedEmail = email?.trim() || '用户'
  const characters = Array.from(normalizedEmail)

  if (characters.length <= NAVBAR_EMAIL_VISIBLE_CHARACTERS) {
    return normalizedEmail
  }

  return `${characters.slice(0, NAVBAR_EMAIL_VISIBLE_CHARACTERS - 1).join('')}…`
}

function logImportStep(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`${IMPORT_LOG_PREFIX} ${message}`, details)
    return
  }

  console.info(`${IMPORT_LOG_PREFIX} ${message}`)
}

function isFileDragEvent(event: DragEvent): boolean {
  const types = event.dataTransfer?.types
  return Array.from(types ?? []).includes('Files')
}

function getImportTypeFromFile(file: File): ResumeImportType | null {
  if (
    MARKDOWN_FILE_PATTERN.test(file.name)
    || file.type === 'text/markdown'
    || file.type === 'text/plain'
  ) {
    return 'markdown'
  }

  return null
}

function navigationLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'text-sm font-medium transition-colors',
    isActive ? 'text-primary-700' : 'text-gray-600 hover:text-primary-700',
  ].join(' ')
}

interface HeaderProps {
  enableResumeDrop?: boolean
}

export function Header({ enableResumeDrop = false }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, initialized, logout } = useAuthStore()
  const { importResume } = useResumeStore()
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [importingType, setImportingType] = useState<ResumeImportType | null>(null)
  const [importError, setImportError] = useState('')
  const [draggingImportFile, setDraggingImportFile] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRefs = useRef<Partial<Record<ResumeImportType, HTMLInputElement | null>>>({})
  const dragDepthRef = useRef(0)
  const readyAuthenticated = initialized && isAuthenticated
  const resumeImportAvailable = readyAuthenticated
  const resumeDropEnabled = readyAuthenticated && enableResumeDrop
  const isVipUser = user?.membershipStatus === 'ACTIVE'
  const navbarEmailLabel = getNavbarEmailLabel(user?.email)
  const editorSectionActive = location.pathname === RESUME_EDITOR_ENTRY_PATH
    || location.pathname.startsWith(`${RESUME_EDITOR_ENTRY_PATH}/`)
    || location.pathname.startsWith('/preview/')
  const editorNavigationLinkClass = ({ isActive }: { isActive: boolean }) => (
    navigationLinkClass({ isActive: isActive || editorSectionActive })
  )
  const excellentSectionActive = location.pathname === EXCELLENT_RESUMES_PATH
    || location.pathname.startsWith('/showcases/')
    || location.pathname.startsWith('/marketplace/resumes/')
  const excellentNavigationLinkClass = ({ isActive }: { isActive: boolean }) => (
    navigationLinkClass({ isActive: isActive || excellentSectionActive })
  )

  const handleImportFile = useCallback(async (file: File, currentType: ResumeImportType) => {
    const importer = getResumeImporter(currentType)
    logImportStep('handleImportFile:start', {
      type: currentType,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      importerEnabled: importer?.enabled ?? false,
      hasParser: typeof importer?.parse === 'function',
    })

    if (!importer?.enabled || !importer.parse) {
      logImportStep('handleImportFile:importer-unavailable', {
        type: currentType,
      })
      setImportingType(null)
      setImportError('当前导入方式暂不可用')
      return
    }

    try {
      setImportingType(currentType)
      const payload = await importer.parse(file)
      logImportStep('handleImportFile:parse-success', {
        type: currentType,
        title: payload.title,
        moduleCount: payload.modules.length,
      })
      const resume = await importResume(payload)
      logImportStep('handleImportFile:store-import-success', {
        type: currentType,
        resumeId: resume.id,
      })
      navigate(buildResumeEditorPath(resume.id))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '导入失败，请稍后再试'
      logImportStep('handleImportFile:error', {
        type: currentType,
        message,
        error,
      })
      setImportError(message)
    } finally {
      logImportStep('handleImportFile:finish', {
        type: currentType,
      })
      setImportingType(null)
    }
  }, [importResume, navigate])

  useEffect(() => {
    if (!importMenuOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (menuRef.current && !menuRef.current.contains(target)) {
        setImportMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [importMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
    setImportMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!resumeDropEnabled) {
      setDraggingImportFile(false)
      dragDepthRef.current = 0
      return
    }

    const handleDragEnter = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return
      }

      event.preventDefault()
      if (importingType) {
        return
      }
      dragDepthRef.current += 1
      setDraggingImportFile(true)
      logImportStep('dragImport:enter', {
        dragDepth: dragDepthRef.current,
      })
    }

    const handleDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return
      }

      event.preventDefault()
      if (importingType) {
        return
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDragLeave = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return
      }

      event.preventDefault()
      if (importingType) {
        return
      }
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      logImportStep('dragImport:leave', {
        dragDepth: dragDepthRef.current,
      })
      if (dragDepthRef.current === 0) {
        setDraggingImportFile(false)
      }
    }

    const handleDrop = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return
      }

      event.preventDefault()
      if (importingType) {
        return
      }
      dragDepthRef.current = 0
      setDraggingImportFile(false)
      setImportMenuOpen(false)

      const file = event.dataTransfer?.files?.[0]
      if (!file) {
        logImportStep('dragImport:drop-empty')
        return
      }

      const importType = getImportTypeFromFile(file)
      logImportStep('dragImport:drop', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        resolvedType: importType,
      })

      if (!importType) {
        setImportError('当前仅支持拖拽导入 Markdown / TXT 简历文件')
        return
      }

      setImportError('')
      void handleImportFile(file, importType)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleImportFile, importingType, resumeDropEnabled])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const handleImportChange = (type: ResumeImportType) => async (event: ChangeEvent<HTMLInputElement>) => {
    logImportStep('handleImportChange:fired', {
      type,
      fileCount: event.target.files?.length ?? 0,
      inputValue: event.target.value,
    })
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      logImportStep('handleImportChange:no-file-selected', {
        type,
      })
      return
    }

    logImportStep('handleImportChange:file-selected', {
      type,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })
    setImportError('')
    setImportMenuOpen(false)
    setMobileMenuOpen(false)
    await handleImportFile(file, type)
  }

  const handleImportInputMouseDown = (type: ResumeImportType) => {
    setImportError('')
    logImportStep('importInput:onMouseDown', {
      type,
      activeElement: document.activeElement instanceof HTMLElement
        ? `${document.activeElement.tagName.toLowerCase()}#${document.activeElement.id || '(no-id)'}`
        : document.activeElement?.nodeName ?? null,
    })
  }

  const handleImportInputClick = (type: ResumeImportType) => (event: ReactMouseEvent<HTMLInputElement>) => {
    logImportStep('importInput:onClick', {
      type,
      inputId: event.currentTarget.id,
      accept: event.currentTarget.accept,
    })
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-4">
            <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="派简历首页">
              <LogoMark className="h-9 w-9" />
              <span className="text-xl font-bold text-gray-900">派简历</span>
            </Link>

            <div className="hidden min-w-0 items-center gap-5 lg:flex">
              <nav className="flex items-center gap-5" aria-label="主导航">
                <NavLink to="/" end className={navigationLinkClass}>
                  首页
                </NavLink>
                <NavLink to={EXCELLENT_RESUMES_PATH} className={excellentNavigationLinkClass}>
                  优质简历
                </NavLink>
                {readyAuthenticated ? (
                  <NavLink to={AUTHENTICATED_HOME_PATH} end className={navigationLinkClass}>
                    我的简历
                  </NavLink>
                ) : null}
                {readyAuthenticated ? (
                  <NavLink to={CREATOR_MARKETPLACE_PATH} className={navigationLinkClass}>
                    创作者中心
                  </NavLink>
                ) : null}
                {readyAuthenticated ? (
                  <NavLink to={RESUME_EDITOR_ENTRY_PATH} className={editorNavigationLinkClass}>
                    简历编辑
                  </NavLink>
                ) : null}
                <a
                  href={GITHUB_REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-700"
                >
                  GitHub
                </a>
                {readyAuthenticated && user?.admin ? (
                  <NavLink to="/admin" className={navigationLinkClass}>
                    管理后台
                  </NavLink>
                ) : null}
              </nav>

              {!initialized ? (
                <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" aria-label="正在加载账号信息" />
              ) : readyAuthenticated ? (
                <div className="flex min-w-0 items-center gap-3 border-l border-gray-200 pl-5">
                  {resumeImportAvailable ? (
                    <div className="relative" ref={menuRef}>
                      <button
                        type="button"
                        onClick={() => setImportMenuOpen((open) => !open)}
                        disabled={!!importingType}
                        aria-expanded={importMenuOpen}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V6m0 0l-4 4m4-4l4 4M5 20h14" />
                        </svg>
                        {importingType ? `导入${getResumeImporter(importingType)?.label ?? ''}中...` : '导入'}
                      </button>

                      {importMenuOpen ? (
                        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                          {resumeImporters.map((importer) => (
                            importer.enabled ? (
                              <div
                                key={importer.type}
                                className="relative flex w-full items-start justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50"
                              >
                                <input
                                  id={`resume-import-${importer.type}`}
                                  type="file"
                                  accept={importer.accept}
                                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                  ref={(node) => {
                                    fileInputRefs.current[importer.type] = node
                                  }}
                                  onMouseDown={() => handleImportInputMouseDown(importer.type)}
                                  onClick={handleImportInputClick(importer.type)}
                                  onChange={handleImportChange(importer.type)}
                                />
                                <span>
                                  <span className="block text-sm font-medium text-gray-700">{importer.label}</span>
                                  <span className="mt-1 block text-xs text-gray-400">{importer.description}</span>
                                </span>
                              </div>
                            ) : (
                              <button
                                key={importer.type}
                                type="button"
                                disabled
                                className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:text-gray-300"
                              >
                                <span>
                                  <span className="block text-sm font-medium text-gray-700">{importer.label}</span>
                                  <span className="mt-1 block text-xs text-gray-400">{importer.description}</span>
                                </span>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
                                  即将支持
                                </span>
                              </button>
                            )
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isVipUser ? (
                    <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 xl:inline-flex">
                      VIP用户
                    </span>
                  ) : null}
                  <span
                    className="hidden text-sm text-gray-600 xl:inline"
                    title={user?.email}
                    aria-label={user?.email ? `当前用户：${user.email}` : '当前用户'}
                  >
                    {navbarEmailLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                  >
                    退出登录
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 border-l border-gray-200 pl-5">
                  <NavLink to="/login" className={navigationLinkClass}>
                    登录
                  </NavLink>
                  <Link
                    to="/register"
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    免费注册
                  </Link>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? '收起导航菜单' : '展开导航菜单'}
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-700 lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {mobileMenuOpen ? (
            <div className="border-t border-gray-100 py-4 lg:hidden">
              <nav className="flex flex-col gap-3" aria-label="移动端主导航">
                <NavLink to="/" end className={navigationLinkClass}>
                  首页
                </NavLink>
                <NavLink to={EXCELLENT_RESUMES_PATH} className={excellentNavigationLinkClass}>
                  优质简历
                </NavLink>
                {readyAuthenticated ? (
                  <NavLink to={AUTHENTICATED_HOME_PATH} end className={navigationLinkClass}>
                    我的简历
                  </NavLink>
                ) : null}
                {readyAuthenticated ? (
                  <NavLink to={CREATOR_MARKETPLACE_PATH} className={navigationLinkClass}>
                    创作者中心
                  </NavLink>
                ) : null}
                {readyAuthenticated ? (
                  <NavLink to={RESUME_EDITOR_ENTRY_PATH} className={editorNavigationLinkClass}>
                    简历编辑
                  </NavLink>
                ) : null}
                <a
                  href={GITHUB_REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-700"
                >
                  GitHub
                </a>
                {readyAuthenticated && user?.admin ? (
                  <NavLink to="/admin" className={navigationLinkClass}>
                    管理后台
                  </NavLink>
                ) : null}
              </nav>

              <div className="mt-4 border-t border-gray-100 pt-4">
                {!initialized ? (
                  <div className="h-9 w-full animate-pulse rounded-lg bg-gray-100" aria-label="正在加载账号信息" />
                ) : readyAuthenticated ? (
                  <div className="space-y-4">
                    {resumeImportAvailable ? (
                      <div>
                        <div className="text-xs font-medium text-gray-400">导入简历</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {resumeImporters.filter((importer) => importer.enabled).map((importer) => (
                            <label
                              key={importer.type}
                              className="relative inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-700"
                            >
                              <input
                                id={`mobile-resume-import-${importer.type}`}
                                type="file"
                                accept={importer.accept}
                                disabled={!!importingType}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                onMouseDown={() => handleImportInputMouseDown(importer.type)}
                                onClick={handleImportInputClick(importer.type)}
                                onChange={handleImportChange(importer.type)}
                              />
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V6m0 0l-4 4m4-4l4 4M5 20h14" />
                              </svg>
                              {importingType === importer.type ? `导入${importer.label}中...` : `导入 ${importer.label}`}
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                      {isVipUser ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          VIP用户
                        </span>
                      ) : null}
                      <span
                        className="min-w-0 flex-1 text-sm text-gray-600"
                        title={user?.email}
                        aria-label={user?.email ? `当前用户：${user.email}` : '当前用户'}
                      >
                        {navbarEmailLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                      >
                        退出登录
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <NavLink to="/login" className={navigationLinkClass}>
                      登录
                    </NavLink>
                    <Link
                      to="/register"
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                    >
                      免费注册
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {resumeImportAvailable && importError ? (
            <div className="border-t border-red-100 py-2 text-sm text-red-600">{importError}</div>
          ) : null}
        </div>
      </header>

      {resumeDropEnabled && draggingImportFile && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-slate-950/35 p-6 backdrop-blur-[2px]">
          <div className="flex h-full items-center justify-center rounded-[32px] border-2 border-dashed border-sky-300 bg-white/92">
            <div className="max-w-lg text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 11v8m0-8l-3 3m3-3l3 3" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">松开即可导入 Markdown 简历</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                支持 `.md`、`.markdown`、`.txt`
                {importingType ? '，当前正在处理上一份文件，请稍候。' : '，直接把文件拖到页面任意位置就行。'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
