import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useResumeStore } from '../../store/resumeStore'
import { getResumeImporter, resumeImporters, type ResumeImportType } from '../../utils/importers'
import { LogoMark } from '../branding/LogoMark'

interface HeaderProps {
  onExportPdf?: () => void
  exporting?: boolean
  smartOnePageHref?: string
}

const IMPORT_LOG_PREFIX = '[resume-import]'
const MARKDOWN_FILE_PATTERN = /\.(md|markdown|txt)$/i

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

export function Header({
  onExportPdf,
  exporting = false,
  smartOnePageHref,
}: HeaderProps) {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { importResume } = useResumeStore()
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [importingType, setImportingType] = useState<ResumeImportType | null>(null)
  const [importError, setImportError] = useState('')
  const [draggingImportFile, setDraggingImportFile] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRefs = useRef<Partial<Record<ResumeImportType, HTMLInputElement | null>>>({})
  const dragDepthRef = useRef(0)

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
      navigate(`/editor/${resume.id}`)
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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setImportMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [importMenuOpen])

  useEffect(() => {
    if (!isAuthenticated) {
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
  }, [handleImportFile, importingType, isAuthenticated])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-4 py-3">
            <Link to="/dashboard" className="flex items-center gap-3">
              <LogoMark className="h-9 w-9" />
              <span className="text-xl font-bold text-gray-900">派简历</span>
            </Link>

            {isAuthenticated && (
              <div className="flex items-center gap-4">
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-700"
                >
                  我的简历
                </Link>
                {onExportPdf && (
                  <button
                    type="button"
                    onClick={onExportPdf}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v10m0 0l-4-4m4 4l4-4M5 20h14" />
                    </svg>
                    {exporting ? '导出中...' : '导出 PDF'}
                  </button>
                )}
                {smartOnePageHref && (
                  <Link
                    to={smartOnePageHref}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-700"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
                    </svg>
                    智能一页
                  </Link>
                )}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setImportMenuOpen((open) => !open)}
                    disabled={!!importingType}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V6m0 0l-4 4m4-4l4 4M5 20h14" />
                    </svg>
                    {importingType ? `导入${getResumeImporter(importingType)?.label ?? ''}中...` : '导入'}
                  </button>

                  {importMenuOpen && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
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
                  )}
                </div>
                {importError && (
                  <span className="max-w-xs text-sm text-red-500">{importError}</span>
                )}
                <span className="text-sm text-gray-600">{user?.email || '用户'}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isAuthenticated && draggingImportFile && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-slate-950/35 p-6 backdrop-blur-[2px]">
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
