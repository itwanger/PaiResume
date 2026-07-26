import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { publicApi } from '../api/public'
import { showcaseApi, type ShowcaseDetail } from '../api/showcase'
import { Header } from '../components/layout/Header'
import { ExcellentResumePreview } from '../components/showcase/ExcellentResumePreview'
import { useAuthStore } from '../store/authStore'
import {
  buildLoginPath,
  buildMembershipPath,
  buildShowcasePath,
  EXCELLENT_RESUMES_PATH,
} from '../utils/navigation'

export default function ShowcasePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { initialized, isAuthenticated } = useAuthStore()
  const [detail, setDetail] = useState<ShowcaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          <div className="mt-8 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <div className="rounded-lg border border-gray-200 bg-white px-5 py-5">
                <div className="text-sm text-primary-700">{detail.scoreLabel}</div>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">{detail.title}</h1>
                <p className="mt-4 text-sm leading-6 text-gray-600">{detail.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(detail.tags ?? []).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </aside>

            <div>
              <ExcellentResumePreview modules={detail.modules} />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
