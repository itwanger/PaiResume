import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resumeApi } from '../api/resume'
import { Header } from '../components/layout/Header'
import { getResumeEditorEntryPath } from '../utils/resumeCreation'

let pendingEditorResolution: Promise<string> | null = null

function resolveResumeEditor() {
  if (pendingEditorResolution) {
    return pendingEditorResolution
  }

  pendingEditorResolution = (async () => {
    const { data: response } = await resumeApi.list()
    return getResumeEditorEntryPath(response.data)
  })().finally(() => {
    pendingEditorResolution = null
  })

  return pendingEditorResolution
}

export default function ResumeEditorEntryPage() {
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const resolveEditor = async () => {
      setError('')
      try {
        const destination = await resolveResumeEditor()
        if (!cancelled) {
          navigate(destination, { replace: true })
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '打开简历编辑器失败，请稍后重试'
          setError(message)
        }
      }
    }

    void resolveEditor()
    return () => {
      cancelled = true
    }
  }, [attempt, navigate])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto flex max-w-7xl justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
          {error ? (
            <>
              <h1 className="text-lg font-semibold text-gray-900">暂时无法打开简历编辑器</h1>
              <p className="mt-3 text-sm leading-6 text-red-600" role="alert">{error}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                重新尝试
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-primary-100" aria-hidden="true" />
              <h1 className="mt-5 text-lg font-semibold text-gray-900">正在打开简历编辑器</h1>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
