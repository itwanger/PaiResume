import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { showcaseApi, type ShowcaseDetail } from '../api/showcase'
import { Header } from '../components/layout/Header'
import { ExcellentResumePreview } from '../components/showcase/ExcellentResumePreview'
import {
  buildMembershipPath,
  buildShowcasePath,
  EXCELLENT_RESUMES_PATH,
} from '../utils/navigation'

export default function ShowcasePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ShowcaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true)
      setError('')
      try {
        const { data: res } = await showcaseApi.detail(slug)
        setDetail(res.data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '样例加载失败'
        if (message.includes('VIP') || message.includes('会员')) {
          navigate(buildMembershipPath(buildShowcasePath(slug)), { replace: true })
          return
        }
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      void loadDetail()
    }
  }, [navigate, slug])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to={EXCELLENT_RESUMES_PATH} className="text-sm text-primary-700 transition-colors hover:text-primary-800">
          返回优质简历
        </Link>

        {loading ? (
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

              <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 text-sm leading-6 text-gray-600">
                <p>这是管理员筛选并确认可展示的优质简历，普通用户简历不会自动进入这里。</p>
                <p className="mt-3">当前采用“校园蓝”推荐排版：左侧照片、双列联系信息、浅蓝分区栏和紧凑项目要点。</p>
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
