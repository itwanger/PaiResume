import { useState, useEffect } from 'react'
import type { BasicInfoContent } from '../../types'
import { useAutoSave } from '../../hooks/useAutoSave'
import { normalizeBasicInfoContent } from '../../utils/moduleContent'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
}

export function BasicInfoForm({ resumeId, moduleId, initialContent }: Props) {
  const [content, setContent] = useState<BasicInfoContent>(() => normalizeBasicInfoContent(initialContent))
  const { save } = useAutoSave(resumeId, moduleId)

  useEffect(() => {
    setContent(normalizeBasicInfoContent(initialContent))
  }, [initialContent])

  useEffect(() => {
    save(content as unknown as Record<string, unknown>)
  }, [content, save])

  const update = (field: keyof BasicInfoContent, value: string | boolean) => {
    setContent((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="姓名" value={content.name} onChange={(v) => update('name', v)} />
        <Field label="邮箱" value={content.email} onChange={(v) => update('email', v)} />
        <Field label="求职意向" value={content.jobIntention} onChange={(v) => update('jobIntention', v)} />
        <Field label="意向城市" value={content.targetCity} onChange={(v) => update('targetCity', v)} />
        <Field label="期望薪资" value={content.salaryRange} onChange={(v) => update('salaryRange', v)} />
        <Field label="到岗时间" value={content.expectedEntryDate} onChange={(v) => update('expectedEntryDate', v)} />
        <Field label="手机号" value={content.phone} onChange={(v) => update('phone', v)} />
        <Field label="微信号" value={content.wechat} onChange={(v) => update('wechat', v)} />
        <Field label="籍贯" value={content.hometown} onChange={(v) => update('hometown', v)} />
        <Field label="工作年限" value={content.workYears} onChange={(v) => update('workYears', v)} />
        <Field label="GitHub" value={content.github} onChange={(v) => update('github', v)} />
        <Field label="博客" value={content.blog} onChange={(v) => update('blog', v)} />
        <Field label="LeetCode" value={content.leetcode} onChange={(v) => update('leetcode', v)} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">个人总结</label>
        <textarea
          value={content.summary}
          onChange={(e) => update('summary', e.target.value)}
          rows={4}
          placeholder="用 50-200 字概括你的核心优势、岗位方向和代表性成果"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={content.isPartyMember}
          onChange={(e) => update('isPartyMember', e.target.checked)}
          className="rounded border-gray-300"
        />
        中共党员
      </label>
    </div>
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
