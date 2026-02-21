import { useState, useCallback } from 'react'
import { Section } from '../ui/Section'
import { Input } from '../ui/Input'
import { TextArea } from '../ui/TextArea'
import { Button } from '../ui/Button'
import { useResume, generateId } from '../../hooks/useResume'
import { Education } from '../../types'

const emptyEducation: Omit<Education, 'id'> = {
  school: '',
  degree: '',
  major: '',
  startDate: '',
  endDate: '',
  description: ''
}

export function EducationForm() {
  const { resume, addEducation, updateEducation, deleteEducation } = useResume()
  const { educations } = resume
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Omit<Education, 'id'>>(emptyEducation)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (editingId) {
        updateEducation({ ...formData, id: editingId })
        setEditingId(null)
      } else {
        addEducation({ ...formData, id: generateId() })
      }

      setFormData(emptyEducation)
    },
    [editingId, formData, addEducation, updateEducation]
  )

  const handleEdit = useCallback((education: Education) => {
    setFormData({
      school: education.school,
      degree: education.degree,
      major: education.major,
      startDate: education.startDate,
      endDate: education.endDate,
      description: education.description || ''
    })
    setEditingId(education.id)
  }, [])

  const handleCancel = useCallback(() => {
    setEditingId(null)
    setFormData(emptyEducation)
  }, [])

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <Section title="教育背景" description="填写您的教育经历">
      {/* 教育列表 */}
      {educations.length > 0 && (
        <div className="mb-6 space-y-3">
          {educations.map((education) => (
            <div
              key={education.id}
              className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{education.school}</span>
                  <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded">
                    {education.degree}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{education.major}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {education.startDate} - {education.endDate}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(education)}
                >
                  编辑
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => deleteEducation(education.id)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="学校名称"
            value={formData.school}
            onChange={handleChange('school')}
            placeholder="请输入学校名称"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              学历 *
            </label>
            <select
              value={formData.degree}
              onChange={handleChange('degree')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">请选择学历</option>
              <option value="高中">高中</option>
              <option value="专科">专科</option>
              <option value="本科">本科</option>
              <option value="硕士">硕士</option>
              <option value="博士">博士</option>
            </select>
          </div>
          <Input
            label="专业"
            value={formData.major}
            onChange={handleChange('major')}
            placeholder="请输入专业名称"
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
          label="描述"
          value={formData.description}
          onChange={handleChange('description')}
          placeholder="可选：主修课程、荣誉奖项等"
          rows={3}
        />
        <div className="flex gap-2">
          <Button type="submit">
            {editingId ? '更新' : '添加'}教育经历
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
