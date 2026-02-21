import { useState, useCallback } from 'react'
import { Section } from '../ui/Section'
import { Input } from '../ui/Input'
import { TextArea } from '../ui/TextArea'
import { Button } from '../ui/Button'
import { useResume, generateId } from '../../hooks/useResume'
import { Experience } from '../../types'

const emptyExperience: Omit<Experience, 'id'> = {
  company: '',
  position: '',
  startDate: '',
  endDate: '',
  description: '',
  achievements: []
}

export function ExperienceForm() {
  const { resume, addExperience, updateExperience, deleteExperience } = useResume()
  const { experiences } = resume
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Omit<Experience, 'id'>>(emptyExperience)
  const [achievementInput, setAchievementInput] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (editingId) {
        updateExperience({ ...formData, id: editingId })
        setEditingId(null)
      } else {
        addExperience({ ...formData, id: generateId() })
      }

      setFormData(emptyExperience)
    },
    [editingId, formData, addExperience, updateExperience]
  )

  const handleEdit = useCallback((experience: Experience) => {
    setFormData({
      company: experience.company,
      position: experience.position,
      startDate: experience.startDate,
      endDate: experience.endDate,
      description: experience.description,
      achievements: experience.achievements || []
    })
    setEditingId(experience.id)
  }, [])

  const handleCancel = useCallback(() => {
    setEditingId(null)
    setFormData(emptyExperience)
  }, [])

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleAddAchievement = useCallback(() => {
    if (achievementInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        achievements: [...(prev.achievements || []), achievementInput.trim()]
      }))
      setAchievementInput('')
    }
  }, [achievementInput])

  const handleRemoveAchievement = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      achievements: prev.achievements?.filter((_, i) => i !== index) || []
    }))
  }, [])

  return (
    <Section title="工作/项目经历" description="展示您的工作和项目经验">
      {/* 经历列表 */}
      {experiences.length > 0 && (
        <div className="mb-6 space-y-3">
          {experiences.map((exp) => (
            <div
              key={exp.id}
              className="p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{exp.position}</span>
                    <span className="text-gray-500">@</span>
                    <span className="text-gray-700">{exp.company}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {exp.startDate} - {exp.endDate}
                  </p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                    {exp.description}
                  </p>
                  {exp.achievements && exp.achievements.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {exp.achievements.map((achievement, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded"
                        >
                          {achievement}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(exp)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deleteExperience(exp.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="公司/项目名称"
            value={formData.company}
            onChange={handleChange('company')}
            placeholder="请输入公司或项目名称"
            required
          />
          <Input
            label="职位/角色"
            value={formData.position}
            onChange={handleChange('position')}
            placeholder="请输入您的职位"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="开始时间"
              type="month"
              value={formData.startDate}
              onChange={handleChange('startDate')}
              required
            />
            <Input
              label="结束时间"
              type="month"
              value={formData.endDate}
              onChange={handleChange('endDate')}
              placeholder="至今"
              required
            />
          </div>
        </div>

        <TextArea
          label="工作描述"
          value={formData.description}
          onChange={handleChange('description')}
          placeholder="描述您的工作职责和主要成就（使用 STAR 法则：情境 - 任务 - 行动 - 结果）"
          rows={4}
          required
          helperText="尽量使用量化指标，如'性能提升 50%'、'用户增长 10 万'等"
        />

        {/* 成就标签 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            关键成就
          </label>
          {formData.achievements && formData.achievements.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.achievements.map((achievement, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                >
                  {achievement}
                  <button
                    type="button"
                    onClick={() => handleRemoveAchievement(index)}
                    className="hover:text-green-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={achievementInput}
              onChange={(e) => setAchievementInput(e.target.value)}
              placeholder="输入成就描述，如'性能提升 50%'"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAchievement())}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddAchievement}
              disabled={!achievementInput.trim()}
            >
              添加
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit">
            {editingId ? '更新' : '添加'}经历
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={handleCancel}>
              取消
            </Button>
          )}
        </div>
      </form>
    </Section>
  )
}
