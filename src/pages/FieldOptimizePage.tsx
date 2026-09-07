import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { resumeApi, type AiFieldOptimizeRequest, type FieldOptimizeMethod, type ResumeModule } from '../api/resume'
import { AiGenerationProgress } from '../components/ui/AiGenerationProgress'
import { useResumeStore } from '../store/resumeStore'
import { normalizeInternshipContent, normalizeProjectContent, normalizeSkillContent } from '../utils/moduleContent'

type PageStatus = 'idle' | 'streaming' | 'completed' | 'error'
const EXPERIENCE_RESPONSIBILITY_INDEX_STRIDE = 1000

interface OptimizePageState {
  title: string
  original: string
  streamedContent: string
  reasoning: string
  status: PageStatus
  error?: string
  optimized?: string
  candidates?: string[]
  multiCandidate: boolean
}

interface FieldContext {
  title: string
  original: string
  multiCandidate: boolean
  request: AiFieldOptimizeRequest
  moduleType: 'internship' | 'work_experience' | 'project' | 'skill'
}

function appendProcessLine(prevText: string, line: string) {
  const nextLine = line.trim()
  if (!nextLine) {
    return prevText
  }
  if (!prevText.trim()) {
    return nextLine
  }
  const rows = prevText.split('\n')
  if (rows[rows.length - 1] === nextLine) {
    return prevText
  }
  return `${prevText}\n${nextLine}`
}

