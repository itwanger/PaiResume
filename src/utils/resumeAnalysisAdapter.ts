import type { ResumeModule } from '../api/resume'
import type { Experience, Resume } from '../types'
import {
  normalizeBasicInfoContent,
  normalizeEducationContent,
  normalizeInternshipContent,
  normalizeProjectContent,
  normalizeResearchContent,
  normalizeSkillContent,
} from './moduleContent'

function toExperienceId(moduleId: number): string {
  return moduleId.toString()
}

function buildEducationDescription(content: ReturnType<typeof normalizeEducationContent>): string {
  const tags = [
    content.department,
    content.is985 ? '985' : '',
    content.is211 ? '211' : '',
    content.isDoubleFirst ? '双一流' : '',
  ].filter(Boolean)

  return tags.join(' · ')
}

function buildResearchExperience(module: ResumeModule): Experience {
  const content = normalizeResearchContent(module.content)
  const descriptionParts = [content.background, content.workContent, content.achievements].filter(Boolean)

  return {
    id: toExperienceId(module.id),
    company: content.projectName,
    position: '科研经历',
    startDate: content.projectCycle,
    endDate: '',
    description: descriptionParts.join('\n'),
    achievements: content.achievements ? [content.achievements] : [],
  }
}

export function buildAnalysisResume(modules: ResumeModule[]): Resume {
  const basicInfoModule = modules.find((module) => module.moduleType === 'basic_info')
  const basicInfoContent = basicInfoModule
    ? normalizeBasicInfoContent(basicInfoModule.content)
    : normalizeBasicInfoContent({})

  const educations = modules
    .filter((module) => module.moduleType === 'education')
    .map((module) => {
      const content = normalizeEducationContent(module.content)

      return {
        id: module.id.toString(),
        school: content.school,
        degree: content.degree,
        major: content.major,
        startDate: content.startDate,
        endDate: content.endDate,
        description: buildEducationDescription(content),
      }
    })

  const skills = modules
    .filter((module) => module.moduleType === 'skill')
    .flatMap((module) => normalizeSkillContent(module.content).categories.flatMap((category) => category.items))

  const experiences = modules.flatMap((module) => {
    if (module.moduleType === 'internship') {
      const content = normalizeInternshipContent(module.content)
      const description = [
        content.projectDescription ? `项目简介：${content.projectDescription}` : '',
        content.responsibilities.length > 0 ? `核心职责：\n${content.responsibilities.join('\n')}` : '',
      ].filter(Boolean).join('\n')

      return [{
        id: toExperienceId(module.id),
        company: content.company || content.projectName,
        position: content.position,
        startDate: content.startDate,
        endDate: content.endDate,
        description,
        achievements: [],
      }]
    }

    if (module.moduleType === 'project') {
      const content = normalizeProjectContent(module.content)

      return [{
        id: toExperienceId(module.id),
        company: content.projectName,
        position: content.role,
        startDate: content.startDate,
        endDate: content.endDate,
        description: [content.techStack ? `技术栈：${content.techStack}` : '', content.description]
          .filter(Boolean)
          .join('\n'),
        achievements: content.achievements,
      }]
    }

    if (module.moduleType === 'research') {
      return [buildResearchExperience(module)]
    }

    return []
  })

  return {
    basicInfo: {
      name: basicInfoContent.name,
      email: basicInfoContent.email,
      phone: basicInfoContent.phone,
      github: basicInfoContent.github,
      website: basicInfoContent.blog,
      location: basicInfoContent.hometown,
      summary: basicInfoContent.summary,
    },
    educations,
    skills: [...new Set(skills)],
    experiences,
  }
}
