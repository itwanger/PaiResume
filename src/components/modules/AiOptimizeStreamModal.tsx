interface Props {
  title: string
  original: string
  reasoning: string
  streamedContent: string
  optimized?: string
  candidates?: string[]
  status: 'streaming' | 'completed' | 'error'
  error?: string
  multiCandidate?: boolean
  onClose: () => void
  onAdoptCandidate?: (candidate: string) => void
}

export function AiOptimizeStreamModal({
  title,
  original,
  reasoning,
  streamedContent,
  optimized,
  candidates = [],
  status,
  error,
  multiCandidate = false,
  onClose,
  onAdoptCandidate,
}: Props) {
  const isStreaming = status === 'streaming'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isStreaming
                    ? 'bg-amber-100 text-amber-700'
                    : status === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {isStreaming ? 'AI 生成中' : status === 'error' ? '生成失败' : '生成完成'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">模态框会实时展示 AI 推理过程和最终结果，确认后才会回填当前字段。</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_1.25fr]">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">优化前</div>
              <pre className="max-h-[28vh] overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                {original}
              </pre>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">AI 生成过程</div>
              <pre className="max-h-[34vh] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-100">
                {reasoning || (isStreaming ? '正在等待生成过程输出...' : '本次未返回过程信息。')}
              </pre>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">最终结果流</div>
              <pre className="max-h-[22vh] overflow-auto whitespace-pre-wrap rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-gray-700">
                {streamedContent || (isStreaming ? '正在等待最终结果...' : '本次未返回最终结果。')}
              </pre>
            </div>

            {multiCandidate ? (
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">优化后候选</div>
                <div className="max-h-[32vh] space-y-3 overflow-auto">
                  {candidates.length > 0 ? candidates.map((candidate, index) => (
                    <div key={`${index}-${candidate}`} className="rounded-xl bg-green-50 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-green-700">版本 {index + 1}</div>
                        <button
                          type="button"
                          onClick={() => onAdoptCandidate?.(candidate)}
                          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700"
                        >
                          采纳这个版本
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{candidate}</pre>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                      {isStreaming ? 'AI 还在生成候选版本。' : '当前没有可采纳的候选版本。'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">优化后</div>
                <pre className="max-h-[32vh] overflow-auto whitespace-pre-wrap rounded-xl bg-green-50 p-4 text-sm leading-6 text-gray-700">
                  {optimized || (isStreaming ? 'AI 还在生成优化结果。' : '当前没有可采纳的优化结果。')}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
