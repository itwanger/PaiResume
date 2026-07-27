import { useEffect, useMemo, useState } from 'react'
import { useAnalysis } from '../../hooks/useAnalysis'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { Button } from '../ui/Button'
import { Section } from '../ui/Section'

interface ResumeAnalysisProps {
  resumeId: number
}

const ANALYSIS_PROMPT_STORAGE_KEY = 'pai-resume.analysis-prompt'

const DEFAULT_ANALYSIS_PROMPT = `请站在校招技术简历评审视角分析这份简历。

重点要求：
1. 重点看项目经历、工作经历、实习经历、专业技能，这几部分权重最高。
2. 不要因为获奖较少、没有 AI 竞赛、没有 GPA、GitHub 没有额外包装，就明显拉低分数。
3. 不要把“专业技能没有分类展示”当成问题，也不要要求把整句技能改成分类标签。
4. 不要把“缺少个人简介 / 职业总结 / 自我评价”当成问题。
5. 只有在确实存在明显短板时才指出问题，避免泛泛而谈。
6. 对已经写得比较成熟的内容，尽量少挑边角问题。
7. 如果整份简历主体已经可以直接投递，分数应落在 90 分以上。

输出偏好：
1. 问题最多 4 条，建议最多 4 条。
2. 建议必须具体、可执行，避免空话。
3. 优先指出真正影响投递效果的问题，比如邮箱错误、量化成果不足、表达不够聚焦。`

export function ResumeAnalysis({ resumeId }: ResumeAnalysisProps) {
  const {
    analysisResult,
    analysisReasoning,
    analysisStatus,
    isAnalyzing,
    analyze,
    loadLatestAnalysis,
    resetAnalysis,
    error,
  } = useAnalysis()
  const [promptDraft, setPromptDraft] = useState(DEFAULT_ANALYSIS_PROMPT)
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_ANALYSIS_PROMPT)
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const [showReasoning, setShowReasoning] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedPrompt = window.localStorage.getItem(ANALYSIS_PROMPT_STORAGE_KEY)?.trim()
    const nextPrompt = storedPrompt || DEFAULT_ANALYSIS_PROMPT
    setPromptDraft(nextPrompt)
    setSavedPrompt(nextPrompt)
  }, [])

  useEffect(() => {
    void loadLatestAnalysis(resumeId)
  }, [resumeId, loadLatestAnalysis])

  const hasUnsavedChanges = useMemo(
    () => promptDraft.trim() !== savedPrompt.trim(),
    [promptDraft, savedPrompt]
  )

  const handleSavePrompt = () => {
    const nextPrompt = promptDraft.trim() || DEFAULT_ANALYSIS_PROMPT
    window.localStorage.setItem(ANALYSIS_PROMPT_STORAGE_KEY, nextPrompt)
    setPromptDraft(nextPrompt)
    setSavedPrompt(nextPrompt)
    setSaveHint('提示词已保存')
  }

  const handleResetPrompt = () => {
    setPromptDraft(DEFAULT_ANALYSIS_PROMPT)
    setSaveHint('已恢复默认提示词，请保存')
  }

  const handleAnalyze = () => {
    const nextPrompt = promptDraft.trim()
    if (!nextPrompt) {
      setSaveHint('请填写并保存提示词')
      return
    }

    setSaveHint(null)
    setShowReasoning(true)
    void analyze(resumeId, nextPrompt)
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'missing':
        return (
          <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'weak':
        return (
          <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'format':
        return (
          <svg className="h-5 w-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
      default:
        return (
          <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return '优秀'
    if (score >= 80) return '良好'
    if (score >= 70) return '中等'
    if (score >= 60) return '及格'
    return '需要改进'
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <AutoResizeTextarea
          minRows={10}
          value={promptDraft}
          onChange={(event) => {
            setPromptDraft(event.target.value)
            setSaveHint(null)
          }}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-7 text-gray-700 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
          placeholder="在这里编写你的简历分析提示词"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleSavePrompt}>
            保存提示词
          </Button>
          <Button type="button" variant="outline" onClick={handleResetPrompt}>
            恢复默认
          </Button>
          <Button
            type="button"
            onClick={handleAnalyze}
            loading={isAnalyzing}
            disabled={hasUnsavedChanges}
          >
            开始分析
          </Button>
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600">请先保存提示词</span>
          )}
        </div>

        {saveHint && (
          <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
            {saveHint}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {(isAnalyzing || analysisReasoning || analysisStatus) && (
        <Section
          title="分析过程"
        >
          <div className="rounded-2xl border border-primary-100 bg-[linear-gradient(180deg,_rgba(239,246,255,0.92)_0%,_rgba(255,255,255,0.96)_100%)] p-4 shadow-[0_18px_50px_-28px_rgba(37,99,235,0.28)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isAnalyzing ? 'animate-pulse bg-primary-500' : 'bg-emerald-500'}`} />
                <span className="text-sm font-medium text-gray-700">
                  {analysisStatus || (isAnalyzing ? 'AI 正在分析...' : '已完成')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReasoning((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-primary-200 hover:text-primary-700"
              >
                {showReasoning ? '收起过程' : '显示过程'}
              </button>
            </div>

            {showReasoning && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100">
                {analysisReasoning ? (
                  <pre className="whitespace-pre-wrap break-words font-sans">{analysisReasoning}</pre>
                ) : (
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary-300" />
                    <span>等待分析输出…</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {analysisResult && (
        <>
          <Section title="" description="">
            <div className="text-center">
              <div className={`mb-2 text-6xl font-bold ${getScoreColor(analysisResult.score)}`}>
                {analysisResult.score}
              </div>
              <div className="mb-4 text-lg text-gray-600">
                简历得分 - {getScoreLabel(analysisResult.score)}
              </div>
              <div className="mb-4 h-3 w-full rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all ${
                    analysisResult.score >= 80
                      ? 'bg-green-500'
                      : analysisResult.score >= 60
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${analysisResult.score}%` }}
                />
              </div>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={resetAnalysis}>
                  清空结果
                </Button>
                <Button onClick={handleAnalyze} loading={isAnalyzing} disabled={hasUnsavedChanges}>
                  重新分析
                </Button>
              </div>
            </div>
          </Section>

          {analysisResult.issues.length > 0 && (
            <Section
              title={`发现的问题 (${analysisResult.issues.length})`}
            >
              <div className="space-y-3">
                {analysisResult.issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border-l-4 p-4 ${
                      issue.type === 'missing'
                        ? 'border-red-500 bg-red-50'
                        : issue.type === 'weak'
                        ? 'border-yellow-500 bg-yellow-50'
                        : issue.type === 'format'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-blue-500 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getIssueIcon(issue.type)}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{issue.message}</p>
                        <p className="mt-1 text-sm text-gray-600">{issue.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {analysisResult.suggestions.length > 0 && (
            <Section title="改进建议">
              <ul className="space-y-2">
                {analysisResult.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 rounded-lg bg-green-50 p-3"
                  >
                    <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-gray-700">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {analysisResult.issues.length === 0 && analysisResult.suggestions.length === 0 && (
            <Section title="" description="">
              <div className="py-8 text-center">
                <svg className="mx-auto mb-4 h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">未发现明显问题</p>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
