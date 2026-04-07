import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import {
  resumeApi,
  type ModuleOverrideState,
  type ResumeModule,
  type SmartOnePagePreviewRequest,
  type SmartOnePagePreviewResponse,
} from '../api/resume'
import {
  DEFAULT_CUSTOM_PROMPT,
  getResumeOptimizationSkill,
  getResumeReferenceTemplate,
  resumeOptimizationSkills,
  resumeReferenceTemplates,
} from '../data/smartOnePagePresets'
import { useResumeStore } from '../store/resumeStore'
import { MODULE_LABELS, type ModuleType } from '../types'
import { downloadResumePdf, generateResumePdfBlob } from '../utils/resumePdf'

type SmartMode = 'layout_only' | 'optimize_and_layout'
type PromptMode = 'skill' | 'custom'
type PreviewTab = 'original-standard' | 'original-continuous' | 'final-continuous'
const AI_OPTIMIZABLE_MODULE_TYPES = new Set<ModuleType>(['internship', 'project', 'research', 'skill'])

function sortModules(modules: ResumeModule[]) {
  return [...modules].sort((a, b) => {
    if (a.sortOrder === b.sortOrder) {
      return a.id - b.id
    }

    return a.sortOrder - b.sortOrder
  })
}

function cloneModules(modules: ResumeModule[]) {
  return modules.map((module) => ({
    ...module,
    content: structuredClone(module.content),
  }))
}

function estimateTextWeight(value: unknown): number {
  if (typeof value === 'string') {
    return value.trim().length
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateTextWeight(item), 0)
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (sum, item) => sum + estimateTextWeight(item),
      0
    )
  }

  return 0
}

function estimateContinuousHeight(modules: ResumeModule[]) {
  const sorted = sortModules(modules)
  const textWeight = sorted.reduce((sum, module) => sum + estimateTextWeight(module.content), 0)
  return Math.max(900, Math.min(3200, 240 + sorted.length * 52 + textWeight * 0.42))
}

function createLayoutOnlyPreview(modules: ResumeModule[]): SmartOnePagePreviewResponse {
  const originalModules = cloneModules(sortModules(modules))
  const height = estimateContinuousHeight(originalModules)
  const estimatedOriginalPages = Math.max(1, Math.ceil(height / 842))

  return {
    originalModules,
    optimizedModules: cloneModules(originalModules),
    moduleDecisions: originalModules.map((module) => ({
      moduleId: module.id,
      action: 'keep_original',
      reason: '当前模式仅生成连续长页 PDF，不对内容做 AI 压缩。',
    })),
    effectiveModules: cloneModules(originalModules),
    previewMeta: {
      estimatedOriginalPages,
      estimatedContinuousHeight: Math.round(height),
      estimatedCompressedPages: estimatedOriginalPages,
    },
    summary: '已保持当前 PDF 模板与内容不变，仅把输出改为单张连续长页。',
  }
}

function resolveFinalEffectiveModules(
  previewResult: SmartOnePagePreviewResponse | null,
  overrides: ModuleOverrideState
) {
  if (!previewResult) {
    return []
  }

  const originalMap = new Map(previewResult.originalModules.map((module) => [module.id, module]))
  const optimizedMap = new Map(previewResult.optimizedModules.map((module) => [module.id, module]))
  const decisionMap = new Map(previewResult.moduleDecisions.map((decision) => [decision.moduleId, decision]))

  return sortModules(previewResult.originalModules).map((module) => {
    const override = overrides[module.id]
    if (override === 'optimized' && optimizedMap.has(module.id)) {
      return optimizedMap.get(module.id) as ResumeModule
    }

    if (override === 'original') {
      return originalMap.get(module.id) as ResumeModule
    }

    const decision = decisionMap.get(module.id)
    if (decision?.action === 'suggest_optimized' && optimizedMap.has(module.id)) {
      return optimizedMap.get(module.id) as ResumeModule
    }

    return originalMap.get(module.id) as ResumeModule
  })
}

function formatJsonContent(content: Record<string, unknown>) {
  return JSON.stringify(content, null, 2)
}

