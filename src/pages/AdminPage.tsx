import { useEffect, useMemo, useState } from 'react'
import {
  adminApi,
  type CouponAdmin,
  type FeedbackSubmissionAdmin,
  type PlatformConfig,
  type ResumeShowcaseAdmin,
  type UserAdmin,
} from '../api/admin'
import { resumeApi, type ResumeListItem } from '../api/resume'
import { Header } from '../components/layout/Header'

function formatCents(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

const EMPTY_SHOWCASE_FORM = {
  id: null as number | null,
  resumeId: '',
  slug: '',
  scoreLabel: '',
  summary: '',
  tags: '',
  displayOrder: '0',
  publishStatus: 'DRAFT',
}

export default function AdminPage() {
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    membershipPriceCents: 6600,
    questionnaireCouponAmountCents: 1000,
  })
  const [feedbacks, setFeedbacks] = useState<FeedbackSubmissionAdmin[]>([])
  const [coupons, setCoupons] = useState<CouponAdmin[]>([])
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [showcases, setShowcases] = useState<ResumeShowcaseAdmin[]>([])
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [showcaseForm, setShowcaseForm] = useState(EMPTY_SHOWCASE_FORM)
  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [submittingShowcase, setSubmittingShowcase] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void loadAll()
  }, [])

  const showcaseOptions = useMemo(() => resumes.map((resume) => ({
    label: resume.title,
    value: String(resume.id),
  })), [resumes])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [
        platformConfigRes,
        feedbackRes,
        couponRes,
        userRes,
        showcaseRes,
        resumesRes,
      ] = await Promise.all([
        adminApi.getPlatformConfig(),
        adminApi.listFeedbackSubmissions(),
        adminApi.listCoupons(),
        adminApi.listUsers(),
        adminApi.listShowcases(),
        resumeApi.list(),
      ])

      setPlatformConfig(platformConfigRes.data.data)
      setFeedbacks(feedbackRes.data.data)
      setCoupons(couponRes.data.data)
      setUsers(userRes.data.data)
      setShowcases(showcaseRes.data.data)
      setResumes(resumesRes.data.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '后台数据加载失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshFeedbacks() {
    const { data: res } = await adminApi.listFeedbackSubmissions()
    setFeedbacks(res.data)
  }

  async function refreshUsers() {
    const { data: res } = await adminApi.listUsers()
    setUsers(res.data)
  }

  async function refreshShowcases() {
    const { data: res } = await adminApi.listShowcases()
    setShowcases(res.data)
  }

  async function refreshCoupons() {
    const { data: res } = await adminApi.listCoupons()
    setCoupons(res.data)
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    setError('')
    setSuccess('')
    try {
      const { data: res } = await adminApi.updatePlatformConfig(platformConfig)
      setPlatformConfig(res.data)
      setSuccess('平台配置已更新')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '平台配置更新失败'
      setError(message)
    } finally {
      setSavingConfig(false)
    }
  }

  const handleApprove = async (feedback: FeedbackSubmissionAdmin) => {
    const reviewNote = window.prompt('审核备注（可选）', feedback.reviewNote ?? '') ?? ''
    try {
      await adminApi.approveFeedback(feedback.id, reviewNote || undefined)
      await Promise.all([refreshFeedbacks(), refreshCoupons()])
      setSuccess('问卷已通过并发放优惠码')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '审核通过失败'
      setError(message)
    }
  }

  const handleReject = async (feedback: FeedbackSubmissionAdmin) => {
    const reviewNote = window.prompt('请输入拒绝原因', feedback.reviewNote ?? '')
    if (!reviewNote) {
      return
    }
    try {
      await adminApi.rejectFeedback(feedback.id, reviewNote)
      await Promise.all([refreshFeedbacks(), refreshCoupons()])
      setSuccess('问卷已拒绝')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '拒绝问卷失败'
      setError(message)
    }
  }

  const handlePublish = async (feedback: FeedbackSubmissionAdmin, nextAction: 'publish' | 'unpublish') => {
    try {
      if (nextAction === 'publish') {
        await adminApi.publishFeedback(feedback.id)
      } else {
        await adminApi.unpublishFeedback(feedback.id)
      }
      await refreshFeedbacks()
      setSuccess(nextAction === 'publish' ? '评价已发布' : '评价已下线')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '操作失败'
      setError(message)
    }
  }

  const handleResendCoupon = async (feedback: FeedbackSubmissionAdmin) => {
    try {
      await adminApi.resendCoupon(feedback.id)
      await Promise.all([refreshFeedbacks(), refreshCoupons()])
      setSuccess('优惠码已重发')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '重发失败'
      setError(message)
    }
  }

  const handleMembership = async (userId: number, action: 'grant' | 'revoke') => {
    try {
      if (action === 'grant') {
        await adminApi.grantMembership(userId)
      } else {
        await adminApi.revokeMembership(userId)
      }
      await refreshUsers()
      setSuccess(action === 'grant' ? '会员已开通' : '会员已撤销')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '会员操作失败'
      setError(message)
    }
  }

  const handleSubmitShowcase = async () => {
    setSubmittingShowcase(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        resumeId: Number(showcaseForm.resumeId),
        slug: showcaseForm.slug.trim(),
        scoreLabel: showcaseForm.scoreLabel.trim(),
        summary: showcaseForm.summary.trim(),
        tags: showcaseForm.tags.split(',').map((item) => item.trim()).filter(Boolean),
        displayOrder: Number(showcaseForm.displayOrder),
        publishStatus: showcaseForm.publishStatus,
      }
      if (showcaseForm.id) {
        await adminApi.updateShowcase(showcaseForm.id, payload)
      } else {
        await adminApi.createShowcase(payload)
      }
      await refreshShowcases()
      setShowcaseForm(EMPTY_SHOWCASE_FORM)
      setSuccess(showcaseForm.id ? '样例已更新' : '样例已创建')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '样例保存失败'
      setError(message)
    } finally {
      setSubmittingShowcase(false)
    }
  }

  const editShowcase = (showcase: ResumeShowcaseAdmin) => {
    setShowcaseForm({
      id: showcase.id,
      resumeId: String(showcase.resumeId),
      slug: showcase.slug,
      scoreLabel: showcase.scoreLabel,
      summary: showcase.summary,
      tags: (showcase.tags ?? []).join(', '),
      displayOrder: String(showcase.displayOrder),
      publishStatus: showcase.publishStatus,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">管理后台</h1>
          <p className="mt-2 text-sm text-gray-500">统一管理会员价格、问卷审核、优惠码、官方样例和用户会员。</p>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

        {loading ? (
          <div className="text-sm text-gray-500">加载中...</div>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900">平台配置</h2>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">会员价格（分）</span>
                    <input
                      type="number"
                      value={platformConfig.membershipPriceCents}
                      onChange={(event) => setPlatformConfig((current) => ({ ...current, membershipPriceCents: Number(event.target.value) }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">问卷优惠金额（分）</span>
                    <input
                      type="number"
                      value={platformConfig.questionnaireCouponAmountCents}
                      onChange={(event) => setPlatformConfig((current) => ({ ...current, questionnaireCouponAmountCents: Number(event.target.value) }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                    当前会员价 {formatCents(platformConfig.membershipPriceCents)}，问卷默认优惠 {formatCents(platformConfig.questionnaireCouponAmountCents)}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveConfig()}
                    disabled={savingConfig}
                    className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                  >
                    {savingConfig ? '保存中...' : '保存配置'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">官方样例管理</h2>
                    <p className="mt-1 text-sm text-gray-500">从管理员自己的简历中挑选样例，对外发布到首页。</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">关联简历</span>
                    <select
                      value={showcaseForm.resumeId}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, resumeId: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">请选择</option>
                      {showcaseOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">slug</span>
                    <input
                      value={showcaseForm.slug}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, slug: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">分数标签</span>
                    <input
                      value={showcaseForm.scoreLabel}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, scoreLabel: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">展示顺序</span>
                    <input
                      type="number"
                      value={showcaseForm.displayOrder}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, displayOrder: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">摘要</span>
                  <textarea
                    value={showcaseForm.summary}
                    onChange={(event) => setShowcaseForm((current) => ({ ...current, summary: event.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">标签（逗号分隔）</span>
                    <input
                      value={showcaseForm.tags}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, tags: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">发布状态</span>
                    <select
                      value={showcaseForm.publishStatus}
                      onChange={(event) => setShowcaseForm((current) => ({ ...current, publishStatus: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="PUBLISHED">PUBLISHED</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSubmitShowcase()}
                    disabled={submittingShowcase}
                    className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                  >
                    {submittingShowcase ? '保存中...' : showcaseForm.id ? '更新样例' : '创建样例'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowcaseForm(EMPTY_SHOWCASE_FORM)}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
                  >
                    清空表单
                  </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">slug</th>
                        <th className="py-3 pr-4 font-medium">分数标签</th>
                        <th className="py-3 pr-4 font-medium">状态</th>
                        <th className="py-3 pr-4 font-medium">排序</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {showcases.map((showcase) => (
                        <tr key={showcase.id}>
                          <td className="py-3 pr-4">{showcase.slug}</td>
                          <td className="py-3 pr-4">{showcase.scoreLabel}</td>
                          <td className="py-3 pr-4">{showcase.publishStatus}</td>
                          <td className="py-3 pr-4">{showcase.displayOrder}</td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => editShowcase(showcase)}
                              className="text-primary-700 transition-colors hover:text-primary-800"
                            >
                              编辑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900">问卷审核</h2>
              <div className="mt-5 space-y-4">
                {feedbacks.map((feedback) => (
                  <article key={feedback.id} className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {feedback.displayName} · {feedback.schoolOrCompany} · {feedback.targetRole}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {feedback.contactEmail} · 评分 {feedback.rating} / 5 · 提交于 {feedback.createdAt}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600">审核 {feedback.reviewStatus}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600">发布 {feedback.publishStatus}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600">优惠码 {feedback.couponStatus}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-gray-700">{feedback.testimonialText}</p>
                    {feedback.desiredFeatures ? <p className="mt-3 text-sm leading-6 text-gray-600">需求：{feedback.desiredFeatures}</p> : null}
                    {feedback.bugFeedback ? <p className="mt-3 text-sm leading-6 text-gray-600">Bug：{feedback.bugFeedback}</p> : null}
                    {feedback.reviewNote ? <p className="mt-3 text-sm leading-6 text-gray-500">审核备注：{feedback.reviewNote}</p> : null}
                    {feedback.coupon ? (
                      <p className="mt-3 text-sm text-primary-700">
                        优惠码：{feedback.coupon.code} · 面额 {formatCents(feedback.coupon.amountCents)}
                      </p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleApprove(feedback)}
                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white transition-colors hover:bg-primary-700"
                      >
                        通过并发码
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReject(feedback)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 transition-colors hover:border-red-300"
                      >
                        拒绝
                      </button>
                      {feedback.publishStatus === 'PUBLISHED' ? (
                        <button
                          type="button"
                          onClick={() => void handlePublish(feedback, 'unpublish')}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300"
                        >
                          下线评价
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handlePublish(feedback, 'publish')}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300"
                        >
                          发布评价
                        </button>
                      )}
                      {feedback.coupon ? (
                        <button
                          type="button"
                          onClick={() => void handleResendCoupon(feedback)}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300"
                        >
                          重发优惠码
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900">优惠码列表</h2>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">优惠码</th>
                        <th className="py-3 pr-4 font-medium">邮箱</th>
                        <th className="py-3 pr-4 font-medium">面额</th>
                        <th className="py-3 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {coupons.map((coupon) => (
                        <tr key={coupon.id}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{coupon.code}</td>
                          <td className="py-3 pr-4">{coupon.recipientEmail}</td>
                          <td className="py-3 pr-4">{formatCents(coupon.amountCents)}</td>
                          <td className="py-3">{coupon.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900">用户会员管理</h2>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-3 pr-4 font-medium">邮箱</th>
                        <th className="py-3 pr-4 font-medium">角色</th>
                        <th className="py-3 pr-4 font-medium">会员状态</th>
                        <th className="py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-900">{user.email}</div>
                            <div className="mt-1 text-xs text-gray-500">{user.createdAt}</div>
                          </td>
                          <td className="py-3 pr-4">{user.role}</td>
                          <td className="py-3 pr-4">{user.membershipStatus}</td>
                          <td className="py-3">
                            {user.membershipStatus === 'ACTIVE' ? (
                              <button
                                type="button"
                                onClick={() => void handleMembership(user.id, 'revoke')}
                                className="text-red-700 transition-colors hover:text-red-800"
                              >
                                撤销会员
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleMembership(user.id, 'grant')}
                                className="text-primary-700 transition-colors hover:text-primary-800"
                              >
                                开通会员
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
