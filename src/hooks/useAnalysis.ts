import { useState, useCallback } from 'react'
import { Resume, AnalysisResult } from '../types'
import { analyzeResume } from '../utils/analyzer'
import { analyzeWithLLM, isLLMConfigured } from '../utils/aiService'

/**
 * 简历分析 Hook
 * 支持本地规则分析和 LLM 智能分析两种模式
 */
export function useAnalysis() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [useAI, setUseAI] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 执行简历分析
   * @param resume 简历数据
   * @param useLLM 是否使用 LLM 分析（可选，优先使用实例状态的 useAI）
   */
  const analyze = useCallback(async (resume: Resume, useLLM?: boolean) => {
    setIsAnalyzing(true)
    setError(null)

    const shouldUseLLM = useLLM !== undefined ? useLLM : useAI

    try {
      if (shouldUseLLM) {
        // 检查 API 配置
        if (!isLLMConfigured()) {
          throw new Error('未配置 AI API Key，请在 .env 文件中设置 VITE_AI_API_KEY')
        }

        // 使用 LLM 分析
        const result = await analyzeWithLLM(resume)
        setAnalysisResult(result)
      } else {
        // 使用本地规则分析
        await new Promise(resolve => setTimeout(resolve, 300))
        const result = analyzeResume(resume)
        setAnalysisResult(result)
      }
    } catch (err) {
      console.error('分析失败:', err)
      setError(err instanceof Error ? err.message : '分析失败，请重试')

      // LLM 失败时降级到本地分析
      if (shouldUseLLM) {
        const fallbackResult = analyzeResume(resume)
        setAnalysisResult(fallbackResult)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }, [useAI])

  /**
   * 重置分析结果
   */
  const resetAnalysis = useCallback(() => {
    setAnalysisResult(null)
    setError(null)
  }, [])

  /**
   * 切换分析模式
   */
  const toggleAIAnalysis = useCallback(() => {
    setUseAI(prev => !prev)
  }, [])

  return {
    analysisResult,
    isAnalyzing,
    analyze,
    resetAnalysis,
    useAI,
    toggleAIAnalysis,
    error,
    isLLMConfigured: isLLMConfigured()
  }
}
