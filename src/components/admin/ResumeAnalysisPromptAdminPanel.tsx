import { useEffect, useState } from 'react'
import {
  adminApi,
  type ResumeAnalysisPromptAdmin,
} from '../../api/admin'

const MAX_PROMPT_LENGTH = 12000

export function ResumeAnalysisPromptAdminPanel() {
  const [configs, setConfigs] = useState<ResumeAnalysisPromptAdmin[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [activeCode, setActiveCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void adminApi.listResumeAnalysisPrompts()
      .then((response) => {
        if (cancelled) return
        const nextConfigs = response.data.data
        setConfigs(nextConfigs)
        setDrafts(Object.fromEntries(nextConfigs.map((item) => [item.scenarioCode, item.prompt])))
        setActiveCode((current) => current || nextConfigs[0]?.scenarioCode || '')
      })
      .catch(() => {
        if (!cancelled) setError('分析提示词加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const activeConfig = configs.find((item) => item.scenarioCode === activeCode)
  const activeDraft = activeCode ? drafts[activeCode] ?? '' : ''
  const trimmedDraft = activeDraft.trim()
  const hasChanges = Boolean(activeConfig && trimmedDraft !== activeConfig.prompt.trim())
  const overLimit = trimmedDraft.length > MAX_PROMPT_LENGTH

  const handleSave = async () => {
    if (!activeConfig || !trimmedDraft || !hasChanges || overLimit) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await adminApi.updateResumeAnalysisPrompt(
        activeConfig.scenarioCode,
        { prompt: activeDraft.trim() },
      )
      const updated = response.data.data
      setConfigs((current) => current.map((item) => (
        item.scenarioCode === updated.scenarioCode ? updated : item
      )))
      setDrafts((current) => ({ ...current, [updated.scenarioCode]: updated.prompt }))
      setSuccess(`${updated.displayName}提示词已保存`)
    } catch {
      setError('分析提示词保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" aria-label="正在加载分析提示词" />
  }

  return (
    <section className="max-w-6xl bg-white px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">求职场景</h2>
          <div className="mt-4 space-y-2" role="tablist" aria-label="分析提示词场景">
            {configs.map((config) => {
              const active = config.scenarioCode === activeCode
              return (
                <button
                  key={config.scenarioCode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveCode(config.scenarioCode)
                    setError('')
                    setSuccess('')
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  {config.displayName}
                </button>
              )
            })}
          </div>
        </div>

        {activeConfig ? (
          <div role="tabpanel" aria-label={activeConfig.displayName}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{activeConfig.displayName}</h2>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasChanges || saving || !trimmedDraft || overLimit}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-500"
              >
                {saving ? '保存中…' : '保存提示词'}
              </button>
            </div>
            <textarea
              value={activeDraft}
              onChange={(event) => {
                setDrafts((current) => ({ ...current, [activeCode]: event.target.value }))
                setSuccess('')
              }}
              rows={20}
              aria-label={`${activeConfig.displayName}分析提示词`}
              className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
            />
            {overLimit ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                分析提示词不能超过 12000 个字符
              </p>
            ) : null}
            {success ? <p className="mt-3 text-sm text-emerald-700" role="status">{success}</p> : null}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>
      ) : null}
    </section>
  )
}
