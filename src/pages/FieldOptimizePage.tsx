import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { resumeApi, type AiFieldOptimizeRequest, type ResumeModule } from '../api/resume'
import { useResumeStore } from '../store/resumeStore'
import { normalizeInternshipContent, normalizeProjectContent } from '../utils/moduleContent'

type PageStatus = 'idle' | 'streaming' | 'completed' | 'error'
type FieldType = 'project_description' | 'responsibility'

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
  moduleType: 'internship' | 'project'
}

const DEFAULT_PROJECT_DESCRIPTION_PROMPT = `你是一位技术简历专家，请只优化“项目简介”这一段原文，不要参考或扩写其他字段。

优化要求：
1. 只围绕原始项目简介改写，不补充项目名、角色、技术栈、职责等额外上下文。
2. 每个版本都控制在 1-2 句话，突出“这是一个什么系统/平台、解决什么问题、核心价值是什么”。
3. 不要展开到职责细节，不要堆技术栈，不要编造事实、数据、业务规模。
4. 输出 3 个版本，分别偏保守、偏标准、偏有张力，但都必须适合直接放进简历。

原始项目简介：
{{original}}

输出要求：
- 只返回 JSON
- JSON 结构必须是 {"candidates":["完整版本A","完整版本B","完整版本C"]}
- 不要输出解释、标题、编号、Markdown 代码块
- candidates 中的每一项都必须是完整可用的简历文案，严禁返回“版本1”“版本2”这类占位词`

const DEFAULT_INTERNSHIP_RESPONSIBILITY_PROMPT = `你是一位技术简历专家，请只优化“实习经历”中的一条核心职责。

改写要求：
1. 明确写出用了什么技术栈。
2. 明确写出解决了什么问题。
3. 明确写出实现了什么业务或能力。
4. 如果原文中存在量化数据或效果，必须保留；如果没有，就不要编造。
5. 保持为一条适合放在简历里的高密度 bullet，语言专业、克制、结果导向。
6. 严禁编造事实。

当前上下文：
- 公司：{{company}}
- 岗位：{{position}}
- 项目名：{{projectName}}
- 技术栈：{{techStack}}
- 项目简介：{{projectDescription}}

原始职责：
{{original}}

输出要求：
- 只输出优化后的纯文本
- 不要加标题、编号、引号或解释`

const DEFAULT_PROJECT_RESPONSIBILITY_PROMPT = `你是一位技术简历专家，请只优化“项目经历”中的一条核心职责。

改写要求：
1. 明确写出用了什么技术栈。
2. 明确写出解决了什么问题。
3. 明确写出实现了什么业务、能力或结果。
4. 如果原文中存在量化数据或效果，必须保留；如果没有，就不要编造。
5. 保持为一条适合放在简历里的高密度 bullet，语言专业、克制、结果导向。
6. 严禁编造事实。

当前上下文：
- 项目名：{{projectName}}
- 角色：{{role}}
- 技术栈：{{techStack}}
- 项目描述：{{description}}

原始职责：
{{original}}

输出要求：
- 只输出优化后的纯文本
- 不要加标题、编号、引号或解释`

const FIELD_OPTIMIZE_SYSTEM_PROMPT = '你是一位严格、克制、结果导向的中文技术简历优化专家。'

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

function promptStorageKey(moduleType: string, fieldType: FieldType) {
  return `pai-resume.field-optimize-prompt.${moduleType}.${fieldType}`
}

function systemPromptStorageKey() {
  return 'pai-resume.field-optimize-system-prompt'
}

