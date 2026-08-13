import { ExperienceModuleForm } from './ExperienceModuleForm'

interface Props {
  resumeId: number
  moduleId: number
  initialContent: Record<string, unknown>
  viewMode?: 'company' | 'projects'
  onOpenProjects?: () => void
  onBackToCompanies?: () => void
}

export function WorkExperienceForm({ resumeId, moduleId, initialContent, viewMode, onOpenProjects, onBackToCompanies }: Props) {
  return (
    <ExperienceModuleForm
      resumeId={resumeId}
      moduleId={moduleId}
      initialContent={initialContent}
      moduleType="work_experience"
      moduleLabel="工作经历"
      summaryPlaceholder="填写这段工作经历的背景、目标和整体内容"
      viewMode={viewMode}
      onOpenProjects={onOpenProjects}
      onBackToCompanies={onBackToCompanies}
    />
  )
}
