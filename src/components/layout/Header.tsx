import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  AUTHENTICATED_HOME_PATH,
  buildResumeEditorPath,
  RESUME_EDITOR_ENTRY_PATH,
} from '../../config/site'
import { useAuthStore } from '../../store/authStore'
import { useResumeStore } from '../../store/resumeStore'
import {
  detectResumeImportType,
  getResumeImporter,
  resumeImporters,
  type ImportedResumeData,
  type ResumeImportType,
} from '../../utils/importers'
import { buildResumeImportPreview } from '../../utils/importers/preview'
import {
  CREATOR_MARKETPLACE_PATH,
  EXCELLENT_RESUMES_PATH,
} from '../../utils/navigation'
import { LogoMark } from '../branding/LogoMark'

const IMPORT_LOG_PREFIX = '[resume-import]'
const NAVBAR_ACCOUNT_VISIBLE_CHARACTERS = 7

function getNavbarAccountLabel(accountLabel?: string | null): string {
  const normalizedLabel = accountLabel?.trim() || '用户'
  const characters = Array.from(normalizedLabel)

  if (characters.length <= NAVBAR_ACCOUNT_VISIBLE_CHARACTERS) {
    return normalizedLabel
  }

  return `${characters.slice(0, NAVBAR_ACCOUNT_VISIBLE_CHARACTERS - 1).join('')}…`
}

function VipIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-amber-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m3.75 7.25 4.5 3.75L12 5l3.75 6 4.5-3.75-1.8 10.5H5.55L3.75 7.25Z"
        fill="currentColor"
        fillOpacity={0.16}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <path d="M6 20h12" strokeLinecap="round" strokeWidth={1.8} />
    </svg>
  )
}

function logImportStep(message: string) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`${IMPORT_LOG_PREFIX} ${message}`)
}

function isFileDragEvent(event: DragEvent): boolean {
  const types = event.dataTransfer?.types
  return Array.from(types ?? []).includes('Files')
}

function navigationLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'text-sm font-medium transition-colors',
    isActive ? 'text-primary-700' : 'text-gray-600 hover:text-primary-700',
  ].join(' ')
}

function accountMenuLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary-50 text-primary-700'
      : 'text-gray-600 hover:bg-gray-50 hover:text-primary-700',
  ].join(' ')
}

const accountMenuActionClassName = 'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900'

interface HeaderProps {
  enableResumeDrop?: boolean
}

interface PendingResumeImport {
  fileName: string
  type: ResumeImportType
  payload: ImportedResumeData
}

