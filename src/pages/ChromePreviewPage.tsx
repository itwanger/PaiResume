import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { resumeApi } from '../api/resume'
import { useResumeStore } from '../store/resumeStore'
import {
  generateResumePdfPreviewAsset,
  resolveResumePdfAccentPreset,
  resolveResumePdfDensity,
  resolveResumePdfHeadingStyle,
  resolveResumePdfTemplateId,
  type ResumePdfAccentPreset,
  type ResumePdfDensity,
  type ResumePdfHeadingStyle,
  type ResumePdfPageMode,
  type ResumePdfTemplateId,
} from '../utils/resumePdf'

export default function ChromePreviewPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const resumeId = Number(id)
  const { modules, loading, fetchModules } = useResumeStore()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [resumeTitle, setResumeTitle] = useState('')
  const [resumeTitleReady, setResumeTitleReady] = useState(false)
  const activeUrlRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const refreshToken = searchParams.get('refresh') ?? ''
  const pageMode: ResumePdfPageMode = searchParams.get('pageMode') === 'continuous'
    ? 'continuous'
    : 'standard'
  const templateId: ResumePdfTemplateId = resolveResumePdfTemplateId(searchParams.get('templateId'))
  const densityParam = searchParams.get('density')
  const accentPresetParam = searchParams.get('accentPreset')
  const headingStyleParam = searchParams.get('headingStyle')
  const density: ResumePdfDensity | undefined = densityParam ? resolveResumePdfDensity(densityParam) : undefined
  const accentPreset: ResumePdfAccentPreset | undefined = accentPresetParam ? resolveResumePdfAccentPreset(accentPresetParam) : undefined
  const headingStyle: ResumePdfHeadingStyle | undefined = headingStyleParam ? resolveResumePdfHeadingStyle(headingStyleParam) : undefined

  useEffect(() => {
    if (!resumeId) {
      return
    }

    void fetchModules(resumeId)
  }, [fetchModules, resumeId])

  useEffect(() => {
    if (!resumeId) {
      setResumeTitle('')
      setResumeTitleReady(true)
      return
    }

    let cancelled = false
    setResumeTitle('')
    setResumeTitleReady(false)

    void resumeApi.list()
      .then(({ data: response }) => {
        if (!cancelled) {
          setResumeTitle(response.data.find((resume) => resume.id === resumeId)?.title ?? '')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResumeTitle('')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResumeTitleReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [resumeId])

  useEffect(() => {
    if (!resumeTitleReady) {
      return
    }

    if (modules.length === 0) {
      setPdfUrl(null)
      setPdfLoading(false)
      setPdfError('')
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current)
        activeUrlRef.current = null
      }
      return
    }

    let cancelled = false
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setPdfLoading(true)
    setPdfError('')

    void generateResumePdfPreviewAsset(modules, {
      pageMode,
      documentTitle: resumeTitle,
      templateId,
      density,
      accentPreset,
      headingStyle,
    })
      .then(({ blob }) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return
        }

        const nextUrl = URL.createObjectURL(blob)
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current)
        }
        activeUrlRef.current = nextUrl
        setPdfUrl(nextUrl)
        setPdfLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return
        }

        setPdfLoading(false)
        setPdfError(error instanceof Error ? error.message : 'PDF 预览生成失败')
      })

    return () => {
      cancelled = true
    }
  }, [accentPreset, density, headingStyle, modules, pageMode, refreshToken, resumeTitle, resumeTitleReady, templateId])

  useEffect(() => () => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current)
    }
  }, [])

  const iframeTitle = useMemo(
    () => (pageMode === 'continuous' ? '简历模板预览 - 智能一页' : '简历模板预览 - 标准 PDF'),
    [pageMode]
  )
  const pdfViewerUrl = useMemo(() => {
    if (!pdfUrl) {
      return null
    }

    return `${pdfUrl}#view=FitH`
  }, [pdfUrl])
  if (loading && modules.length === 0) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white text-gray-400">
        正在加载简历...
      </div>
    )
  }

  if (pdfError) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {pdfError}
        </div>
      </div>
    )
  }

  if (!pdfUrl || pdfLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white text-gray-400">
        正在生成模板预览...
      </div>
    )
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-white">
      <iframe
        title={iframeTitle}
        src={pdfViewerUrl ?? undefined}
        scrolling="no"
        className="block h-full w-full border-0 bg-white"
      />
    </div>
  )
}
