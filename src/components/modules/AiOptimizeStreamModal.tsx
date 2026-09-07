import { AiGenerationProgress } from '../ui/AiGenerationProgress'
import { MarkdownPreview } from '../ui/MarkdownPreview'

function countDisplayCharacters(value: string) {
  return value.replace(/\s+/g, '').length
}

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
          <div className="min-w-0 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-700">优化前</div>
                <div className="text-xs text-gray-500">{countDisplayCharacters(original)} 字</div>
              </div>
              <pre className="max-h-[28vh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-600">
                {original}
              </pre>
            </div>
            <AiGenerationProgress key={status} status={status} reasoning={reasoning} />
          </div>

          <div className="min-w-0 space-y-4">
            {multiCandidate ? (
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">优化后候选</div>
                <div className="max-h-[32vh] space-y-3 overflow-auto">
                  {status === 'completed' && candidates.length > 0 ? candidates.map((candidate, index) => (
                    <div key={`${index}-${candidate}`} className="border-b border-slate-100 py-4 last:border-0">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-green-700">版本 {index + 1}</div>
                          <div className="text-xs text-gray-500">{countDisplayCharacters(candidate)} 字</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAdoptCandidate?.(candidate)}
                          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700"
                        >
                          采纳这个版本
                        </button>
                      </div>
                      <MarkdownPreview
                        content={candidate}
                        emptyText="当前候选为空。"
                        className="rounded-none border-0 bg-transparent p-0"
                      />
                    </div>
                  )) : (
                    <div className="py-6 text-sm text-gray-500">
                      {isStreaming ? 'AI 还在生成候选版本。' : '当前没有可采纳的候选版本。'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-700">优化后</div>
                  <div className="text-xs text-gray-500">{countDisplayCharacters(optimized || '')} 字</div>
                </div>
                <MarkdownPreview
                  content={status === 'completed' ? optimized || '' : ''}
                  emptyText={isStreaming ? 'AI 还在生成优化结果。' : '当前没有可采纳的优化结果。'}
                  className="max-h-[32vh] rounded-none border-0 bg-transparent p-0"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
