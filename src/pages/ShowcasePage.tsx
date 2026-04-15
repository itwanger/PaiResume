import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { publicApi, type ShowcaseDetail } from '../api/public'
import { PublicSiteHeader } from '../components/layout/PublicSiteHeader'
import { ResumePreview } from '../components/preview/ResumePreview'
import { buildAnalysisResume } from '../utils/resumeAnalysisAdapter'

export default function ShowcasePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [detail, setDetail] = useState<ShowcaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true)
      setError('')
      try {
        const { data: res } = await publicApi.showcaseDetail(slug)
        setDetail(res.data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '样例加载失败'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      void loadDetail()
    }
  }, [slug])

  const resume = useMemo(() => (
    detail ? buildAnalysisResume(detail.modules) : null
  ), [detail])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicSiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to="/" className="text-sm text-primary-700 transition-colors hover:text-primary-800">
          返回首页
        </Link>

        {loading ? (
          <div className="mt-8 text-sm text-gray-500">加载中...</div>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : detail && resume ? (
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
                <p>这个页面只展示管理员发布的官方高分样例，不会公开普通用户简历。</p>
                <p className="mt-3">如果你也想把自己的简历整理到这种完成度，可以先免费注册，写完后再开通会员导出。</p>
              </div>
            </aside>

            <div>
              <ResumePreview resume={resume} />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
