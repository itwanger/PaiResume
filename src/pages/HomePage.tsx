import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { publicApi, type HomeData } from '../api/public'
import { PublicSiteHeader } from '../components/layout/PublicSiteHeader'
import { useAuthStore } from '../store/authStore'

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

export default function HomePage() {
  const { isAuthenticated, initialized, user } = useAuthStore()
  const readyAuthenticated = initialized && isAuthenticated
  const [homeData, setHomeData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadHome = async () => {
      setLoading(true)
      try {
        const { data: res } = await publicApi.home()
        setHomeData(res.data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '首页加载失败'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void loadHome()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <PublicSiteHeader />

      <main>
        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-primary-700">高分简历样例 · 问卷反馈 · 会员导出</p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                免费注册后开始制作简历，开通会员再导出 PDF
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
                所有人都可以先看我们整理的高分简历样例和用户评价。登录后可以直接创建、编辑、保存简历；导出 PDF 需要开通会员。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to={readyAuthenticated ? '/dashboard' : '/register'}
                  className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  {readyAuthenticated ? '开始制作简历' : '免费注册开始'}
                </Link>
                <Link
                  to="/survey"
                  className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
                >
                  提交评价 / 需求 / Bug
                </Link>
                {user?.admin ? (
                  <Link
                    to="/admin"
                    className="rounded-lg border border-primary-200 bg-primary-50 px-5 py-3 text-sm font-medium text-primary-700 transition-colors hover:border-primary-300"
                  >
                    进入管理后台
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-5">
                <div className="text-sm text-gray-500">当前会员价</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">
                  {homeData ? formatCents(homeData.membershipPriceCents) : '加载中'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-5">
                <div className="text-sm text-gray-500">问卷默认优惠</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">
                  {homeData ? formatCents(homeData.questionnaireCouponAmountCents) : '加载中'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-5">
                <div className="text-sm text-gray-500">导出权限</div>
                <div className="mt-2 text-lg font-semibold text-gray-900">仅会员可导出 PDF</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">官方高分简历样例</h2>
              <p className="mt-2 text-sm text-gray-500">未登录也能先看，再决定怎么写自己的简历。</p>
            </div>
          </div>

          {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <div className="mt-6 text-sm text-gray-500">加载中...</div>
          ) : homeData?.showcases.length ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {homeData.showcases.map((showcase) => (
                <Link
                  key={showcase.id}
                  to={`/showcases/${showcase.slug}`}
                  className="rounded-lg border border-gray-200 bg-white px-5 py-5 transition hover:border-primary-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{showcase.title}</div>
                      <div className="mt-1 text-sm text-primary-700">{showcase.scoreLabel}</div>
                    </div>
                    <span className="rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-700">
                      查看详情
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-gray-600">{showcase.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {showcase.tags?.map((tag) => (
                      <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-sm text-gray-500">
              还没有发布样例，请先到管理后台配置。
            </div>
          )}
        </section>

        <section className="border-y border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">高分评价</h2>
              <p className="mt-2 text-sm text-gray-500">只展示用户同意公开并经管理员发布的评价。</p>
            </div>

            {loading ? (
              <div className="mt-6 text-sm text-gray-500">加载中...</div>
            ) : homeData?.testimonials.length ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {homeData.testimonials.map((testimonial) => (
                  <div key={testimonial.id} className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{testimonial.displayName}</div>
                        <div className="mt-1 text-sm text-gray-500">
                          {testimonial.schoolOrCompany} · {testimonial.targetRole}
                        </div>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs text-primary-700">
                        {testimonial.rating} / 5
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-gray-600">{testimonial.testimonialText}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-sm text-gray-500">
                还没有发布评价。你可以先发问卷给用户收集反馈。
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
