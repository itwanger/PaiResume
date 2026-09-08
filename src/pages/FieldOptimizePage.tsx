import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { resumeApi, type AiFieldOptimizeRequest, type FieldOptimizeMethod, type ResumeModule } from '../api/resume'
import { AiGenerationProgress } from '../components/ui/AiGenerationProgress'
import { OptimizeCandidateCard } from '../components/modules/OptimizeCandidateCard'
import { Header } from '../components/layout/Header'
import { useResumeStore } from '../store/resumeStore'
import { readLocalModuleDraft, useAutoSave } from '../hooks/useAutoSave'
import { normalizeInternshipContent, normalizeProjectContent, normalizeResearchContent, normalizeSkillContent } from '../utils/moduleContent'
import { countDisplayCharacters } from '../utils/displayTextCount'
import { candidateFilters, readCandidateTags, type CandidateTag } from '../utils/optimizeCandidateTags'
import { isResearchOptimizeField, researchOptimizeFields } from '../utils/researchOptimizeFields'
import './FieldOptimizePage.css'

type PageStatus = 'idle' | 'streaming' | 'completed' | 'error'
const EXPERIENCE_RESPONSIBILITY_INDEX_STRIDE = 1000

interface OptimizePageState {
  candidateTags?: CandidateTag[][]
  elapsedMs?: number
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
  moduleType: 'internship' | 'work_experience' | 'project' | 'skill' | 'research'
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

