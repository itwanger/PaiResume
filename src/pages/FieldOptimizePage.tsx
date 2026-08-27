import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { resumeApi, type AiFieldOptimizeRequest, type FieldOptimizePromptConfig, type ResumeModule } from '../api/resume'
import { MarkdownPreview } from '../components/ui/MarkdownPreview'
import { buildFieldOptimizePreset, type FieldOptimizePresetId } from '../data/fieldOptimizePresets'
import { useResumeStore } from '../store/resumeStore'
import { normalizeInternshipContent, normalizeProjectContent, normalizeSkillContent } from '../utils/moduleContent'

type PageStatus = 'idle' | 'streaming' | 'completed' | 'error'
type FieldType = 'project_description' | 'responsibility' | 'skill'

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

const EMPTY_PROMPT_CONFIG: FieldOptimizePromptConfig = {
  systemPrompt: '',
  descriptionPrompt: '',
  responsibilityPrompt: '',
  skillPrompt: '',
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

function promptStorageKey(moduleType: string, fieldType: FieldType) {
  return `pai-resume.field-optimize-prompt.${moduleType}.${fieldType}`
}

function systemPromptStorageKey() {
  return 'pai-resume.field-optimize-system-prompt'
}

function replaceTemplatePlaceholders(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(value || ''),
    template || ''
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

const EXPERIENCE_RESPONSIBILITY_INDEX_STRIDE = 1000

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

function derivePromptVariables(
  module: ResumeModule | undefined,
  fieldContext: FieldContext | null,
  fieldType: FieldType | null,
  projectIndex: number,
  responsibilityIndex: number | null,
): Record<string, string> {
  if (!module || !fieldContext || !fieldType) {
    return {}
  }

  if (fieldType === 'skill') {
    return { original: fieldContext.original }
  }

  if (fieldType === 'project_description') {
    return {
      original: fieldContext.original,
    }
  }

  if (module.moduleType === 'internship' || module.moduleType === 'work_experience') {
    const content = normalizeInternshipContent(module.content)
    const project = content.projects[projectIndex]
    if (!project) return {}
    return {
      company: content.company,
      position: content.position,
      projectName: project.projectName,
      techStack: project.techStack,
      projectDescription: project.projectDescription,
      original: responsibilityIndex !== null ? (project.responsibilities[responsibilityIndex] || '') : fieldContext.original,
    }
  }

  if (module.moduleType === 'project') {
    const content = normalizeProjectContent(module.content)
    return {
      projectName: content.projectName,
      role: content.role,
      techStack: content.techStack,
      description: content.description,
      original: responsibilityIndex !== null ? (content.achievements[responsibilityIndex] || '') : fieldContext.original,
    }
  }

  return {}
}

function buildDefaultPromptTemplate(
  module: ResumeModule | undefined,
  fieldType: FieldType | null,
  promptConfig: FieldOptimizePromptConfig
) {
  if (!module || !fieldType) {
    return ''
  }

  if (fieldType === 'skill') {
    return promptConfig.skillPrompt || ''
  }

  if (fieldType === 'project_description') {
    return promptConfig.descriptionPrompt
  }

  return promptConfig.responsibilityPrompt
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

  if (fieldType === 'skill') {
    return template.replace(
      /(原始技能：\s*\n)([\s\S]*?)(\n\s*输出要求：)/,
      `$1{{original}}$3`
    )
  }

  if (fieldContext.moduleType === 'internship' || fieldContext.moduleType === 'work_experience') {
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
  const promptVariables = useMemo(
    () => derivePromptVariables(module, fieldContext, fieldType as FieldType | null, projectIndex, Number.isFinite(index) ? index : null),
    [module, fieldContext, fieldType, projectIndex, index]
  )
  const [promptConfig, setPromptConfig] = useState<FieldOptimizePromptConfig>(EMPTY_PROMPT_CONFIG)
  const defaultPromptTemplate = useMemo(
    () => buildDefaultPromptTemplate(module, fieldType as FieldType | null, promptConfig),
    [module, fieldType, promptConfig]
  )
  const defaultPrompt = useMemo(
    () => replaceTemplatePlaceholders(defaultPromptTemplate, promptVariables),
    [defaultPromptTemplate, promptVariables]
  )

  const streamAbortRef = useRef<AbortController | null>(null)
  const streamedContentRef = useRef('')
  const [saving, setSaving] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState('')
  const [savedSystemPrompt, setSavedSystemPrompt] = useState('')
  const [systemPromptNotice, setSystemPromptNotice] = useState('')
  const effectiveSystemPrompt = useMemo(
    () => systemPromptDraft.trim() || promptConfig.systemPrompt.trim(),
    [systemPromptDraft, promptConfig.systemPrompt]
  )
  const [promptDraft, setPromptDraft] = useState('')
  const [savedPrompt, setSavedPrompt] = useState('')
  const [promptNotice, setPromptNotice] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<FieldOptimizePresetId | 'custom'>('standard')
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
    void resumeApi.getFieldOptimizePromptConfig()
      .then((response) => {
        if (!mounted) {
          return
        }
        setPromptConfig(response.data.data)
      })
      .catch(() => {
        if (!mounted) {
          return
        }
        setPromptConfig(EMPTY_PROMPT_CONFIG)
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
    if (storedPrompt) {
      setSelectedPreset('custom')
    }
  }, [fieldContext, defaultPrompt, defaultPromptTemplate, promptVariables])

  useEffect(() => {
    const storedSystemPrompt = window.localStorage.getItem(systemPromptStorageKey())?.trim()
    const initialSystemPrompt = storedSystemPrompt || promptConfig.systemPrompt
    setSystemPromptDraft(initialSystemPrompt)
    setSavedSystemPrompt(initialSystemPrompt)
    setSystemPromptNotice(storedSystemPrompt ? '已加载你上次保存的系统提示词。' : '')
    if (storedSystemPrompt) {
      setSelectedPreset('custom')
    }
  }, [promptConfig.systemPrompt])

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
    const nextSystemPrompt = effectiveSystemPrompt
    if (!nextSystemPrompt) {
      setSystemPromptNotice('系统提示词不能为空。')
      return
    }
    setSystemPromptDraft(nextSystemPrompt)
    window.localStorage.setItem(systemPromptStorageKey(), nextSystemPrompt)
    setSavedSystemPrompt(nextSystemPrompt)
    setSystemPromptNotice('系统提示词已保存。')
  }

  const handleResetSystemPrompt = () => {
    setSystemPromptDraft(promptConfig.systemPrompt)
    setSelectedPreset('custom')
    setSystemPromptNotice('已恢复为默认系统提示词，点击保存后可覆盖本地配置。')
  }

  const handleResetPrompt = () => {
    if (!fieldContext) {
      return
    }
    setPromptDraft(defaultPrompt)
    setSelectedPreset('custom')
    setPromptNotice('已恢复为默认提示词，点击保存后可覆盖本地配置。')
  }

  const handleSelectPreset = (presetId: FieldOptimizePresetId) => {
    const preset = buildFieldOptimizePreset(presetId, {
      systemPrompt: promptConfig.systemPrompt,
      userPrompt: defaultPrompt,
    })
    setSelectedPreset(presetId)
    setSystemPromptDraft(preset.systemPrompt)
    setPromptDraft(preset.userPrompt)
    setSystemPromptNotice('')
    setPromptNotice('')
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
    streamedContentRef.current = ''
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
            systemPrompt: effectiveSystemPrompt,
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
            const resolvedCandidates = streamedCandidates.length > 0 ? streamedCandidates : candidates
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-slate-700">优化方式</span>
              {([
                { id: 'standard', label: '标准优化' },
                { id: 'asu', label: '阿酥式表达' },
              ] as const).map((preset) => {
                const isActive = selectedPreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isStreaming}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActive
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
              <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-800">系统提示词</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetSystemPrompt}
                      disabled={isStreaming}
                      className="rounded-lg border border-primary-100 px-3 py-2 text-xs text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      恢复默认
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSystemPrompt}
                      disabled={isStreaming}
                      className="shrink-0 rounded-lg border border-primary-100 px-3 py-2 text-xs text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      保存
                    </button>
                  </div>
                </div>
                <textarea
                  value={systemPromptDraft || promptConfig.systemPrompt}
                  onChange={(event) => {
                    setSystemPromptDraft(event.target.value)
                    setSelectedPreset('custom')
                    setSystemPromptNotice('')
                  }}
                  rows={7}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="系统提示词用于约束整体风格。"
                />
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{systemPromptNotice || (effectiveSystemPrompt.trim() === savedSystemPrompt.trim() ? '\u00a0' : '当前系统提示词有未保存修改。')}</span>
                  <span>{effectiveSystemPrompt.trim().length} 字</span>
                </div>
              </section>

              <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-800">用户提示词</div>
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
                    setSelectedPreset('custom')
                    setPromptNotice('')
                  }}
                  rows={7}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="请先调整提示词，再开始优化。"
                />
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{promptNotice || (promptDraft.trim() === savedPrompt.trim() ? '\u00a0' : '当前提示词有未保存修改。')}</span>
                  <span>{promptDraft.trim().length} 字</span>
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
              <div className="min-w-0 space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-800">AI 生成过程</div>
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
                  <div className="space-y-4">
                    <div>
                      <MarkdownPreview
                        content={state.reasoning}
                        emptyText={isStreaming ? '正在等待生成过程输出...' : '暂无生成过程'}
                        className="min-h-[220px] border-primary-100 bg-gradient-to-br from-primary-50 via-white to-slate-50"
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">流式结果</div>
                      <MarkdownPreview
                        content={state.streamedContent}
                        emptyText={isStreaming ? '正在等待结果输出...' : '暂无流式结果'}
                        className="min-h-[120px] border-primary-100 bg-white"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="min-w-0 space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-800">优化前</div>
                    <div className="text-xs text-slate-500">
                      {countDisplayCharacters(state.original)} 字
                    </div>
                  </div>
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
                          {isStreaming ? '正在生成候选版本...' : '暂无候选版本'}
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
