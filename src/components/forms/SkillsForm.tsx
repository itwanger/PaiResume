import { useState, useCallback, KeyboardEventHandler } from 'react'
import { Section } from '../ui/Section'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useResume } from '../../hooks/useResume'

// 常见技能标签
const commonSkills = [
  'Java', 'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++',
  'React', 'Vue', 'Angular', 'Svelte',
  'Node.js', 'Express', 'NestJS',
  'Spring Boot', 'Spring Cloud',
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'Docker', 'Kubernetes', 'Linux',
  'Git', 'CI/CD', 'DevOps',
  'AWS', 'Azure', 'GCP',
  '机器学习', '深度学习', '数据分析'
]

export function SkillsForm() {
  const { resume, addSkill, removeSkill, setSkills } = useResume()
  const { skills } = resume
  const [inputValue, setInputValue] = useState('')

  const handleAddSkill = useCallback(() => {
    const skill = inputValue.trim()
    if (skill && !skills.includes(skill)) {
      addSkill(skill)
      setInputValue('')
    }
  }, [inputValue, skills, addSkill])

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddSkill()
      }
    },
    [handleAddSkill]
  )

  const handleAddCommonSkill = useCallback(
    (skill: string) => {
      if (!skills.includes(skill)) {
        addSkill(skill)
      }
    },
    [skills, addSkill]
  )

  const handleClearAll = useCallback(() => {
    if (window.confirm('确定要清空所有技能吗？')) {
      setSkills([])
    }
  }, [setSkills])

  return (
    <Section
      title="专业技能"
      description="添加您的专业技能，让招聘方了解您的技术栈"
    >
      {/* 技能标签展示 */}
      {skills.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              已添加 {skills.length} 个技能
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
            >
              清空全部
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, index) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
              >
                {skill}
                <button
                  onClick={() => removeSkill(index)}
                  className="hover:text-primary-900 transition-colors"
                  aria-label={`删除${skill}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 添加技能输入框 */}
      <div className="mb-6">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入技能名称，按回车添加"
            className="flex-1"
          />
          <Button onClick={handleAddSkill} disabled={!inputValue.trim()}>
            添加
          </Button>
        </div>
      </div>

      {/* 常用技能标签 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">常用技能</h3>
        <div className="flex flex-wrap gap-2">
          {commonSkills.map((skill) => {
            const isAdded = skills.includes(skill)
            return (
              <button
                key={skill}
                onClick={() => handleAddCommonSkill(skill)}
                disabled={isAdded}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  isAdded
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700'
                }`}
              >
                {skill}
                {isAdded && ' ✓'}
              </button>
            )
          })}
        </div>
      </div>
    </Section>
  )
}
