import { useAnalysis } from '../../hooks/useAnalysis'
import { useResume } from '../../hooks/useResume'
import { Button } from '../ui/Button'
import { Section } from '../ui/Section'

export function ResumeAnalysis() {
  const { resume } = useResume()
  const {
    analysisResult,
    isAnalyzing,
    analyze,
    resetAnalysis,
    useAI,
    toggleAIAnalysis,
    error,
    isLLMConfigured
  } = useAnalysis()

  const handleAnalyze = () => {
    analyze(resume, useAI)
  }

  const handleAnalyzeWithAI = () => {
    analyze(resume, true)
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'missing':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'weak':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'format':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="space-y-6">
      {/* 分析操作区 */}
      {!analysisResult && (
        <Section
          title="简历分析"
          description="智能分析您的简历，发现不足并给出改进建议"
        >
          <div className="text-center py-8">
            <svg className="w-20 h-20 mx-auto mb-4 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-gray-600 mb-4">
              选择分析模式开始分析您的简历
            </p>

            {/* 分析模式选择 */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => useAI && toggleAIAnalysis()}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    !useAI
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    快速分析
                  </span>
                </button>
                <button
                  onClick={() => !useAI && toggleAIAnalysis()}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    useAI
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI 智能分析
                    {!isLLMConfigured && (
                      <span className="ml-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        未配置
                      </span>
                    )}
                  </span>
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                {useAI
                  ? 'AI 智能分析：使用大语言模型进行深度内容分析，提供专业级改进建议（需要配置 API Key）'
                  : '快速分析：基于规则检查简历完整性、格式规范性'}
              </p>
            </div>

            {/* 分析按钮 */}
            <div className="flex justify-center gap-3">
              <Button onClick={handleAnalyze} loading={isAnalyzing}>
                {useAI ? '开始 AI 分析' : '开始快速分析'}
              </Button>
              {useAI && isLLMConfigured && (
                <Button variant="outline" onClick={handleAnalyzeWithAI} loading={isAnalyzing}>
                  使用 AI 分析
                </Button>
              )}
            </div>

            {/* API Key 提示 */}
            {useAI && !isLLMConfigured && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  ⚠️ 需要配置 API Key
                </p>
                <p className="text-sm text-yellow-700 mb-2">
                  要使用 AI 智能分析功能，需要在项目中配置 AI API Key。
                </p>
                <div className="bg-white p-3 rounded border border-yellow-200 mt-2">
                  <p className="text-xs text-gray-600 font-mono">
                    # 在项目根目录创建或编辑 .env 文件：<br/>
                    VITE_AI_API_KEY=your_api_key_here<br/>
                    VITE_AI_BASE_URL=https://api.anthropic.com/v1<br/>
                    VITE_AI_MODEL=claude-sonnet-4-20250514
                  </p>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 分析结果 */}
      {analysisResult && (
        <>
          {/* 总分卡片 */}
          <Section title="" description="">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(analysisResult.score)} mb-2`}>
                {analysisResult.score}
              </div>
              <div className="text-lg text-gray-600 mb-4">
                简历得分 - {getScoreLabel(analysisResult.score)}
                <span className="ml-2 text-sm">
                  ({useAI ? 'AI 分析' : '快速分析'})
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
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
                  返回
                </Button>
                <Button onClick={() => analyze(resume, useAI)} loading={isAnalyzing}>
                  重新分析
                </Button>
              </div>
            </div>
          </Section>

          {/* 问题列表 */}
          {analysisResult.issues.length > 0 && (
            <Section
              title={`发现的问题 (${analysisResult.issues.length})`}
              description="以下是检测到的问题，建议优先处理标红的重要问题"
            >
              <div className="space-y-3">
                {analysisResult.issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      issue.type === 'missing'
                        ? 'bg-red-50 border-red-500'
                        : issue.type === 'weak'
                        ? 'bg-yellow-50 border-yellow-500'
                        : issue.type === 'format'
                        ? 'bg-orange-50 border-orange-500'
                        : 'bg-blue-50 border-blue-500'
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

          {/* 改进建议 */}
          {analysisResult.suggestions.length > 0 && (
            <Section
              title="改进建议"
              description="以下建议可以帮助您进一步提升简历质量"
            >
              <ul className="space-y-2">
                {analysisResult.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 p-3 bg-green-50 rounded-lg"
                  >
                    <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-gray-700">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 无问题提示 */}
          {analysisResult.issues.length === 0 && analysisResult.suggestions.length === 0 && (
            <Section title="" description="">
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto mb-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">太棒了！</p>
                <p className="text-gray-600 mt-2">您的简历没有发现明显问题</p>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
