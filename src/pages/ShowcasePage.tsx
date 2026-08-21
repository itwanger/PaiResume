import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { publicApi } from '../api/public'
import { showcaseApi, type ShowcaseDetail } from '../api/showcase'
import { PreviewPanel } from '../components/editor/PreviewPanel'
import { Header } from '../components/layout/Header'
import { SiteFooter } from '../components/layout/SiteFooter'
import { useAuthStore } from '../store/authStore'
import {
  buildLoginPath,
  buildMembershipPath,
  buildShowcasePath,
  EXCELLENT_RESUMES_PATH,
} from '../utils/navigation'
import { normalizeResumeStyle } from '../utils/resumeStyle'

export default function ShowcasePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { initialized, isAuthenticated } = useAuthStore()
  const [detail, setDetail] = useState<ShowcaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const resumeStyle = normalizeResumeStyle(detail)

  useEffect(() => {
    if (!initialized || !slug) {
      return
    }

    let cancelled = false

    const loadDetail = async () => {
      setLoading(true)
      setError('')
      try {
        const { data: res } = isAuthenticated
          ? await showcaseApi.detail(slug)
          : await publicApi.showcaseDetail(slug)
        if (!cancelled) {
          setDetail(res.data)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '样例加载失败'
        if (err instanceof ApiError && err.code === 7008) {
          const returnTo = buildShowcasePath(slug)
          navigate(
            isAuthenticated ? buildMembershipPath(returnTo) : buildLoginPath(returnTo),
            { replace: true },
          )
          return
        }
        if (!cancelled) {
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [initialized, isAuthenticated, navigate, slug])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to={EXCELLENT_RESUMES_PATH} className="text-sm text-primary-700 transition-colors hover:text-primary-800">
          返回优质简历
        </Link>

        {!initialized || loading ? (
          <div className="mt-8 text-sm text-gray-500">加载中...</div>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : detail ? (
          <div className="mt-7">
            <div className="mx-auto mb-6 max-w-[1120px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary-700">{detail.scoreLabel}</div>
                  <h1 className="mt-1 break-words text-2xl font-semibold text-gray-900">{detail.title}</h1>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {(detail.tags ?? []).map((tag) => (
                    <span key={tag} className="bg-white px-2.5 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {detail.summary ? <p className="mt-3 text-sm leading-6 text-gray-600">{detail.summary}</p> : null}
            </div>

            <div className="mx-auto max-w-[1120px]">
              <PreviewPanel
                modules={detail.modules}
                loading={false}
                forcedMode="pdf-standard"
                hideHeader
                pageMode={resumeStyle.pageMode}
                pdfConfig={resumeStyle}
              />
            </div>
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}