function normalizeCandidates(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function formatCandidatesAsMarkdown(candidates: string[]) {
  return candidates
    .map((candidate, index) => `### 版本 ${index + 1}\n\n${candidate.trim()}`)
    .join('\n\n')
}

function parseCandidatesFromStreamedContent(content: string): string[] {
  const trimmed = content.trim()
  if (!trimmed) {
    return []
  }

  const unfenced = trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  const jsonText = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced

  try {
    const payload = JSON.parse(jsonText) as { candidates?: unknown }
    return normalizeCandidates(payload.candidates)
  } catch {
    return []
  }
}

function countDisplayCharacters(value: string) {
  return value.replace(/\s+/g, '').length
}

function encodeExperienceResponsibilityIndex(projectIndex: number, responsibilityIndex: number) {
  return projectIndex * EXPERIENCE_RESPONSIBILITY_INDEX_STRIDE + responsibilityIndex
}

function deriveFieldContext(
  module: ResumeModule | undefined,
  fieldType: string | null,
  projectIndex: number,
  responsibilityIndex: number | null,
): FieldContext | null {
  if (!module || !fieldType) {
    return null
  }

  if (module.moduleType === 'internship' || module.moduleType === 'work_experience') {
    const content = normalizeInternshipContent(module.content)
    const project = content.projects[projectIndex]
    if (!project) return null
    if (fieldType === 'project_description') {
      return {
        title: '项目简介',
        original: project.projectDescription.trim(),
        multiCandidate: true,
        request: { fieldType: 'project_description', index: projectIndex },
        moduleType: module.moduleType,
      }
    }
    if (fieldType === 'responsibility' && responsibilityIndex !== null) {
      return {
        title: `核心职责 ${responsibilityIndex + 1}`,
        original: project.responsibilities[responsibilityIndex]?.trim() || '',
        multiCandidate: true,
        request: { fieldType: 'responsibility', index: encodeExperienceResponsibilityIndex(projectIndex, responsibilityIndex) },
        moduleType: module.moduleType,
      }
    }
    return null
  }

  if (module.moduleType === 'project') {
    const content = normalizeProjectContent(module.content)
    if (fieldType === 'project_description') {
      return {
        title: '项目描述',
        original: content.description.trim(),
        multiCandidate: true,
        request: { fieldType: 'project_description' },
        moduleType: 'project',
      }
    }
    if (fieldType === 'responsibility' && responsibilityIndex !== null) {
      return {
        title: `核心职责 ${responsibilityIndex + 1}`,
        original: content.achievements[responsibilityIndex]?.trim() || '',
        multiCandidate: true,
        request: { fieldType: 'responsibility', index: responsibilityIndex },
        moduleType: 'project',
      }
    }
  }

  if (module.moduleType === 'skill' && fieldType === 'skill' && responsibilityIndex !== null) {
    const items = normalizeSkillContent(module.content).categories.flatMap((category) => category.items)
    return {
      title: `专业技能 ${responsibilityIndex + 1}`,
      original: items[responsibilityIndex]?.trim() || '',
      multiCandidate: true,
      request: { fieldType: 'skill', index: responsibilityIndex },
      moduleType: 'skill',
    }
  }

  return null
}

function applyOptimizedText(
  module: ResumeModule,
  fieldType: string,
  optimizedText: string,
  projectIndex: number,
  responsibilityIndex: number | null,
) {
  if (module.moduleType === 'internship' || module.moduleType === 'work_experience') {
    const content = normalizeInternshipContent(module.content)
    const projects = content.projects.map((project, index) => {
      if (index !== projectIndex) return project
      if (fieldType === 'project_description') return { ...project, projectDescription: optimizedText }
      if (fieldType === 'responsibility' && responsibilityIndex !== null) {
        const responsibilities = [...project.responsibilities]
        responsibilities[responsibilityIndex] = optimizedText
        return { ...project, responsibilities }
      }
      return project
    })
    return { ...content, projects }
  }

  if (module.moduleType === 'project') {
    const content = normalizeProjectContent(module.content)
    if (fieldType === 'project_description') {
      return { ...content, description: optimizedText }
    }
    if (fieldType === 'responsibility' && responsibilityIndex !== null) {
      const achievements = [...content.achievements]
      achievements[responsibilityIndex] = optimizedText
      return { ...content, achievements }
    }
  }

  if (module.moduleType === 'skill' && fieldType === 'skill' && responsibilityIndex !== null) {
    const content = normalizeSkillContent(module.content)
    const items = content.categories.flatMap((category) => category.items)
    if (responsibilityIndex >= 0 && responsibilityIndex < items.length) {
      items[responsibilityIndex] = optimizedText
    }
    return { categories: [{ name: '', items }] }
  }

  return module.content
}

export default function FieldOptimizePage() {
  const navigate = useNavigate()
  const { id, moduleId } = useParams<{ id: string; moduleId: string }>()
  const [searchParams] = useSearchParams()
  const resumeId = Number(id)
  const numericModuleId = Number(moduleId)
  const fieldType = searchParams.get('fieldType')
  const returnModuleType = searchParams.get('returnModuleType')
  const parsedIndex = searchParams.get('index')
  const index = parsedIndex === null ? null : Number(parsedIndex)
  const parsedProjectIndex = Number(searchParams.get('projectIndex') || 0)
  const projectIndex = Number.isSafeInteger(parsedProjectIndex) && parsedProjectIndex >= 0 ? parsedProjectIndex : 0

  const { modules, loading, currentResumeId, fetchModules, updateModuleContent } = useResumeStore()
  const module = modules.find((item) => item.id === numericModuleId)
  const fieldContext = useMemo(
    () => deriveFieldContext(module, fieldType, projectIndex, Number.isFinite(index) ? index : null),
    [module, fieldType, projectIndex, index]
  )
  const [methods, setMethods] = useState<FieldOptimizeMethod[]>([])
  const [methodsError, setMethodsError] = useState('')
  const streamAbortRef = useRef<AbortController | null>(null)
  const streamedContentRef = useRef('')
  const [generationStage, setGenerationStage] = useState('正在分析原文…')
  const [saving, setSaving] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('standard')
  const [candidateDrafts, setCandidateDrafts] = useState<string[]>([])
  const [optimizedDraft, setOptimizedDraft] = useState('')
  const [state, setState] = useState<OptimizePageState>({
    title: '字段 AI 优化',
    original: '',
    streamedContent: '',
    reasoning: '',
    status: 'idle',
    multiCandidate: false,
  })

  useEffect(() => () => {
    streamAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    let mounted = true
    void resumeApi.getFieldOptimizeMethods()
      .then((response) => {
        if (!mounted) {
          return
        }
        setMethods(response.data.data)
      })
      .catch(() => {
        if (!mounted) {
          return
        }
        setMethodsError('优化方式加载失败，请刷新页面重试。')
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!resumeId) {
      return
    }
    if (currentResumeId !== resumeId || modules.length === 0) {
      void fetchModules(resumeId)
    }
  }, [resumeId, currentResumeId, modules.length, fetchModules])

  useEffect(() => {
    if (!fieldContext) {
      return
    }
    setState({
      title: fieldContext.title,
      original: fieldContext.original,
      streamedContent: '',
      reasoning: '',
      status: fieldContext.original.trim() ? 'idle' : 'error',
      error: fieldContext.original.trim() ? undefined : '当前字段内容为空，暂时无法优化。',
      multiCandidate: fieldContext.multiCandidate,
    })
    streamedContentRef.current = ''
    setCandidateDrafts([])
    setOptimizedDraft('')
  }, [fieldContext])

  useEffect(() => {
    if (!fieldContext || !resumeId || !numericModuleId) {
      return
    }

    let active = true
    void resumeApi.getLatestFieldOptimizeRecord(resumeId, numericModuleId, {
      fieldType: fieldContext.request.fieldType,
      index: fieldContext.request.index ?? null,
    })
      .then((response) => {
        if (!active) {
          return
        }

        const latestRecord = response.data.data
        if (!latestRecord) {
          return
        }

        const nextCandidates = fieldContext.multiCandidate ? normalizeCandidates(latestRecord.candidates) : []
        const nextOptimized = fieldContext.multiCandidate ? '' : (latestRecord.optimized || '')
        const nextStreamedContent = latestRecord.streamedContent || (
          fieldContext.multiCandidate
            ? formatCandidatesAsMarkdown(nextCandidates)
            : nextOptimized
        )

        streamedContentRef.current = nextStreamedContent
        setCandidateDrafts(nextCandidates)
        setOptimizedDraft(nextOptimized)
        setState((prev) => {
          if (prev.status === 'streaming') {
            return prev
          }
          return {
            ...prev,
            title: fieldContext.title,
            original: latestRecord.original?.trim() ? latestRecord.original : fieldContext.original,
            streamedContent: nextStreamedContent,
            reasoning: latestRecord.reasoning || '',
            status: latestRecord.status === 'error' ? 'error' : 'completed',
            error: latestRecord.error || undefined,
            optimized: fieldContext.multiCandidate ? undefined : nextOptimized,
            candidates: nextCandidates,
            multiCandidate: fieldContext.multiCandidate,
          }
        })
      })
      .catch(() => {
        if (!active) {
          return
        }
      })

    return () => {
      active = false
    }
  }, [fieldContext, resumeId, numericModuleId])

  const handleBack = () => {
    streamAbortRef.current?.abort()
    const params = new URLSearchParams()
    const moduleType = module?.moduleType || returnModuleType
    if (moduleType) params.set('moduleType', moduleType)
    navigate(`/editor/${resumeId}?${params}`, {
      state: {
        fieldOptimizeReturn: {
          moduleId: numericModuleId,
          projectIndex,
          fieldType,
          index: Number.isSafeInteger(index) && index !== null && index >= 0 ? index : null,
        },
      },
    })
  }

  const handleStartOptimize = async () => {
    if (!fieldContext || !module || !resumeId || !numericModuleId) {
      return
    }
    if (!fieldContext.original.trim()) {
      setState((prev) => ({ ...prev, status: 'error', error: '当前字段内容为空，暂时无法优化。' }))
      return
    }

    if (!methods.some((method) => method.id === selectedPreset)) return

    streamAbortRef.current?.abort()
    setGenerationStage('正在分析原文…')
    const abortController = new AbortController()
    streamAbortRef.current = abortController

    setState({
      title: fieldContext.title,
      original: fieldContext.original,
      streamedContent: '',
      reasoning: '',
      status: 'streaming',
      error: undefined,
      optimized: undefined,
      candidates: [],
      multiCandidate: fieldContext.multiCandidate,
    })
    streamedContentRef.current = ''
    setCandidateDrafts([])
    setOptimizedDraft('')

    try {
      const result = await resumeApi.aiOptimizeFieldStream(
        resumeId,
        numericModuleId,
          {
            ...fieldContext.request,
            presetId: selectedPreset,
          },
        {
          signal: abortController.signal,
          onEvent: (event) => {
            if (event.event === 'connected') {
              setState((prev) => ({ ...prev, reasoning: appendProcessLine(prev.reasoning, '已连接 AI 服务，开始生成。') }))
              return
            }
            if (event.event === 'meta') {
              setState((prev) => ({
                ...prev,
                original: typeof event.data.original === 'string' && event.data.original.trim() ? event.data.original : prev.original,
                reasoning: appendProcessLine(prev.reasoning, '已读取当前字段原文。'),
              }))
              return
            }
            if (event.event === 'status') {
              setState((prev) => ({
                ...prev,
                reasoning: appendProcessLine(
                  prev.reasoning,
                  typeof event.data.message === 'string' ? event.data.message : 'AI 正在处理中。'
                ),
              }))
              return
            }
            if (event.event === 'reasoning_delta') {
              setState((prev) => ({
                ...prev,
                reasoning: typeof event.data.text === 'string' ? event.data.text : prev.reasoning,
              }))
              return
            }
            if (event.event === 'content_delta') {
              const nextStreamedContent = typeof event.data.text === 'string' ? event.data.text : streamedContentRef.current
              setGenerationStage('正在整理优化版本…')
              streamedContentRef.current = nextStreamedContent
              setState((prev) => ({
                ...prev,
                streamedContent: nextStreamedContent,
              }))
              return
            }
            if (event.event === 'error') {
              setState((prev) => ({
                ...prev,
                status: 'error',
                error: typeof event.data.message === 'string' ? event.data.message : 'AI 优化失败，请稍后重试',
              }))
            }
          },
        }
      )

      const nextCandidates = fieldContext.multiCandidate
        ? (() => {
            const candidates = normalizeCandidates(result.candidates)
            const streamedCandidates = parseCandidatesFromStreamedContent(streamedContentRef.current)
            const resolvedCandidates = candidates.length > 0 ? candidates : streamedCandidates
            return resolvedCandidates.length > 0 ? resolvedCandidates : (result.optimized ? [result.optimized] : [])
          })()
        : []
      const nextOptimized = fieldContext.multiCandidate ? '' : result.optimized
      setCandidateDrafts(nextCandidates)
      setOptimizedDraft(nextOptimized)
      setState((prev) => ({
        ...prev,
        title: fieldContext.title,
        original: result.original,
        streamedContent: prev.streamedContent || (fieldContext.multiCandidate
          ? formatCandidatesAsMarkdown(nextCandidates)
          : result.optimized),
        reasoning: prev.reasoning,
        status: 'completed',
        optimized: fieldContext.multiCandidate ? undefined : nextOptimized,
        candidates: nextCandidates,
      }))
    } catch (error: unknown) {
      if (abortController.signal.aborted) {
        return
      }
      const message = error instanceof Error ? error.message : 'AI 优化失败，请稍后重试'
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: message,
      }))
    } finally {
      if (streamAbortRef.current === abortController) {
        streamAbortRef.current = null
      }
    }
  }

  const handleCandidateDraftChange = (candidateIndex: number, value: string) => {
    setCandidateDrafts((prev) => prev.map((item, index) => (index === candidateIndex ? value : item)))
  }

  const handleAdopt = async (optimizedText: string) => {
    if (!module || !fieldType) {
      return
    }
    setSaving(true)
    try {
      const nextContent = applyOptimizedText(
        module,
        fieldType,
        optimizedText,
        projectIndex,
        Number.isFinite(index) ? index : null,
      )
      await updateModuleContent(resumeId, numericModuleId, nextContent)
      handleBack()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '回填优化结果失败，请稍后重试'
      setState((prev) => ({ ...prev, error: message }))
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = fieldContext?.title || '字段 AI 优化'
  const isStreaming = state.status === 'streaming'
  const backLabel = pageTitle ? `返回${pageTitle}编辑` : '返回编辑器'

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <div className="mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 py-1 text-sm text-slate-500 transition hover:text-primary-700"
          >
            <span aria-hidden="true">←</span>
            {backLabel}
          </button>
        </div>

        {state.error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {!fieldContext && !loading ? (
          <div className="py-12 text-sm text-slate-500">
            当前优化参数无效，无法定位到对应字段。
          </div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">简历内容优化</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-slate-700">优化方式</span>
              {methods.map((preset) => {
                const isActive = selectedPreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isStreaming}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-primary-700'
                    }`}
                  >
                    {preset.name}
                  </button>
                )
              })}
            </div>

            {methodsError ? <p role="alert" className="text-sm text-red-600">{methodsError}</p> : (
              <p className="text-sm leading-6 text-slate-600">{methods.find((method) => method.id === selectedPreset)?.description}</p>
            )}

            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <AiGenerationProgress key={state.status} status={state.status} reasoning={state.reasoning} stage={generationStage} />
              <button
                type="button"
                onClick={() => void handleStartOptimize()}
                disabled={isStreaming || !fieldContext || !methods.some((method) => method.id === selectedPreset)}
                className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isStreaming ? '优化中…' : state.status === 'idle' ? '开始优化' : '重新生成'}
              </button>
            </div>

            <div className="grid items-start gap-8 pt-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
                <section className="min-w-0 lg:sticky lg:top-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-800">优化前</div>
                    <div className="text-xs text-slate-500">
                      {countDisplayCharacters(state.original)} 字
                    </div>
                  </div>
                  <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-8 text-slate-600">
                    {state.original || (loading ? '正在加载字段内容...' : '当前字段暂无内容。')}
                  </pre>
                </section>

                <div className="min-w-0 border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                {fieldContext?.multiCandidate ? (
                  <section className="min-w-0">
                    <div className="mb-5 text-sm font-medium text-slate-800">优化版本</div>
                    <div className="divide-y divide-slate-100">
                      {state.candidates && state.candidates.length > 0 ? state.candidates.map((candidate, candidateIndex) => (
                        <div key={`${candidateIndex}-${candidate}`} className="py-6 first:pt-0 last:pb-0">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-primary-700">版本 {candidateIndex + 1}</div>
                              <div className="text-xs text-slate-500">
                                {countDisplayCharacters(candidateDrafts[candidateIndex] ?? candidate)} 字
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleAdopt((candidateDrafts[candidateIndex] || candidate).trim())}
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {saving ? '回填中...' : '采纳这个版本'}
                            </button>
                          </div>
                          <textarea
                            aria-label={`版本 ${candidateIndex + 1}内容`}
                            value={candidateDrafts[candidateIndex] ?? candidate}
                            onChange={(event) => handleCandidateDraftChange(candidateIndex, event.target.value)}
                            rows={4}
                            className="w-full resize-y rounded-lg border-0 bg-slate-50/70 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition hover:bg-slate-50 focus:ring-2 focus:ring-primary-200"
                          />
                        </div>
                      )) : (
                        <div className="py-8 text-sm text-slate-400">
                          {isStreaming ? '正在生成候选版本...' : '暂无候选版本'}
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-slate-800">优化后</div>
                        <div className="text-xs text-slate-500">
                          {countDisplayCharacters(optimizedDraft)} 字
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => optimizedDraft.trim() && void handleAdopt(optimizedDraft.trim())}
                        disabled={!optimizedDraft.trim() || saving}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? '回填中...' : '采纳优化'}
                      </button>
                    </div>
                    {state.optimized ? (
                      <textarea
                        value={optimizedDraft}
                        onChange={(event) => setOptimizedDraft(event.target.value)}
                        rows={8}
                        className="min-h-[200px] w-full resize-y rounded-lg border-0 bg-slate-50/70 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <div className="py-8 text-sm text-slate-400">
                        {isStreaming ? '正在生成优化结果...' : '暂无优化结果'}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
