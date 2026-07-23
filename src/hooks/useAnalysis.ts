import { useState, useCallback } from 'react'
import type { AnalysisResult } from '../types'
import { resumeApi } from '../api/resume'

/**
 * 简历分析 Hook
 * 通过后端 AI 服务分析整份简历
 */
export function useAnalysis() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisReasoning, setAnalysisReasoning] = useState('')
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null)

  /**
   * 执行简历分析
   * @param resumeId 简历 ID
   */
  const analyze = useCallback(async (resumeId: number, prompt?: string) => {
    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)
    setAnalysisReasoning('')
    setAnalysisStatus('正在连接 AI 分析服务...')

    try {
      const result = await resumeApi.analyzeStream(resumeId, { prompt }, {
        onEvent: (event) => {
          if (event.event === 'status') {
            const message = typeof event.data.message === 'string' ? event.data.message : null
            setAnalysisStatus(message)
            return
          }

          if (event.event === 'reasoning_delta') {
            const text = typeof event.data.text === 'string' ? event.data.text : ''
            setAnalysisReasoning(text)
            setAnalysisStatus('AI 正在分析简历重点并组织建议...')
            return
          }

          if (event.event === 'content_delta') {
            setAnalysisStatus('AI 已完成思考，正在输出最终分析结果...')
            return
          }

          if (event.event === 'result') {
            setAnalysisStatus('分析完成')
          }
        },
      })
      setAnalysisResult(result)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('分析失败:', err instanceof Error ? err.name : 'Error')
      }
      setError(err instanceof Error ? err.message : '分析失败，请重试')
      setAnalysisStatus(null)
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const loadLatestAnalysis = useCallback(async (resumeId: number) => {
    setAnalysisResult(null)
    setAnalysisReasoning('')
    setAnalysisStatus(null)
    try {
      const { data } = await resumeApi.getLatestAnalysis(resumeId)
      setAnalysisResult(data.data)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('加载最近分析结果失败:', err instanceof Error ? err.name : 'Error')
      }
    }
  }, [])

  /**
   * 重置分析结果
   */
  const resetAnalysis = useCallback(() => {
    setAnalysisResult(null)
    setError(null)
    setAnalysisReasoning('')
    setAnalysisStatus(null)
  }, [])

  return {
    analysisResult,
    analysisReasoning,
    analysisStatus,
    isAnalyzing,
    analyze,
    loadLatestAnalysis,
    resetAnalysis,
    error,
  }
}
