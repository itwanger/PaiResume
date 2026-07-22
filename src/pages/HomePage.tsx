import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { publicApi, type HomeData, type ShowcaseCard } from '../api/public'
import { Header } from '../components/layout/Header'
import { buildResumeEditorPath, GITHUB_REPOSITORY_URL } from '../config/site'
import { useAuthStore } from '../store/authStore'
import { useResumeStore } from '../store/resumeStore'
import { EXCELLENT_RESUMES_PATH } from '../utils/navigation'

const MOCK_TESTIMONIALS = [
  {
    id: -1,
    displayName: '林同学',
    schoolOrCompany: '应届生',
    targetRole: 'Java 后端开发',
    rating: 5,
    testimonialText: '原来项目经历写得很散，按照建议梳理后，职责和成果都更清楚。智能一页把多页内容合成一张连续长页，查看和导出都更顺畅。',
    createdAt: '',
    avatarClassName: 'bg-blue-100 text-blue-700',
  },
  {
    id: -2,
    displayName: '周同学',
    schoolOrCompany: '硕士在读',
    targetRole: '产品经理',
    rating: 5,
    testimonialText: 'AI 给出的建议很具体，会指出问题，也会给出修改思路。调整后每段经历都更聚焦，整体排版也更清爽。',
    createdAt: '',
    avatarClassName: 'bg-violet-100 text-violet-700',
  },
  {
    id: -3,
    displayName: '陈先生',
    schoolOrCompany: '互联网从业者',
    targetRole: '前端开发工程师',
    rating: 5,
    testimonialText: '最有帮助的是把日常工作拆成职责、行动和结果，修改时更有方向。导出的 PDF 结构清晰，后续针对岗位调整也很方便。',
    createdAt: '',
    avatarClassName: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: -4,
    displayName: '许同学',
    schoolOrCompany: '腾讯暑期实习',
    targetRole: 'Agent 工程师',
    rating: 5,
    testimonialText: '原来的 Agent 项目只写了框架和模型，看不出具体做了什么。优化后把任务编排、工具调用、记忆和评测链路都写清楚了，最终拿到了腾讯暑期实习 offer。',
    createdAt: '',
    avatarClassName: 'bg-rose-100 text-rose-700',
  },
  {
    id: -5,
    displayName: '唐同学',
    schoolOrCompany: '美团日常实习',
    targetRole: 'AI 应用开发',
    rating: 5,
    testimonialText: 'RAG 项目原先写得像技术栈清单，AI 帮我重新梳理了检索、评测和效果优化的完整链路。针对岗位调整两版后，顺利拿到了美团 AI 应用开发日常实习。',
    createdAt: '',
    avatarClassName: 'bg-cyan-100 text-cyan-700',
  },
  {
    id: -6,
    displayName: '宋同学',
    schoolOrCompany: '字节跳动 SP',
    targetRole: 'AI Infra',
    rating: 5,
    testimonialText: '推理优化项目里术语很多，但亮点不突出。按照建议改成吞吐、延迟和资源利用率三条主线后，技术深度更容易被看见，最后拿到了字节跳动 AI Infra SP。',
    createdAt: '',
    avatarClassName: 'bg-orange-100 text-orange-700',
  },
]

const MOCK_SHOWCASES: ShowcaseCard[] = [
  {
    id: -101,
    slug: 'demo-ai-application-internship',
    title: '沉默王二 · AI 应用开发 · 暑期实习',
    scoreLabel: '99分',
    summary: '把 RAG、工具调用与评测闭环写成清晰的项目主线，突出 AI 应用从原型到落地的完整能力。',
    tags: ['RAG 应用', 'Agent 工作流', '暑期实习'],
    updatedAt: '',
  },
  {
    id: -102,
    slug: 'demo-agent-engineer',
    title: 'Agent 工程师 · 校招',
    scoreLabel: '98分',
    summary: '突出任务规划、多 Agent 协作、工具调用、记忆系统与效果评测，体现完整的 Agent 工程闭环。',
    tags: ['Agent', 'MCP', '评测体系'],
    updatedAt: '',
  },
  {
    id: -103,
    slug: 'demo-fullstack-engineer',
    title: '全栈工程师 · 社招',
    scoreLabel: '96分',
    summary: '串联前端体验、后端服务与上线部署，用一条完整业务链路呈现端到端交付能力。',
    tags: ['React', 'Spring Boot', '云部署'],
    updatedAt: '',
  },
  {
    id: -104,
    slug: 'demo-java-backend-campus',
    title: 'Java 后端工程师 · 校招',
    scoreLabel: '97分',
    summary: '围绕接口设计、数据流与系统稳定性展开项目经历，让技术选型和工程成果更容易被看见。',
    tags: ['Java', '微服务', '高并发'],
    updatedAt: '',
  },
  {
    id: -105,
    slug: 'demo-java-backend-experienced',
    title: 'Java 后端 · 三年工作经验',
    scoreLabel: '98分',
    summary: '从业务职责进一步写到系统设计、性能优化和协作影响，体现有经验工程师的能力进阶。',
    tags: ['三年经验', '系统设计', '性能优化'],
    updatedAt: '',
  },
  {
    id: -106,
    slug: 'demo-ai-application-daily-internship',
    title: 'AI 应用开发 · 日常实习',
    scoreLabel: '96分',
    summary: '聚焦检索增强、提示词设计与效果评测，把课程项目整理成更贴近日常实习要求的工程经历。',
    tags: ['Python', 'RAG', '日常实习'],
    updatedAt: '',
  },
  {
    id: -107,
    slug: 'demo-python-engineer',
    title: 'Python 工程师 · 社招',
    scoreLabel: '95分',
    summary: '突出服务开发、数据处理与自动化能力，让 Python 技术栈与实际业务价值形成对应。',
    tags: ['Python', 'FastAPI', '数据处理'],
    updatedAt: '',
  },
  {
    id: -108,
    slug: 'demo-go-engineer',
    title: 'Go 工程师 · 社招',
    scoreLabel: '96分',
    summary: '围绕高并发服务、云原生基础设施与可观测性组织内容，强化 Go 工程方向的技术辨识度。',
    tags: ['Go', '云原生', '微服务'],
    updatedAt: '',
  },
  {
    id: -109,
    slug: 'demo-frontend-engineer',
    title: '前端工程师 · 校招',
    scoreLabel: '95分',
    summary: '把页面开发进一步写成体验、性能与工程化成果，呈现从需求理解到上线交付的完整过程。',
    tags: ['React', 'TypeScript', '性能优化'],
    updatedAt: '',
  },
]

