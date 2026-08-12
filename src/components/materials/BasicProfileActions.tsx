import { useState } from 'react'
import { contentLibraryApi } from '../../api/contentLibrary'
import { useAuthStore } from '../../store/authStore'
import type { BasicInfoContent } from '../../types'
import { applyMaterialFields, omitUnusedBasicInfoFields } from '../../utils/materialLibrary'
import { getBasicInfoProfileError } from '../../utils/basicInfoValidation'

interface Props {
  content: BasicInfoContent
  onApply: (content: BasicInfoContent) => void
  embedded?: boolean
}

export function BasicProfileActions({ content, onApply, embedded = false }: Props) {
  const accountEmail = useAuthStore((state) => state.user?.email)
  const [pending, setPending] = useState<'load' | 'save' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [undoContent, setUndoContent] = useState<BasicInfoContent | null>(null)

  const applyProfile = async () => {
    setPending('load')
    setError('')
    setMessage('')
    try {
      const response = await contentLibraryApi.getProfile()
      const source = omitUnusedBasicInfoFields(response.data.data.content)
      if (!source.email && accountEmail) source.email = accountEmail
      const next = applyMaterialFields(content as unknown as Record<string, unknown>, source) as unknown as BasicInfoContent
      setUndoContent(content)
      onApply(next)
      setMessage(Object.keys(source).length ? '已从资料库填入基本信息' : '账号中暂无可复用资料')
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '读取我的资料失败')
    } finally {
      setPending(null)
    }
  }

  const saveProfile = async () => {
    const profileContent = omitUnusedBasicInfoFields(content as unknown as Record<string, unknown>)
    const validationError = getBasicInfoProfileError(profileContent)
    if (validationError) {
      setError(validationError)
      setMessage('')
      return
    }
    setPending('save')
    setError('')
    setMessage('')
    try {
      await contentLibraryApi.saveProfile(profileContent)
      setMessage('已保存基本信息到资料库')
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : '保存我的资料失败')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className={embedded ? 'min-w-0 flex-1' : 'rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3'}>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          {undoContent ? (
            <button
              type="button"
              onClick={() => {
                onApply(undoContent)
                setUndoContent(null)
                setMessage('已撤销本次填入')
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
            >
              撤销填入
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void applyProfile()}
            className="rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
          >
            {pending === 'load' ? '读取中…' : '从资料库填入'}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void saveProfile()}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {pending === 'save' ? '保存中…' : '保存到资料库'}
          </button>
        </div>
      </div>
      {message ? <p className="mt-2 text-xs text-emerald-700" role="status">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600" role="alert">{error}</p> : null}
    </div>
  )
}
