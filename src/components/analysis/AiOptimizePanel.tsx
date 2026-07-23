import { useState } from 'react'
import { resumeApi } from '../../api/resume'
import { useResumeStore } from '../../store/resumeStore'

interface Props {
  resumeId: number
  moduleId: number
  onClose: () => void
}

export function AiOptimizePanel({ resumeId, moduleId, onClose }: Props) {
  const { updateModuleContent } = useResumeStore()
  const [loading, setLoading] = useState(false)
  const [original, setOriginal] = useState<Record<string, unknown> | null>(null)
  const [optimized, setOptimized] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  const handleOptimize = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: res } = await resumeApi.aiOptimize(resumeId, moduleId)
      setOriginal(res.data.original)
      setOptimized(res.data.optimized)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI 优化失败，请稍后重试'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdopt = async () => {
    if (!optimized) return
    try {
      await updateModuleContent(resumeId, moduleId, optimized)
      onClose()
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('保存失败:', err instanceof Error ? err.name : 'Error')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">AI 优化</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {!original && !optimized && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">使用 AI 帮你优化模块内容，让描述更加专业</p>
              <button
                onClick={handleOptimize}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                开始优化
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-gray-500">AI 正在优化中...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {original && optimized && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">原始内容</h4>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 max-h-48 overflow-auto">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(original, null, 2)}</pre>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">优化后</h4>
                <div className="bg-green-50 rounded-lg p-4 text-sm text-gray-600 max-h-48 overflow-auto">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(optimized, null, 2)}</pre>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                >
                  忽略
                </button>
                <button
                  onClick={handleAdopt}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
                >
                  采纳优化
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