type HeroFeatureIcon = 'one-page' | 'score' | 'optimize' | 'library'

const HERO_FEATURES: Array<{
  title: string
  description: string
  icon: HeroFeatureIcon
  iconClassName: string
}> = [
  {
    title: '智能一页',
    description: '不删内容、不挤版面，把多页简历合成一张连续长页，一页完整导出',
    icon: 'one-page',
    iconClassName: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'AI 评分',
    description: '多维分析内容、结构和表达，快速定位简历短板',
    icon: 'score',
    iconClassName: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'AI 优化',
    description: '逐段打磨内容，让职责、行动与成果表达得更具体',
    icon: 'optimize',
    iconClassName: 'bg-violet-100 text-violet-700',
  },
  {
    title: '岗位简历参考',
    description: '按岗位查找高质量范例，快速获得结构与表达灵感',
    icon: 'library',
    iconClassName: 'bg-emerald-100 text-emerald-700',
  },
]

function FeatureIcon({ icon }: { icon: HeroFeatureIcon }) {
  if (icon === 'score') {
    return (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
      </svg>
    )
  }

  if (icon === 'optimize') {
    return (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 4 .7 2.1L18 7l-2.3.9L15 10l-.7-2.1L12 7l2.3-.9L15 4ZM7.5 10l1.2 3.3L12 14.5l-3.3 1.2L7.5 19l-1.2-3.3L3 14.5l3.3-1.2L7.5 10ZM18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      </svg>
    )
  }

  if (icon === 'library') {
    return (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 4.5h11A1.5 1.5 0 0 1 18.5 6v13H7.25A2.25 2.25 0 0 1 5 16.75V5.5A1 1 0 0 1 6 4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 16.75A2.25 2.25 0 0 1 7.25 14.5h11.25M9 8h5" />
      </svg>
    )
  }

  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h4M9 12h6M9 15h6M9 18h4" />
    </svg>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { isAuthenticated, initialized, user } = useAuthStore()
  const createResume = useResumeStore((state) => state.createResume)
  const readyAuthenticated = initialized && isAuthenticated
  const [homeData, setHomeData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingResume, setCreatingResume] = useState(false)
  const [createResumeError, setCreateResumeError] = useState('')
  const testimonials = (homeData?.testimonials.length ?? 0) >= 3
    ? homeData!.testimonials
    : MOCK_TESTIMONIALS
  const showcases = (homeData?.showcases.length ?? 0) > 1
    ? homeData!.showcases
    : MOCK_SHOWCASES

  useEffect(() => {
    const loadHome = async () => {
      setLoading(true)
      try {
        const { data: res } = await publicApi.home()
        setHomeData(res.data)
      } catch (err: unknown) {
        console.error('[home] Failed to load public content', err)
        setError('优质简历暂时加载失败，请稍后刷新重试。')
      } finally {
        setLoading(false)
      }
    }

    void loadHome()
  }, [])

  const handleStartCreating = async () => {
    if (creatingResume) {
      return
    }

    setCreateResumeError('')
    setCreatingResume(true)
    try {
      const resume = await createResume()
      navigate(buildResumeEditorPath(resume.id))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建简历失败，请稍后重试'
      setCreateResumeError(message)
    } finally {
      setCreatingResume(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-gray-200 bg-white">
          <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-56 left-1/3 h-96 w-96 rounded-full bg-blue-50 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)] lg:gap-16 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3.5 py-1.5 text-sm font-medium text-primary-700">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                AI 评分 · 智能优化 · 一页排版
              </div>
              <h1 className="mt-5 text-[1.75rem] font-bold leading-[1.15] tracking-tight text-gray-950 sm:text-[2.6rem] lg:text-5xl">
                <span className="block">让 AI 和你一起，</span>
                <span className="mt-1 block text-primary-600">写一份高质量简历。</span>
                <span className="mt-3 block text-[0.62em] font-semibold leading-snug tracking-normal text-gray-800">
                  面试官和HR看一眼就会爱上
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-gray-600 sm:text-lg">
                从 AI 评分到问题诊断，再到内容优化与智能排版，派简历不仅能为你提供写作灵感，还能把枯燥乏味的工作经历、实习经历和项目经历提炼升华，让你的简历投了就有面试，面试了就能拿offer。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                {!initialized ? (
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white opacity-60"
                  >
                    正在加载…
                  </button>
                ) : readyAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => void handleStartCreating()}
                    disabled={creatingResume}
                    aria-busy={creatingResume}
                    className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingResume ? '正在创建…' : '开始制作简历'}
                  </button>
                ) : (
                  <Link
                    to="/register"
                    className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    开始制作简历
                  </Link>
                )}
                <Link
                  to={EXCELLENT_RESUMES_PATH}
                  className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-primary-200 hover:text-primary-700"
                >
                  浏览优质简历
                </Link>
                <a
                  href={GITHUB_REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-1 py-3 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  GitHub源码获取
                  <span aria-hidden="true">↗</span>
                </a>
                {user?.admin ? (
                  <Link
                    to="/admin"
                    className="rounded-lg border border-primary-200 bg-primary-50 px-5 py-3 text-sm font-medium text-primary-700 transition-colors hover:border-primary-300"
                  >
                    进入管理后台
                  </Link>
                ) : null}
              </div>
              {createResumeError ? (
                <p className="mt-3 text-sm text-red-600" role="alert">{createResumeError}</p>
              ) : null}
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0" aria-label="派简历核心能力">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary-100/80 via-white to-blue-100/70 blur-2xl" />
              <div className="relative rounded-[1.75rem] border border-primary-100/80 bg-white/90 p-4 shadow-[0_28px_70px_-28px_rgba(30,64,175,0.35)] backdrop-blur sm:p-5">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">一站式智能简历优化</div>
                    <div className="mt-1 text-xs text-gray-500">从发现问题到完成修改</div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    AI 全程协作
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {HERO_FEATURES.map((feature) => (
                    <div
                      key={feature.title}
                      className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary-100 hover:bg-white hover:shadow-md"
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconClassName}`}>
                        <FeatureIcon icon={feature.icon} />
                      </div>
                      <h2 className="mt-4 text-base font-semibold text-gray-900">{feature.title}</h2>
                      <p className="mt-1.5 text-sm leading-6 text-gray-500">{feature.description}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary-600 px-4 py-3.5 text-white shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16.5 8.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">内容、表达、排版，层层优化</div>
                    <div className="mt-0.5 text-xs text-primary-100">看得见问题，也看得见怎么改</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">优质简历库</h2>
              <p className="mt-2 text-sm text-gray-500">按岗位查看高质量简历，快速找到内容结构、项目写法和排版思路。</p>
            </div>
          </div>

          {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <div className="mt-6 text-sm text-gray-500">内容加载中…</div>
          ) : showcases.length ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {showcases.map((showcase) => (
                <Link
                  key={showcase.id}
                  to={EXCELLENT_RESUMES_PATH}
                  className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white px-5 py-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-primary-700">精选简历</div>
                      <div className="mt-2 text-lg font-semibold leading-7 text-gray-900">{showcase.title}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700">
                      {showcase.scoreLabel}
                    </span>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-6 text-gray-600">{showcase.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {showcase.tags?.map((tag) => (
                      <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-medium text-primary-700">
                    <span>查看简历结构</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-sm text-gray-500">
              更多岗位简历正在持续更新。
            </div>
          )}
        </section>

        <section className="border-y border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">用户评价</h2>
              <p className="mt-2 text-sm text-gray-500">从内容梳理到版式呈现，看看大家的使用感受。</p>
            </div>

            {loading ? (
              <div className="mt-6 text-sm text-gray-500">内容加载中…</div>
            ) : testimonials.length ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {testimonials.map((testimonial, index) => (
                  <div key={testimonial.id} className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-5 py-5">
                    <div className="flex items-start gap-3">
                      <div
                        aria-hidden="true"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${'avatarClassName' in testimonial ? testimonial.avatarClassName : ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700'][index % 3]}`}
                      >
                        {testimonial.displayName.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-gray-900">{testimonial.displayName}</div>
                          <div className="shrink-0 text-sm tracking-wide text-amber-400" aria-label={`${testimonial.rating} 分`}>
                            {'★'.repeat(testimonial.rating)}
                          </div>
                        </div>
                        <div className="mt-1 text-sm leading-5 text-gray-500">
                          {testimonial.schoolOrCompany} · {testimonial.targetRole}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-gray-600">{testimonial.testimonialText}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-sm text-gray-500">
                用户评价正在陆续更新，欢迎稍后再来看看。
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
