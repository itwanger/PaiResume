import { useEffect, useState } from 'react'
import { useAnalysis } from '../../hooks/useAnalysis'
import type { ResumeAnalysisScenarioCode } from '../../types'
import { Button } from '../ui/Button'

interface ResumeAnalysisProps {
  resumeId: number
}

const ANALYSIS_SCENARIO_STORAGE_KEY = 'pai-resume.analysis-scenario'
const ANALYSIS_SCENARIOS: ReadonlyArray<{
  code: ResumeAnalysisScenarioCode
  label: string
}> = [
  { code: 'WORKING_PROFESSIONAL', label: '工作党' },
  { code: 'STUDENT_DAILY_INTERNSHIP', label: '学生党找日常实习' },
  { code: 'STUDENT_SUMMER_INTERNSHIP', label: '学生党找暑期实习' },
  { code: 'STUDENT_AUTUMN_RECRUITMENT', label: '学生党冲秋招' },
]

function isAnalysisScenarioCode(value: string | null): value is ResumeAnalysisScenarioCode {
  return ANALYSIS_SCENARIOS.some((scenario) => scenario.code === value)
}

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
  const [scenarioCode, setScenarioCode] = useState<ResumeAnalysisScenarioCode | null>(null)
  const [showReasoning, setShowReasoning] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedScenario = window.localStorage.getItem(ANALYSIS_SCENARIO_STORAGE_KEY)
    if (isAnalysisScenarioCode(storedScenario)) {
      setScenarioCode(storedScenario)
    }
  }, [])

  useEffect(() => {
    void loadLatestAnalysis(resumeId)
  }, [resumeId, loadLatestAnalysis])

  useEffect(() => {
    if (!scenarioCode && analysisResult?.scenarioCode) {
      setScenarioCode(analysisResult.scenarioCode)
    }
  }, [analysisResult?.scenarioCode, scenarioCode])

  const handleScenarioChange = (nextScenarioCode: ResumeAnalysisScenarioCode) => {
    setScenarioCode(nextScenarioCode)
    window.localStorage.setItem(ANALYSIS_SCENARIO_STORAGE_KEY, nextScenarioCode)
  }

  const handleAnalyze = () => {
    if (!scenarioCode) return
    setShowReasoning(true)
    void analyze(resumeId, scenarioCode)
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
    <div className="flex flex-col gap-8">
      <section className="space-y-5">
        <h2 className="text-base font-semibold text-slate-900">求职场景</h2>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="选择求职场景">
          {ANALYSIS_SCENARIOS.map((scenario) => {
            const selected = scenario.code === scenarioCode
            return (
              <button
                key={scenario.code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleScenarioChange(scenario.code)}
                className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  selected
                    ? 'border-primary-500 bg-primary-50 text-primary-800 shadow-[0_8px_24px_-20px_rgba(37,99,235,0.8)]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:text-primary-700'
                }`}
              >
                {scenario.label}
              </button>
            )
          })}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleAnalyze}
            loading={isAnalyzing}
            disabled={!scenarioCode}
            className="min-w-28"
          >
            开始分析
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </section>

      {(isAnalyzing || analysisReasoning || analysisStatus) && (
        <section className="rounded-xl bg-primary-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">分析过程</h2>
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isAnalyzing ? 'animate-pulse bg-primary-500' : 'bg-emerald-500'}`} />
              <span className="text-sm text-slate-600">
                {analysisStatus || (isAnalyzing ? 'AI 正在分析...' : '已完成')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowReasoning((current) => !current)}
              className="px-1 py-1.5 text-xs font-medium text-slate-500 transition hover:text-primary-700"
            >
              {showReasoning ? '收起过程' : '显示过程'}
            </button>
          </div>

          {showReasoning && (
            <div className="mt-4 rounded-lg bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100">
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
        </section>
      )}

      {analysisResult && (
        <>
          <section className="rounded-xl bg-slate-50 p-6">
            <div className="text-center">
              <div className={`mb-2 text-6xl font-bold ${getScoreColor(analysisResult.score)}`}>
                {analysisResult.score}
              </div>
              <div className="mb-4 text-lg text-gray-600">
                简历得分
                {analysisResult.scenarioName ? ` · ${analysisResult.scenarioName}` : ''}
                {' - '}{getScoreLabel(analysisResult.score)}
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
                <Button onClick={handleAnalyze} loading={isAnalyzing} disabled={!scenarioCode}>
                  重新分析
                </Button>
              </div>
            </div>
          </section>

          {analysisResult.issues.length > 0 && (
            <section>
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                发现的问题（{analysisResult.issues.length}）
              </h2>
              <div className="space-y-3">
                {analysisResult.issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`rounded-lg p-4 ${
                      issue.type === 'missing'
                        ? 'bg-red-50'
                        : issue.type === 'weak'
                        ? 'bg-yellow-50'
                        : issue.type === 'format'
                        ? 'bg-orange-50'
                        : 'bg-blue-50'
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
            </section>
          )}

          {analysisResult.suggestions.length > 0 && (
            <section>
              <h2 className="mb-4 text-base font-semibold text-slate-900">改进建议</h2>
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
            </section>
          )}

          {analysisResult.issues.length === 0 && analysisResult.suggestions.length === 0 && (
            <section className="rounded-xl bg-emerald-50 py-8 text-center">
              <div>
                <svg className="mx-auto mb-4 h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">未发现明显问题</p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