function usePdfPreviewUrl(modules: ResumeModule[], pageMode: 'standard' | 'continuous') {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const activeUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (modules.length === 0) {
      setLoading(false)
      setError('')
      setUrl(null)
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current)
        activeUrlRef.current = null
      }
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    void generateResumePdfBlob(modules, { pageMode })
      .then((blob) => {
        if (cancelled) {
          return
        }

        const nextUrl = URL.createObjectURL(blob)
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current)
        }
        activeUrlRef.current = nextUrl
        setUrl(nextUrl)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return
        }

        setLoading(false)
        setError(reason instanceof Error ? reason.message : 'PDF 预览生成失败')
      })

    return () => {
      cancelled = true
    }
  }, [modules, pageMode])

  useEffect(() => () => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current)
    }
  }, [])

  return { url, loading, error }
}

export default function SmartOnePagePage() {
  const { id } = useParams<{ id: string }>()
  const resumeId = Number(id)
  const { modules, loading, fetchModules } = useResumeStore()
  const [mode, setMode] = useState<SmartMode>('layout_only')
  const [promptMode, setPromptMode] = useState<PromptMode>('skill')
  const [skillId, setSkillId] = useState(resumeOptimizationSkills[0]?.id ?? '')
  const [templateId, setTemplateId] = useState(resumeReferenceTemplates[0]?.id ?? '')
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_CUSTOM_PROMPT)
  const [previewResult, setPreviewResult] = useState<SmartOnePagePreviewResponse | null>(null)
  const [moduleOverrides, setModuleOverrides] = useState<ModuleOverrideState>({})
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pageError, setPageError] = useState('')
  const [activeTab, setActiveTab] = useState<PreviewTab>('final-continuous')
  const [hasGenerated, setHasGenerated] = useState(false)

  useEffect(() => {
    if (resumeId) {
      void fetchModules(resumeId)
    }
  }, [fetchModules, resumeId])

  useEffect(() => {
    setPreviewResult(null)
    setModuleOverrides({})
    setHasGenerated(false)
    setPageError('')
  }, [resumeId])

  const sortedSourceModules = useMemo(() => sortModules(modules), [modules])
  const fallbackPreview = useMemo(() => createLayoutOnlyPreview(sortedSourceModules), [sortedSourceModules])
  const effectivePreview = previewResult ?? fallbackPreview
  const finalEffectiveModules = useMemo(
    () => resolveFinalEffectiveModules(effectivePreview, moduleOverrides),
    [effectivePreview, moduleOverrides]
  )
  const aiCandidateModules = useMemo(
    () => sortModules(effectivePreview.originalModules).filter((module) => AI_OPTIMIZABLE_MODULE_TYPES.has(module.moduleType as ModuleType)),
    [effectivePreview.originalModules]
  )
  const fixedModules = useMemo(
    () => sortModules(effectivePreview.originalModules).filter((module) => !AI_OPTIMIZABLE_MODULE_TYPES.has(module.moduleType as ModuleType)),
    [effectivePreview.originalModules]
  )

  const originalStandardPreview = usePdfPreviewUrl(sortedSourceModules, 'standard')
  const originalContinuousPreview = usePdfPreviewUrl(sortedSourceModules, 'continuous')
  const finalContinuousPreview = usePdfPreviewUrl(finalEffectiveModules, 'continuous')

  const selectedSkill = getResumeOptimizationSkill(skillId)
  const selectedTemplate = getResumeReferenceTemplate(templateId)

  const handleGenerate = async () => {
    if (sortedSourceModules.length === 0) {
      setPageError('请先完善简历内容后再使用智能一页。')
      return
    }

    setGenerating(true)
    setPageError('')

    try {
      if (mode === 'layout_only') {
        setPreviewResult(createLayoutOnlyPreview(sortedSourceModules))
        setModuleOverrides({})
        setHasGenerated(true)
        return
      }

      const request: SmartOnePagePreviewRequest = {
        mode,
        promptMode,
        templateId,
        adoptionPolicy: 'only_if_better',
        outputFormat: 'continuous_pdf',
        ...(promptMode === 'skill'
          ? { skillId }
          : { customPrompt: customPrompt.trim() }),
      }

      const { data: response } = await resumeApi.smartOnePagePreview(resumeId, request)
      setPreviewResult(response.data)
      setModuleOverrides({})
      setHasGenerated(true)
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : '智能一页生成失败，请稍后重试'
      setPageError(message)
      if (!previewResult) {
        setPreviewResult(createLayoutOnlyPreview(sortedSourceModules))
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async () => {
    if (finalEffectiveModules.length === 0) {
      setPageError('当前没有可导出的内容。')
      return
    }

    setExporting(true)
    setPageError('')
    try {
      await downloadResumePdf(finalEffectiveModules, resumeId, {
        pageMode: 'continuous',
        fileNameSuffix: 'smart-onepage',
      })
    } catch (reason: unknown) {
      setPageError(reason instanceof Error ? reason.message : '导出失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const currentPreview = activeTab === 'original-standard'
    ? originalStandardPreview
    : activeTab === 'original-continuous'
      ? originalContinuousPreview
      : finalContinuousPreview

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Link to={`/editor/${resumeId}`} className="font-medium text-slate-600 transition hover:text-primary-700">
                  返回编辑页
                </Link>
                <span>/</span>
                <span>智能一页</span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">智能一页工作台</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                保持当前 PDF 模板不变。你可以先只生成连续长页 PDF，也可以让后端基于内置 Skill 或自定义提示词给出压缩候选内容，再逐模块决定是否采纳。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={loading || generating}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? '生成中...' : '开始生成'}
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={loading || exporting || finalEffectiveModules.length === 0}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? '导出中...' : '导出连续长页 PDF'}
              </button>
            </div>
          </div>

          {pageError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pageError}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_520px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">生成配置</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">模式</p>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <input
                      type="radio"
                      name="smart-mode"
                      value="layout_only"
                      checked={mode === 'layout_only'}
                      onChange={() => setMode('layout_only')}
                      className="mt-1 h-4 w-4 text-primary-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">仅连续长页</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">不改文案，只把当前 PDF 渲染成单张连续长页。</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <input
                      type="radio"
                      name="smart-mode"
                      value="optimize_and_layout"
                      checked={mode === 'optimize_and_layout'}
                      onChange={() => setMode('optimize_and_layout')}
                      className="mt-1 h-4 w-4 text-primary-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">内容压缩 + 连续长页</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">调用后端整份简历预览接口，只在值得优化时给出候选改写。</span>
                    </span>
                  </label>
                </div>

                <div className={`space-y-3 ${mode === 'layout_only' ? 'opacity-50' : ''}`}>
                  <p className="text-sm font-medium text-slate-700">优化策略</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={mode === 'layout_only'}
                      onClick={() => setPromptMode('skill')}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        promptMode === 'skill'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      内置 Skill
                    </button>
                    <button
                      type="button"
                      disabled={mode === 'layout_only'}
                      onClick={() => setPromptMode('custom')}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        promptMode === 'custom'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      自定义提示词
                    </button>
                  </div>

                  {promptMode === 'skill' ? (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <select
                        disabled={mode === 'layout_only'}
                        value={skillId}
                        onChange={(event) => setSkillId(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary-400"
                      >
                        {resumeOptimizationSkills.map((skill) => (
                          <option key={skill.id} value={skill.id}>{skill.name}</option>
                        ))}
                      </select>
                      <p className="mt-3 text-sm text-slate-600">{selectedSkill.description}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">目标人群：{selectedSkill.targetAudience}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">密度目标：{selectedSkill.densityGoal}</p>
                    </div>
                  ) : (
                    <textarea
                      disabled={mode === 'layout_only'}
                      value={customPrompt}
                      onChange={(event) => setCustomPrompt(event.target.value)}
                      rows={10}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-primary-400"
                    />
                  )}
                </div>
              </div>

              <div className={`mt-5 ${mode === 'layout_only' ? 'opacity-50' : ''}`}>
                <p className="text-sm font-medium text-slate-700">参考模板</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {resumeReferenceTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      disabled={mode === 'layout_only'}
                      onClick={() => setTemplateId(template.id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        template.id === templateId
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className={`mt-2 text-xs leading-5 ${template.id === templateId ? 'text-slate-200' : 'text-slate-500'}`}>
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-800">{selectedTemplate.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{selectedTemplate.intendedUse}</div>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                    {selectedTemplate.markdownBody}
                  </pre>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">内容对比</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {hasGenerated
                      ? effectivePreview.summary
                      : '点击“开始生成”后，这里会展示每个模块的原文、候选压缩结果和默认采纳策略。'}
                  </p>
                </div>
                {hasGenerated && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                    预计原页数 {effectivePreview.previewMeta.estimatedOriginalPages} 页
                    <br />
                    连续长页高度 {effectivePreview.previewMeta.estimatedContinuousHeight}px
                    <br />
                    压缩后预计 {effectivePreview.previewMeta.estimatedCompressedPages} 页
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <div className="font-medium text-slate-800">AI 处理范围</div>
                <p className="mt-2 leading-6">
                  只对 <span className="font-medium text-slate-900">实习经历、项目经历、科研经历、专业技能</span> 做压缩候选。
                  基本信息、教育背景、奖项、论文、求职意向属于标准事实模块，默认跳过 AI。
                </p>
              </div>

              {sortedSourceModules.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                  当前简历还没有模块内容。
                </div>
              ) : !hasGenerated ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                  当前已经可直接预览连续长页 PDF。若要比较 AI 压缩前后内容，请选择“内容压缩 + 连续长页”后开始生成。
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {fixedModules.length > 0 && (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="text-sm font-medium text-slate-900">标准模块</div>
                      <p className="mt-1 text-sm text-slate-500">这些模块不参与 AI 优化，直接沿用原文参与连续长页导出。</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {fixedModules.map((module) => {
                          const decision = effectivePreview.moduleDecisions.find((item) => item.moduleId === module.id)
                          return (
                            <div key={module.id} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              <span className="font-medium text-slate-800">{MODULE_LABELS[module.moduleType as ModuleType] ?? module.moduleType}</span>
                              <span className="mx-1 text-slate-300">|</span>
                              <span>{decision?.reason ?? '默认跳过 AI'}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {aiCandidateModules.map((module) => {
                    const decision = effectivePreview.moduleDecisions.find((item) => item.moduleId === module.id)
                    const optimizedModule = effectivePreview.optimizedModules.find((item) => item.id === module.id) ?? module
                    const selectedValue = moduleOverrides[module.id]
                      ?? (decision?.action === 'suggest_optimized' ? 'optimized' : 'original')

                    return (
                      <article key={module.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">
                              {MODULE_LABELS[module.moduleType as ModuleType] ?? module.moduleType}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">{decision?.reason ?? '保持原文'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setModuleOverrides((current) => ({ ...current, [module.id]: 'original' }))}
                              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                                selectedValue === 'original'
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-200 bg-white text-slate-600'
                              }`}
                            >
                              保留原文
                            </button>
                            <button
                              type="button"
                              onClick={() => setModuleOverrides((current) => ({ ...current, [module.id]: 'optimized' }))}
                              disabled={decision?.action !== 'suggest_optimized'}
                              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                                selectedValue === 'optimized'
                                  ? 'bg-primary-600 text-white'
                                  : 'border border-slate-200 bg-white text-slate-600'
                              } disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              采纳优化
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div>
                            <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">原始内容</div>
                            <pre className="max-h-80 overflow-auto rounded-2xl bg-white p-4 text-xs leading-6 text-slate-700">
                              {formatJsonContent(module.content)}
                            </pre>
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">优化后</div>
                            <pre className="max-h-80 overflow-auto rounded-2xl bg-white p-4 text-xs leading-6 text-slate-700">
                              {formatJsonContent(optimizedModule.content)}
                            </pre>
                          </div>
                        </div>
                      </article>
                    )
                  })}

                  {aiCandidateModules.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                      当前简历里没有需要做 AI 压缩对比的模块。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'original-standard', label: '原始标准 PDF' },
                { id: 'original-continuous', label: '原始连续长页' },
                { id: 'final-continuous', label: '当前导出结果' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as PreviewTab)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-5 h-[72vh] overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              {currentPreview.loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">正在生成 PDF 预览...</div>
              ) : currentPreview.error ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">{currentPreview.error}</div>
              ) : currentPreview.url ? (
                <iframe title="smart-onepage-preview" src={currentPreview.url} className="h-full w-full bg-white" />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                  当前没有可预览的 PDF 内容。
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