function replaceTemplatePlaceholders(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(value || ''),
    template
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function templatizeRenderedPrompt(renderedPrompt: string, variables: Record<string, string>) {
  const entries = Object.entries(variables)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .sort((a, b) => b[1].length - a[1].length)

  return entries.reduce((result, [key, value]) => {
    const pattern = new RegExp(escapeRegExp(value), 'g')
    return result.replace(pattern, `{{${key}}}`)
  }, renderedPrompt)
}

function deriveFieldContext(module: ResumeModule | undefined, fieldType: string | null, index: number | null): FieldContext | null {
  if (!module || !fieldType) {
    return null
  }

  if (module.moduleType === 'internship') {
    const content = normalizeInternshipContent(module.content)
    if (fieldType === 'project_description') {
      return {
        title: '项目简介',
        original: content.projectDescription.trim(),
        multiCandidate: true,
        request: { fieldType: 'project_description' },
        moduleType: 'internship',
      }
    }
    if (fieldType === 'responsibility' && index !== null) {
      return {
        title: `核心职责 ${index + 1}`,
        original: content.responsibilities[index]?.trim() || '',
        multiCandidate: false,
        request: { fieldType: 'responsibility', index },
        moduleType: 'internship',
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
    if (fieldType === 'responsibility' && index !== null) {
      return {
        title: `核心职责 ${index + 1}`,
        original: content.achievements[index]?.trim() || '',
        multiCandidate: false,
        request: { fieldType: 'responsibility', index },
        moduleType: 'project',
      }
    }
  }

  return null
}

function derivePromptVariables(module: ResumeModule | undefined, fieldContext: FieldContext | null, fieldType: FieldType | null, index: number | null) {
  if (!module || !fieldContext || !fieldType) {
    return {}
  }

  if (fieldType === 'project_description') {
    return {
      original: fieldContext.original,
    }
  }

  if (module.moduleType === 'internship') {
    const content = normalizeInternshipContent(module.content)
    return {
      company: content.company,
      position: content.position,
      projectName: content.projectName,
      techStack: content.techStack,
      projectDescription: content.projectDescription,
      original: index !== null ? (content.responsibilities[index] || '') : fieldContext.original,
    }
  }

  if (module.moduleType === 'project') {
    const content = normalizeProjectContent(module.content)
    return {
      projectName: content.projectName,
      role: content.role,
      techStack: content.techStack,
      description: content.description,
      original: index !== null ? (content.achievements[index] || '') : fieldContext.original,
    }
  }

  return {}
}

function buildDefaultPromptTemplate(module: ResumeModule | undefined, fieldType: FieldType | null) {
  if (!module || !fieldType) {
    return ''
  }

  if (fieldType === 'project_description') {
    return DEFAULT_PROJECT_DESCRIPTION_PROMPT
  }

  if (module.moduleType === 'internship') {
    return DEFAULT_INTERNSHIP_RESPONSIBILITY_PROMPT
  }

  if (module.moduleType === 'project') {
    return DEFAULT_PROJECT_RESPONSIBILITY_PROMPT
  }

  return ''
}

function migrateStoredPromptTemplate(template: string, fieldContext: FieldContext | null, fieldType: FieldType | null) {
  if (!template || !fieldContext || !fieldType || template.includes('{{')) {
    return template
  }

  if (fieldType === 'project_description') {
    return template.replace(
      /(原始项目简介：\s*\n)([\s\S]*?)(\n\s*输出要求：)/,
      `$1{{original}}$3`
    )
  }

  if (fieldContext.moduleType === 'internship') {
    return template
      .replace(/- 公司：.*$/m, '- 公司：{{company}}')
      .replace(/- 岗位：.*$/m, '- 岗位：{{position}}')
      .replace(/- 项目名：.*$/m, '- 项目名：{{projectName}}')
      .replace(/- 技术栈：.*$/m, '- 技术栈：{{techStack}}')
      .replace(/- 项目简介：.*$/m, '- 项目简介：{{projectDescription}}')
      .replace(/(原始职责：\s*\n)([\s\S]*?)(\n\s*输出要求：)/, '$1{{original}}$3')
  }

  if (fieldContext.moduleType === 'project') {
    return template
      .replace(/- 项目名：.*$/m, '- 项目名：{{projectName}}')
      .replace(/- 角色：.*$/m, '- 角色：{{role}}')
      .replace(/- 技术栈：.*$/m, '- 技术栈：{{techStack}}')
      .replace(/- 项目描述：.*$/m, '- 项目描述：{{description}}')
      .replace(/(原始职责：\s*\n)([\s\S]*?)(\n\s*输出要求：)/, '$1{{original}}$3')
  }

  return template
}

function applyOptimizedText(module: ResumeModule, fieldType: string, optimizedText: string, index: number | null) {
  if (module.moduleType === 'internship') {
    const content = normalizeInternshipContent(module.content)
    if (fieldType === 'project_description') {
      return { ...content, projectDescription: optimizedText }
    }
    if (fieldType === 'responsibility' && index !== null) {
      const responsibilities = [...content.responsibilities]
      responsibilities[index] = optimizedText
      return { ...content, responsibilities }
    }
  }

  if (module.moduleType === 'project') {
    const content = normalizeProjectContent(module.content)
    if (fieldType === 'project_description') {
      return { ...content, description: optimizedText }
    }
    if (fieldType === 'responsibility' && index !== null) {
      const achievements = [...content.achievements]
      achievements[index] = optimizedText
      return { ...content, achievements }
    }
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

  const { modules, loading, currentResumeId, fetchModules, updateModuleContent } = useResumeStore()
  const module = modules.find((item) => item.id === numericModuleId)
  const fieldContext = useMemo(
    () => deriveFieldContext(module, fieldType, Number.isFinite(index) ? index : null),
    [module, fieldType, index]
  )
  const promptVariables = useMemo(
    () => derivePromptVariables(module, fieldContext, fieldType as FieldType | null, Number.isFinite(index) ? index : null),
    [module, fieldContext, fieldType, index]
  )
  const defaultPromptTemplate = useMemo(
    () => buildDefaultPromptTemplate(module, fieldType as FieldType | null),
    [module, fieldType]
  )
  const defaultPrompt = useMemo(
    () => replaceTemplatePlaceholders(defaultPromptTemplate, promptVariables),
    [defaultPromptTemplate, promptVariables]
  )

  const streamAbortRef = useRef<AbortController | null>(null)
  const [saving, setSaving] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState(FIELD_OPTIMIZE_SYSTEM_PROMPT)
  const [promptDraft, setPromptDraft] = useState('')
  const [savedPrompt, setSavedPrompt] = useState('')
  const [promptNotice, setPromptNotice] = useState('')
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
    setCandidateDrafts([])
    setOptimizedDraft('')
  }, [fieldContext])

  useEffect(() => {
    if (!fieldContext || !defaultPrompt) {
      return
    }
    const storageKey = promptStorageKey(fieldContext.moduleType, fieldContext.request.fieldType)
    const storedPrompt = window.localStorage.getItem(storageKey)?.trim()
    const promptTemplate = migrateStoredPromptTemplate(storedPrompt || defaultPromptTemplate, fieldContext, fieldContext.request.fieldType)
    const initialPrompt = replaceTemplatePlaceholders(promptTemplate, promptVariables)
    setPromptDraft(initialPrompt)
    setSavedPrompt(initialPrompt)
    setPromptNotice(storedPrompt ? '已加载你上次保存的提示词。' : '')
  }, [fieldContext, defaultPromptTemplate, promptVariables])

  useEffect(() => {
    const storedSystemPrompt = window.localStorage.getItem(systemPromptStorageKey())?.trim()
    const initialSystemPrompt = storedSystemPrompt || FIELD_OPTIMIZE_SYSTEM_PROMPT
    setSystemPromptDraft(initialSystemPrompt)
  }, [])

  const handleBack = () => {
    streamAbortRef.current?.abort()
    if (returnModuleType) {
      navigate(`/editor/${resumeId}?moduleType=${returnModuleType}`)
      return
    }
    navigate(`/editor/${resumeId}`)
  }

  const handleSavePrompt = () => {
    if (!fieldContext) {
      return
    }
    const nextPrompt = promptDraft.trim()
    if (!nextPrompt) {
      setPromptNotice('提示词不能为空。')
      return
    }
    const storageKey = promptStorageKey(fieldContext.moduleType, fieldContext.request.fieldType)
    const promptTemplate = templatizeRenderedPrompt(nextPrompt, promptVariables)
    window.localStorage.setItem(storageKey, promptTemplate)
    setSavedPrompt(nextPrompt)
    setPromptNotice('提示词已保存。')
  }

  const handleSaveSystemPrompt = () => {
    const nextSystemPrompt = systemPromptDraft.trim()
    if (!nextSystemPrompt) {
      return
    }
    window.localStorage.setItem(systemPromptStorageKey(), nextSystemPrompt)
  }

  const handleResetPrompt = () => {
    if (!fieldContext) {
      return
    }
    setPromptDraft(defaultPrompt)
    setPromptNotice('已恢复为默认提示词，点击保存后可覆盖本地配置。')
  }

  const handleStartOptimize = async () => {
    if (!fieldContext || !module || !resumeId || !numericModuleId) {
      return
    }
    if (!fieldContext.original.trim()) {
      setState((prev) => ({ ...prev, status: 'error', error: '当前字段内容为空，暂时无法优化。' }))
      return
    }

    const prompt = promptDraft.trim()
    if (!prompt) {
      setPromptNotice('请先填写提示词，再开始优化。')
      return
    }

    streamAbortRef.current?.abort()
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
    setCandidateDrafts([])
    setOptimizedDraft('')
    setPromptNotice(prompt === savedPrompt ? '正在按已保存提示词优化。' : '正在按当前提示词优化。')

    try {
      const result = await resumeApi.aiOptimizeFieldStream(
        resumeId,
        numericModuleId,
        {
          ...fieldContext.request,
          prompt,
          systemPrompt: systemPromptDraft.trim(),
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
              setState((prev) => ({
                ...prev,
                streamedContent: typeof event.data.text === 'string' ? event.data.text : prev.streamedContent,
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
            return candidates.length > 0 ? candidates : (result.optimized ? [result.optimized] : [])
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
          ? JSON.stringify({ candidates: result.candidates ?? [] }, null, 2)
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
      const nextContent = applyOptimizedText(module, fieldType, optimizedText, Number.isFinite(index) ? index : null)
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
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 via-white to-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 xl:px-10">
        <div className="mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/90 px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
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
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            当前优化参数无效，无法定位到对应字段。
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="shrink-0 text-sm font-medium text-slate-700">系统提示词：</div>
                <input
                  type="text"
                  value={systemPromptDraft}
                  onChange={(event) => setSystemPromptDraft(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-primary-100 bg-primary-50/40 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={handleSaveSystemPrompt}
                  disabled={isStreaming}
                  className="shrink-0 rounded-lg border border-primary-100 px-3 py-2 text-xs text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  保存
                </button>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">用户提示词</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPrompt}
                    disabled={isStreaming || !fieldContext}
                    className="rounded-lg border border-primary-100 px-3 py-2 text-xs text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    恢复默认
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePrompt}
                    disabled={isStreaming || !fieldContext}
                    className="rounded-lg border border-primary-100 px-3 py-2 text-xs text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
              </div>
              <textarea
                value={promptDraft}
                onChange={(event) => {
                  setPromptDraft(event.target.value)
                  setPromptNotice('')
                }}
                rows={5}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                placeholder="请先调整提示词，再开始优化。"
              />
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{promptNotice || (promptDraft.trim() === savedPrompt.trim() ? '\u00a0' : '当前提示词有未保存修改。')}</span>
                <span>{promptDraft.trim().length} 字</span>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-800">AI 生成过程</div>
                      <div className="mt-1 text-xs text-slate-500">展示模型生成中的过程事件与返回内容。</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleStartOptimize()}
                      disabled={isStreaming || !fieldContext || !promptDraft.trim()}
                      className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {state.status === 'idle' ? '开始优化' : '重新生成'}
                    </button>
                  </div>
                  <pre className="min-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-slate-50 p-4 text-xs leading-6 text-slate-700">
                    {state.reasoning || (isStreaming ? '正在等待生成过程输出...' : '点击“开始优化”后，这里会展示完整的生成过程。')}
                  </pre>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 text-sm font-medium text-slate-800">优化前</div>
                  <pre className="max-h-[28vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                    {state.original || (loading ? '正在加载字段内容...' : '当前字段暂无内容。')}
                  </pre>
                </section>

                {fieldContext?.multiCandidate ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-3 text-sm font-medium text-slate-800">优化后候选</div>
                    <div className="space-y-4">
                      {state.candidates && state.candidates.length > 0 ? state.candidates.map((candidate, candidateIndex) => (
                        <div key={`${candidateIndex}-${candidate}`} className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/70 via-white to-primary-50/40 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-primary-700">版本 {candidateIndex + 1}</div>
                            <button
                              type="button"
                              onClick={() => void handleAdopt((candidateDrafts[candidateIndex] || candidate).trim())}
                              disabled={saving}
                              className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {saving ? '回填中...' : '采纳这个版本'}
                            </button>
                          </div>
                          <textarea
                            value={candidateDrafts[candidateIndex] ?? candidate}
                            onChange={(event) => handleCandidateDraftChange(candidateIndex, event.target.value)}
                            rows={4}
                            className="w-full resize-y rounded-2xl border border-primary-100 bg-white/90 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-primary-100 bg-primary-50/30 px-4 py-8 text-sm text-slate-500">
                          {isStreaming ? 'AI 还在生成候选版本。' : '点击“开始优化”后，这里会展示可采纳候选。'}
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-800">优化后</div>
                      <button
                        type="button"
                        onClick={() => optimizedDraft.trim() && void handleAdopt(optimizedDraft.trim())}
                        disabled={!optimizedDraft.trim() || saving}
                        className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? '回填中...' : '采纳优化'}
                      </button>
                    </div>
                    {state.optimized ? (
                      <textarea
                        value={optimizedDraft}
                        onChange={(event) => setOptimizedDraft(event.target.value)}
                        rows={8}
                        className="min-h-[240px] w-full resize-y rounded-2xl border border-primary-100 bg-primary-50/40 p-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <div className="min-h-[240px] overflow-auto whitespace-pre-wrap rounded-2xl border border-primary-100 bg-primary-50/40 p-4 text-sm leading-7 text-slate-700">
                        {isStreaming ? 'AI 还在生成优化结果。' : '点击“开始优化”后，这里会展示优化结果。'}
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
