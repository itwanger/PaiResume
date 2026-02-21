import { useState, useCallback, useRef } from 'react'
import { ResumeProvider, useResume } from './hooks/useResume'
import { BasicInfoForm } from './components/forms/BasicInfoForm'
import { EducationForm } from './components/forms/EducationForm'
import { SkillsForm } from './components/forms/SkillsForm'
import { ExperienceForm } from './components/forms/ExperienceForm'
import { ResumePreview } from './components/preview/ResumePreview'
import { ResumeAnalysis } from './components/analysis/ResumeAnalysis'
import { Button } from './components/ui/Button'
import { extractTextFromPDF, parseResumeText } from './utils/pdfParser'
import type { FormStep } from './types'

const steps: { id: FormStep; label: string }[] = [
  { id: 'basic', label: '基本信息' },
  { id: 'education', label: '教育背景' },
  { id: 'skills', label: '专业技能' },
  { id: 'experience', label: '经历' },
  { id: 'preview', label: '预览' },
  { id: 'analysis', label: '分析' }
]

function AppContent() {
  const { resume, setResume, setSkills } = useResume()
  const [currentStep, setCurrentStep] = useState<FormStep>('basic')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !file.name.endsWith('.pdf')) {
        alert('请上传 PDF 格式的文件')
        return
      }

      setIsUploading(true)

      try {
        // 提取 PDF 文本
        const text = await extractTextFromPDF(file)

        // 解析简历内容
        const parsed = parseResumeText(text)

        // 更新简历数据
        if (parsed.basicInfo) {
          // 保留已有的基本信息
        }
        if (parsed.skills && parsed.skills.length > 0) {
          setSkills(parsed.skills)
        }

        alert(`简历解析完成！\n\n已提取以下信息：\n- 邮箱：${parsed.basicInfo?.email || '未检测到'}\n- 手机：${parsed.basicInfo?.phone || '未检测到'}\n- 技能：${parsed.skills?.length || 0} 项\n\n请检查并补充完整信息。`)

        setCurrentStep('basic')
      } catch (error) {
        console.error('解析失败:', error)
        alert('解析失败，请确保 PDF 文件可读取')
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [setSkills]
  )

  const handleImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleExport = useCallback(() => {
    window.print()
  }, [])

  const handleClear = useCallback(() => {
    if (window.confirm('确定要清空所有内容吗？此操作不可恢复。')) {
      localStorage.removeItem('pai-resume-data')
      window.location.reload()
    }
  }, [])

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id)
    }
  }

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id)
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'basic':
        return <BasicInfoForm />
      case 'education':
        return <EducationForm />
      case 'skills':
        return <SkillsForm />
      case 'experience':
        return <ExperienceForm />
      case 'preview':
        return <ResumePreview />
      case 'analysis':
        return <ResumeAnalysis />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">派简历</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleImport} disabled={isUploading}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                导入 PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                导出
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                清空
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 步骤导航 */}
      <nav className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 py-4 overflow-x-auto">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    currentStep === step.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {step.label}
                </button>
                {index < steps.length - 1 && (
                  <svg className="w-4 h-4 text-gray-300 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：表单/内容 */}
          <div className="lg:col-span-1 print:hidden">
            {renderCurrentStep()}
          </div>

          {/* 右侧：预览 */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-4 print:hidden">
                <h2 className="text-lg font-semibold text-gray-900">实时预览</h2>
                <span className="text-sm text-gray-500">A4 纸张效果</span>
              </div>
              <div className="overflow-auto print:overflow-visible">
                <ResumePreview />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 底部导航按钮 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-4 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
            >
              上一步
            </Button>
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-2 h-2 rounded-full ${
                    index === currentStepIndex
                      ? 'bg-primary-600'
                      : index < currentStepIndex
                      ? 'bg-primary-300'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <Button onClick={handleNext} disabled={currentStepIndex === steps.length - 1}>
              下一步
            </Button>
          </div>
        </div>
      </footer>

      {/* 底部占位，避免内容被固定底部遮挡 */}
      <div className="h-24 print:hidden" />
    </div>
  )
}

function App() {
  return (
    <ResumeProvider>
      <AppContent />
    </ResumeProvider>
  )
}

export default App
