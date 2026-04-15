import { useState, type FormEvent } from 'react'
import { publicApi } from '../api/public'
import { PublicSiteHeader } from '../components/layout/PublicSiteHeader'

const INITIAL_FORM = {
  contactEmail: '',
  displayName: '',
  schoolOrCompany: '',
  targetRole: '',
  rating: 5,
  testimonialText: '',
  desiredFeatures: '',
  bugFeedback: '',
  consentToPublish: true,
}

export default function SurveyPage() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await publicApi.submitFeedback({
        ...form,
        desiredFeatures: form.desiredFeatures.trim() || undefined,
        bugFeedback: form.bugFeedback.trim() || undefined,
      })
      setSuccess('提交成功。管理员审核通过后，会自动把优惠码发到你的邮箱。')
      setForm(INITIAL_FORM)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '提交失败，请稍后再试'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicSiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">提交评价 / 新需求 / Bug 反馈</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              问卷公开可填。管理员审核通过后，会自动把单次优惠码发到你填写的邮箱。
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">联系邮箱</span>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">展示名称</span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">学校 / 公司</span>
                <input
                  value={form.schoolOrCompany}
                  onChange={(event) => setForm((current) => ({ ...current, schoolOrCompany: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">目标岗位</span>
                <input
                  value={form.targetRole}
                  onChange={(event) => setForm((current) => ({ ...current, targetRole: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">评分</span>
              <select
                value={form.rating}
                onChange={(event) => setForm((current) => ({ ...current, rating: Number(event.target.value) }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>{rating} 分</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">评价内容</span>
              <textarea
                value={form.testimonialText}
                onChange={(event) => setForm((current) => ({ ...current, testimonialText: event.target.value }))}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">你还希望我们做什么</span>
              <textarea
                value={form.desiredFeatures}
                onChange={(event) => setForm((current) => ({ ...current, desiredFeatures: event.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Bug 反馈</span>
              <textarea
                value={form.bugFeedback}
                onChange={(event) => setForm((current) => ({ ...current, bugFeedback: event.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </label>

            <label className="flex items-center gap-3 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.consentToPublish}
                onChange={(event) => setForm((current) => ({ ...current, consentToPublish: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              我同意管理员在审核后将这段评价展示到首页
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? '提交中...' : '提交问卷'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
