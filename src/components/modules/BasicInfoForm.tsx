import { useState } from 'react'
import type { BasicInfoContent } from '../../types'
import { useModuleContentState } from '../../hooks/useModuleContentState'
import { normalizeBasicInfoContent } from '../../utils/moduleContent'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function BasicInfoForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useModuleContentState<BasicInfoContent>({
    resumeId,
    moduleId,
    initialContent,
    normalize: normalizeBasicInfoContent,
  })
  const [showOptionalFields, setShowOptionalFields] = useState(() => hasOptionalBasicInfoContent(normalizeBasicInfoContent(initialContent)))

  const update = (field: keyof BasicInfoContent, value: string | boolean) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  const hasOptionalFields = hasOptionalBasicInfoContent(content)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="姓名" value={content.name} onChange={(v) => update('name', v)} />
        <Field label="邮箱" value={content.email} onChange={(v) => update('email', v)} />
        <Field label="求职意向" value={content.jobIntention} onChange={(v) => update('jobIntention', v)} />
        <Field label="手机号" value={content.phone} onChange={(v) => update('phone', v)} />
        <Field label="微信号" value={content.wechat} onChange={(v) => update('wechat', v)} />
        <Field label="籍贯" value={content.hometown} onChange={(v) => update('hometown', v)} />
        <Field label="工作年限" value={content.workYears} onChange={(v) => update('workYears', v)} />
        <Field label="GitHub" value={content.github} onChange={(v) => update('github', v)} />
        <Field label="博客" value={content.blog} onChange={(v) => update('blog', v)} />
      </div>
      {!showOptionalFields ? (
        <button
          type="button"
          onClick={() => setShowOptionalFields(true)}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          + 添加可选信息
        </button>
      ) : (
        <div className="space-y-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">可选信息</p>
              <p className="mt-1 text-xs text-gray-500">填写这些内容可以补充求职偏好和个人标签。</p>
            </div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(false)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              {hasOptionalFields ? '收起' : '取消'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="意向城市" value={content.targetCity} onChange={(v) => update('targetCity', v)} />
            <Field label="期望薪资" value={content.salaryRange} onChange={(v) => update('salaryRange', v)} />
            <Field label="到岗时间" value={content.expectedEntryDate} onChange={(v) => update('expectedEntryDate', v)} />
            <Field label="LeetCode" value={content.leetcode} onChange={(v) => update('leetcode', v)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">个人总结</label>
            <textarea
              value={content.summary}
              onChange={(e) => update('summary', e.target.value)}
              rows={4}
              placeholder="用 50-200 字概括你的核心优势、岗位方向和代表性成果"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={content.isPartyMember}
              onChange={(e) => update('isPartyMember', e.target.checked)}
              className="rounded border-gray-300"
            />
            党员
          </label>
        </div>
      )}
    </div>
  )
}

function hasOptionalBasicInfoContent(content: BasicInfoContent) {
  return Boolean(
    content.targetCity
    || content.salaryRange
    || content.expectedEntryDate
    || content.leetcode
    || content.summary
    || content.isPartyMember
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
      />
    </div>
  )
}