  if (module.moduleType === 'research' && isResearchOptimizeField(fieldType)) {
    const { key, title } = researchOptimizeFields[fieldType]
    return {
      title,
      original: normalizeResearchContent(module.content)[key].trim(),
      multiCandidate: true,
      request: { fieldType },
      moduleType: 'research',
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

  if (module.moduleType === 'research' && isResearchOptimizeField(fieldType)) {
    return { ...module.content, [researchOptimizeFields[fieldType].key]: optimizedText }
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

  const { modules, loading, currentResumeId, fetchModules } = useResumeStore()
  const { saveNow: saveAdoptedContent } = useAutoSave(resumeId, numericModuleId)
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
  const [candidateFilter, setCandidateFilter] = useState<CandidateTag | 'all'>('all')
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
            candidateTags: readCandidateTags(latestRecord.candidateTags, nextCandidates.length),
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
    setCandidateFilter('all')
    setGenerationStage('正在分析原文…')
    const abortController = new AbortController()
    const startedAt = performance.now()
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
              setGenerationStage('正在分析原文…')
              return
            }
            if (event.event === 'meta') {
              setState((prev) => ({
                ...prev,
                original: typeof event.data.original === 'string' && event.data.original.trim() ? event.data.original : prev.original,
              }))
              return
            }
            if (event.event === 'status') {
              // Transport status is not model reasoning.
              return
            }
            if (event.event === 'reasoning_delta') {
              setGenerationStage('正在思考…')
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
        elapsedMs: performance.now() - startedAt,
        optimized: fieldContext.multiCandidate ? undefined : nextOptimized,
        candidates: nextCandidates,
        candidateTags: readCandidateTags(result.candidateTags, nextCandidates.length),
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
      // Merge into the latest recoverable draft, then commit through the same
      // save lifecycle as the editor so it cannot restore an older draft on return.
      const localDraft = readLocalModuleDraft(resumeId, numericModuleId)
      const nextContent = applyOptimizedText(
        localDraft ? { ...module, content: localDraft } : module,
        fieldType,
        optimizedText,
        projectIndex,
        Number.isFinite(index) ? index : null,
      )
      await saveAdoptedContent(nextContent)
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
  const candidateTags = useMemo(() => readCandidateTags(state.candidateTags, state.candidates?.length ?? 0), [state.candidateTags, state.candidates])
  const hasVisibleCandidates = candidateTags.some(tags => candidateFilter === 'all' || tags.includes(candidateFilter))
  const backLabel = pageTitle ? `返回${pageTitle}编辑` : '返回编辑器'

  return (
    <div className="field-optimize-page min-h-screen bg-slate-50">
      <Header enableResumeDrop />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 py-1 text-slate-500 hover:text-primary-700">
            <span aria-hidden="true">←</span>{backLabel}
          </button>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <h1 className="font-semibold text-slate-900">{pageTitle} · AI 优化</h1>
        </div>
        {state.error ? <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
        {!fieldContext && !loading ? (
          <div className="py-12 text-sm text-slate-500">当前优化参数无效，无法定位到对应字段。</div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(340px,0.95fr)_minmax(0,2fr)]">
            <aside className="min-w-0 space-y-5">
              <section className="fo-panel rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="border-l-4 border-primary-500 pl-3 font-semibold text-slate-900">优化前</h2>
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs tabular-nums text-primary-700">{countDisplayCharacters(state.original)} 字</span>
                </div>
                <p className="fo-original max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-8 text-slate-700">
                  {state.original || (loading ? '正在加载字段内容…' : '当前字段暂无内容。')}
                </p>
              </section>
              <section className="fo-panel rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="fo-label mb-4 text-sm font-medium text-slate-700">优化方式</h2>
                <div className="fo-methods grid grid-cols-2 gap-2" role="group" aria-label="优化方式">
                  {methods.map((preset) => (
                    <button key={preset.id} type="button" aria-pressed={selectedPreset === preset.id} disabled={isStreaming} onClick={() => setSelectedPreset(preset.id)}
                      className={`cursor-pointer rounded-lg border px-2 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${selectedPreset === preset.id ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-primary-300 hover:bg-primary-50'}`}>
                      {preset.name}{preset.id === 'asu' ? <span aria-hidden="true" className="fo-beta">BETA</span> : null}
                    </button>
                  ))}
                </div>
                {methodsError ? <p role="alert" className="mt-3 text-sm text-red-600">{methodsError}</p> : <p className="fo-description mt-4 text-sm leading-7 text-slate-500">{methods.find((method) => method.id === selectedPreset)?.description}</p>}
                <div className="mt-6"><h2 className="fo-label mb-3 text-sm font-medium">操作</h2>
                  <AiGenerationProgress layout="sidebar" key={state.status} status={state.status} reasoning={state.reasoning} stage={generationStage} elapsedMs={state.elapsedMs}
                    action={
                      <button type="button" onClick={() => void handleStartOptimize()} disabled={isStreaming || !fieldContext || !methods.some((method) => method.id === selectedPreset)}
                        className="fo-generate inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <svg aria-hidden="true" className={`h-4 w-4 ${isStreaming ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M16 7a6 6 0 0 0-10-2L3 8m0-5v5h5M4 13a6 6 0 0 0 10 2l3-3m0 5v-5h-5" /></svg>
                        {isStreaming ? '优化中…' : state.status === 'idle' ? '开始优化' : '重新生成'}
                      </button>
                    }
                  />
                </div>
              </section>
            </aside>
            <section className="min-w-0" aria-label="优化版本">
              <div className="fo-panel fo-results-heading mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
                <h2 className="border-l-4 border-emerald-500 pl-3 font-semibold text-slate-900">优化版本</h2>
                <div role="group" aria-label="筛选优化版本" className="fo-filters flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                  {candidateFilters.map(filter => <button key={filter.id} type="button" aria-pressed={candidateFilter === filter.id} onClick={() => setCandidateFilter(filter.id)}>{filter.label}</button>)}
                </div>
              </div>
              {fieldContext?.multiCandidate ? (
                state.candidates && state.candidates.length > 0 ? <div className="fo-candidates grid items-stretch gap-4 md:grid-cols-3">
                  {state.candidates.map((candidate, candidateIndex) => <div key={`${candidateIndex}-${candidate}`} hidden={candidateFilter !== 'all' && !candidateTags[candidateIndex]?.includes(candidateFilter)} className="min-w-0 [&>article]:h-full">
                    <OptimizeCandidateCard tags={candidateTags[candidateIndex]} label={`版本 ${candidateIndex + 1}`} value={candidateDrafts[candidateIndex] ?? candidate} saving={saving} onChange={(value) => handleCandidateDraftChange(candidateIndex, value)} onAdopt={(value) => void handleAdopt(value)} />
                  </div>)}
                  {!hasVisibleCandidates ? <p role="status" className="col-span-full py-12 text-center text-sm text-slate-500">暂无符合此分类的版本</p> : null}
                </div> : <div role="status" className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 text-sm text-slate-400">{isStreaming ? '正在生成候选版本…' : '暂无候选版本'}</div>
              ) : state.optimized ? (
                <OptimizeCandidateCard key={state.optimized} label="优化后" value={optimizedDraft} saving={saving} onChange={setOptimizedDraft} onAdopt={(value) => void handleAdopt(value)} />
              ) : <div role="status" className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 text-sm text-slate-400">{isStreaming ? '正在生成优化结果…' : '暂无优化结果'}</div>}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
