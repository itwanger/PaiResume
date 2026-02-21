import { useCallback } from 'react'
import { Section } from '../ui/Section'
import { Input } from '../ui/Input'
import { TextArea } from '../ui/TextArea'
import { useResume } from '../../hooks/useResume'

export function BasicInfoForm() {
  const { resume, updateBasicInfo } = useResume()
  const { basicInfo } = resume

  const handleChange = useCallback(
    (field: keyof typeof basicInfo) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        updateBasicInfo({ [field]: e.target.value })
      },
    [updateBasicInfo]
  )

  return (
    <Section title="基本信息" description="填写您的个人基本信息">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="姓名"
          value={basicInfo.name}
          onChange={handleChange('name')}
          placeholder="请输入您的姓名"
          required
        />
        <Input
          label="邮箱"
          type="email"
          value={basicInfo.email}
          onChange={handleChange('email')}
          placeholder="yourname@email.com"
          required
        />
        <Input
          label="手机号"
          type="tel"
          value={basicInfo.phone}
          onChange={handleChange('phone')}
          placeholder="13800138000"
          required
        />
        <Input
          label="所在地"
          value={basicInfo.location}
          onChange={handleChange('location')}
          placeholder="北京市"
        />
        <Input
          label="GitHub"
          value={basicInfo.github}
          onChange={handleChange('github')}
          placeholder="https://github.com/yourname"
        />
        <Input
          label="个人网站"
          type="url"
          value={basicInfo.website}
          onChange={handleChange('website')}
          placeholder="https://yourname.com"
        />
      </div>
      <div className="mt-4">
        <TextArea
          label="个人总结"
          value={basicInfo.summary}
          onChange={handleChange('summary')}
          placeholder="简要描述您的职业目标、核心技能和优势（50-200 字）"
          rows={4}
          helperText="突出您的核心竞争力和职业定位"
        />
      </div>
    </Section>
  )
}