export function Header({ enableResumeDrop = false }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, initialized, logout } = useAuthStore()
  const { importResume } = useResumeStore()
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [importingType, setImportingType] = useState<ResumeImportType | null>(null)
  const [importError, setImportError] = useState('')
  const [pendingImport, setPendingImport] = useState<PendingResumeImport | null>(null)
  const [draggingImportFile, setDraggingImportFile] = useState(false)
  const importMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const importDialogRef = useRef<HTMLDivElement | null>(null)
  const confirmImportButtonRef = useRef<HTMLButtonElement | null>(null)
  const importDialogReturnFocusRef = useRef<HTMLElement | null>(null)
  const dragDepthRef = useRef(0)
  const readyAuthenticated = initialized && isAuthenticated
  const legalConsentAccepted = !user?.legalConsentRequired
  const resumeImportAvailable = readyAuthenticated && legalConsentAccepted
  const resumeDropEnabled = readyAuthenticated && legalConsentAccepted && enableResumeDrop
  const isVipUser = user?.membershipStatus === 'ACTIVE'
  const navbarIdentity = user?.nickname?.trim() || '用户'
  const navbarAccountLabel = getNavbarAccountLabel(navbarIdentity)
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
    logImportStep(`handleImportFile:start:${currentType}`)

    if (!importer?.enabled || !importer.parse) {
      logImportStep(`handleImportFile:importer-unavailable:${currentType}`)
      setImportingType(null)
      setImportError('当前导入方式暂不可用')
      return
    }

    try {
      setImportingType(currentType)
      const payload = await importer.parse(file)
      logImportStep(`handleImportFile:parse-success:${currentType}`)
      importDialogReturnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      setPendingImport({
        fileName: file.name,
        type: currentType,
        payload,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '导入失败，请稍后再试'
      logImportStep(`handleImportFile:error:${currentType}`)
      setImportError(message)
    } finally {
      logImportStep(`handleImportFile:finish:${currentType}`)
      setImportingType(null)
    }
  }, [])

  const closeImportPreview = useCallback(() => {
    if (importingType) {
      return
    }
    setPendingImport(null)
    window.requestAnimationFrame(() => {
      const returnFocusTarget = importDialogReturnFocusRef.current
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus()
      }
    })
  }, [importingType])

  const confirmImport = useCallback(async () => {
    if (!pendingImport || importingType) {
      return
    }

    setImportError('')
    setImportingType(pendingImport.type)

    try {
      const resume = await importResume(pendingImport.payload)
      logImportStep(`confirmImport:store-import-success:${pendingImport.type}`)
      setPendingImport(null)
      navigate(buildResumeEditorPath(resume.id))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '导入失败，请稍后再试'
      logImportStep(`confirmImport:error:${pendingImport.type}`)
      setImportError(message)
    } finally {
      setImportingType(null)
    }
  }, [importResume, importingType, navigate, pendingImport])

  useEffect(() => {
    if (!pendingImport) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => confirmImportButtonRef.current?.focus())

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !importingType) {
        event.preventDefault()
        closeImportPreview()
        return
      }

      if (event.key === 'Tab') {
        const focusableElements = Array.from(
          importDialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (!firstElement || !lastElement) {
          event.preventDefault()
          return
        }

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown)
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [closeImportPreview, importingType, pendingImport])

  useEffect(() => {
    if (!importMenuOpen && !accountMenuOpen && !mobileMenuOpen) {
      return
    }

    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target as Node

      if (importMenuRef.current && !importMenuRef.current.contains(target)) {
        setImportMenuOpen(false)
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false)
      }
    }

    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImportMenuOpen(false)
        setAccountMenuOpen(false)
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleMenuKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleMenuKeyDown)
    }
  }, [accountMenuOpen, importMenuOpen, mobileMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
    setImportMenuOpen(false)
    setAccountMenuOpen(false)
  }, [location.hash, location.pathname, location.search])

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
      if (importingType || pendingImport) {
        return
      }
      dragDepthRef.current += 1
      setDraggingImportFile(true)
      logImportStep('dragImport:enter')
    }

    const handleDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return
      }

      event.preventDefault()
      if (importingType || pendingImport) {
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
      if (importingType || pendingImport) {
        return
      }
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      logImportStep('dragImport:leave')
      if (dragDepthRef.current === 0) {
        setDraggingImportFile(false)
      }
    }

    const handleDrop = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return
      }

      event.preventDefault()
      if (importingType || pendingImport) {
        return
      }
      dragDepthRef.current = 0
      setDraggingImportFile(false)
      setImportMenuOpen(false)
      setAccountMenuOpen(false)
      setMobileMenuOpen(false)

      const file = event.dataTransfer?.files?.[0]
      if (!file) {
        logImportStep('dragImport:drop-empty')
        return
      }

      const importType = detectResumeImportType(file)
      logImportStep(importType ? `dragImport:drop:${importType}` : 'dragImport:drop:unsupported')

      if (!importType) {
        setImportError('仅支持 Markdown、TXT、DOCX 或文本型 PDF 简历文件')
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
  }, [handleImportFile, importingType, pendingImport, resumeDropEnabled])

  const handleLogout = async () => {
    setAccountMenuOpen(false)
    setMobileMenuOpen(false)
    await logout()
    navigate('/', { replace: true })
  }

  const handleImportChange = (type: ResumeImportType) => async (event: ChangeEvent<HTMLInputElement>) => {
    logImportStep(`handleImportChange:fired:${type}`)
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      logImportStep(`handleImportChange:no-file-selected:${type}`)
      return
    }

    logImportStep(`handleImportChange:file-selected:${type}`)
    setImportError('')
    setImportMenuOpen(false)
    setAccountMenuOpen(false)
    setMobileMenuOpen(false)
    await handleImportFile(file, type)
  }

  const handleImportInputMouseDown = () => {
    setImportError('')
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
                {readyAuthenticated && user?.marketplaceEnabled ? (
                  <NavLink to={CREATOR_MARKETPLACE_PATH} className={navigationLinkClass}>
                    创作者中心
                  </NavLink>
                ) : null}
                {readyAuthenticated ? (
                  <NavLink to={RESUME_EDITOR_ENTRY_PATH} className={editorNavigationLinkClass}>
                    简历编辑
                  </NavLink>
                ) : null}
              </nav>

              {!initialized ? (
                <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" aria-label="正在加载账号信息" />
              ) : readyAuthenticated ? (
                <div className="flex min-w-0 items-center gap-3 border-l border-gray-200 pl-5">
                  {resumeImportAvailable ? (
                    <div className="relative" ref={importMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setImportMenuOpen((open) => !open)
                          setAccountMenuOpen(false)
                        }}
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
                                  aria-label={`导入${importer.label}`}
                                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                  onMouseDown={handleImportInputMouseDown}
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

                  <div className="relative" ref={accountMenuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen((open) => !open)
                        setImportMenuOpen(false)
                      }}
                      title={navbarIdentity || undefined}
                      aria-label={isVipUser ? `${navbarIdentity}，VIP用户的账号菜单` : `${navbarIdentity}的账号菜单`}
                      aria-haspopup="menu"
                      aria-expanded={accountMenuOpen}
                      className="inline-flex min-w-0 max-w-40 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-700"
                    >
                      {isVipUser ? <VipIcon /> : null}
                      <span className="min-w-0 truncate">{navbarAccountLabel}</span>
                      <svg
                        className={`h-4 w-4 shrink-0 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {accountMenuOpen ? (
                      <div
                        role="menu"
                        aria-label="账号菜单"
                        className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
                      >
                        <NavLink
                          to={AUTHENTICATED_HOME_PATH}
                          end
                          role="menuitem"
                          onClick={() => setAccountMenuOpen(false)}
                          className={accountMenuLinkClass}
                        >
                          我的简历
                        </NavLink>
                        {user?.admin ? (
                          <NavLink
                            to="/admin"
                            role="menuitem"
                            onClick={() => setAccountMenuOpen(false)}
                            className={accountMenuLinkClass}
                          >
                            管理后台
                          </NavLink>
                        ) : null}
                        <NavLink
                          to="/settings/account"
                          role="menuitem"
                          onClick={() => setAccountMenuOpen(false)}
                          className={accountMenuLinkClass}
                        >
                          账号设置
                        </NavLink>
                        <div role="separator" className="my-1 border-t border-gray-100" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleLogout()}
                          className={accountMenuActionClassName}
                        >
                          退出登录
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 border-l border-gray-200 pl-5">
                  <Link
                    to="/login"
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    扫码登录
                  </Link>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((open) => !open)
                setImportMenuOpen(false)
                setAccountMenuOpen(false)
              }}
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
                {readyAuthenticated && user?.marketplaceEnabled ? (
                  <NavLink to={CREATOR_MARKETPLACE_PATH} className={navigationLinkClass}>
                    创作者中心
                  </NavLink>
                ) : null}
                {readyAuthenticated ? (
                  <NavLink to={RESUME_EDITOR_ENTRY_PATH} className={editorNavigationLinkClass}>
                    简历编辑
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
                                aria-label={`导入${importer.label}`}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                onMouseDown={handleImportInputMouseDown}
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

                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex min-w-0 items-center gap-2 px-3">
                        {isVipUser ? <VipIcon /> : null}
                        <span
                          className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800"
                          title={navbarIdentity || undefined}
                          aria-label={isVipUser ? `当前用户：${navbarIdentity}，VIP用户` : `当前用户：${navbarIdentity}`}
                        >
                          {navbarAccountLabel}
                        </span>
                      </div>
                      <nav className="mt-3 space-y-1" aria-label="移动端账号菜单">
                        <NavLink
                          to={AUTHENTICATED_HOME_PATH}
                          end
                          onClick={() => setMobileMenuOpen(false)}
                          className={accountMenuLinkClass}
                        >
                          我的简历
                        </NavLink>
                        {user?.admin ? (
                          <NavLink
                            to="/admin"
                            onClick={() => setMobileMenuOpen(false)}
                            className={accountMenuLinkClass}
                          >
                            管理后台
                          </NavLink>
                        ) : null}
                        <NavLink
                          to="/settings/account"
                          onClick={() => setMobileMenuOpen(false)}
                          className={accountMenuLinkClass}
                        >
                          账号设置
                        </NavLink>
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          className={accountMenuActionClassName}
                        >
                          退出登录
                        </button>
                      </nav>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Link
                      to="/login"
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                    >
                      扫码登录
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {resumeImportAvailable && importError ? (
            <div role="alert" className="border-t border-red-100 py-2 text-sm text-red-600">{importError}</div>
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
              <h2 className="text-2xl font-semibold text-slate-900">松开即可导入简历</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                支持 `.md`、`.markdown`、`.txt`、`.docx` 和文本型 `.pdf`
                {importingType ? '，当前正在处理上一份文件，请稍候。' : '，直接把文件拖到页面任意位置就行。'}
              </p>
            </div>
          </div>
        </div>
      )}

      {pendingImport ? (() => {
        const preview = buildResumeImportPreview(pendingImport.payload)
        const contactItems = [
          preview.name && `姓名：${preview.name}`,
          preview.phone && `手机：${preview.phone}`,
          preview.email && `邮箱：${preview.email}`,
        ].filter(Boolean)

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div
              ref={importDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="resume-import-preview-title"
              aria-describedby="resume-import-preview-description"
              className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-sky-600">导入前确认</div>
                  <h2 id="resume-import-preview-title" className="mt-1 text-xl font-semibold text-slate-900">
                    核对识别结果
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeImportPreview}
                  disabled={!!importingType}
                  aria-label="关闭导入确认"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p id="resume-import-preview-description" className="mt-3 text-sm leading-6 text-slate-500">
                Word 表格和双栏 PDF 的阅读顺序可能存在差异。请先核对标题、联系方式和识别到的模块，确认后才会创建简历。
              </p>

              <dl className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">源文件</dt>
                  <dd className="mt-1 break-all font-medium text-slate-700">{pendingImport.fileName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">简历标题</dt>
                  <dd className="mt-1 font-medium text-slate-900">{preview.title}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">基本信息</dt>
                  <dd className="mt-1 text-slate-700">
                    {contactItems.length > 0 ? contactItems.join(' · ') : '未识别到姓名、手机或邮箱，请谨慎确认'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    已识别模块（{preview.moduleLabels.length}）
                  </dt>
                  <dd className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {preview.moduleOutline.map((module, index) => (
                      <div
                        key={`${module.label}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="text-xs font-medium text-slate-700">{module.label}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                          {module.summary || '已识别该模块，请进入编辑器继续核对内容'}
                        </div>
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>

              {importError ? (
                <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {importError}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeImportPreview}
                  disabled={!!importingType}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  取消，不创建
                </button>
                <button
                  ref={confirmImportButtonRef}
                  type="button"
                  onClick={() => void confirmImport()}
                  disabled={!!importingType}
                  className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importingType ? '正在创建…' : '确认并创建简历'}
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}
    </>
  )
}
