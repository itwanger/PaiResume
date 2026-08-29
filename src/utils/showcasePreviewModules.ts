import type { ResumeCardPreview, ResumeModule } from '../api/resume'

type PreviewModuleType =
  | 'basic_info'
  | 'education'
  | 'skill'
  | 'internship'
  | 'work_experience'
  | 'project'

const SYNTHETIC_TIMESTAMP = '1970-01-01T00:00:00.000Z'
const DEFAULT_PREVIEW_ORDER: PreviewModuleType[] = [
  'basic_info',
  'education',
  'skill',
  'internship',
  'work_experience',
  'project',
]

function cleanLines(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)))
}

function experienceLines(
  preview: ResumeCardPreview,
  moduleType: 'internship' | 'work_experience',
): string[] {
  const dedicated = cleanLines(
    moduleType === 'internship' ? preview.internships : preview.workExperiences,
  )
  if (dedicated.length) return dedicated

  const internshipCount = preview.moduleCounts?.internship ?? 0
  const workExperienceCount = preview.moduleCounts?.work_experience ?? 0
  const canUseLegacy = moduleType === 'internship'
    ? internshipCount > 0 && workExperienceCount === 0
    : workExperienceCount > 0 && internshipCount === 0
  return canUseLegacy
    ? cleanLines(preview.experiences?.length ? preview.experiences : [preview.experience])
    : []
}

function previewProjects(preview: ResumeCardPreview) {
  const projects = preview.projects?.length
    ? preview.projects
    : preview.project
      ? [{ title: preview.project, description: '' }]
      : []
  const grouped = new Map<string, string[]>()

  projects.forEach((project) => {
    const title = project.title.trim()
    const description = project.description.trim()
    if (!title && !description) return
    const key = title || '公开内容摘要'
    const descriptions = grouped.get(key) ?? []
    if (description && !descriptions.includes(description)) descriptions.push(description)
    grouped.set(key, descriptions)
  })

  return Array.from(grouped, ([title, descriptions]) => ({ title, descriptions }))
}

function createModule(
  moduleType: PreviewModuleType,
  content: Record<string, unknown>,
): Omit<ResumeModule, 'id' | 'sortOrder'> {
  return {
    resumeId: 0,
    moduleType,
    content,
    createdAt: SYNTHETIC_TIMESTAMP,
    updatedAt: SYNTHETIC_TIMESTAMP,
  }
}

/**
 * Builds a PDF-safe, deliberately limited module set from the public showcase
 * preview. The locked detail response keeps its real modules empty; this
 * function must never accept or fall back to private resume modules.
 */
export function buildLockedShowcasePreviewModules(
  preview: ResumeCardPreview,
): ResumeModule[] {
  const educations = cleanLines(
    preview.educations?.length ? preview.educations : [preview.education],
  )
  const skills = cleanLines(preview.skills)
  const internships = experienceLines(preview, 'internship')
  const workExperiences = experienceLines(preview, 'work_experience')
  const projects = previewProjects(preview)
  const factories: Record<PreviewModuleType, () => Array<Omit<ResumeModule, 'id' | 'sortOrder'>>> = {
    basic_info: () => [createModule('basic_info', {
      name: preview.name.trim(),
      email: '',
      jobIntention: preview.targetRole.trim(),
      targetCity: '',
      salaryRange: '',
      expectedEntryDate: '',
      phone: '',
      wechat: '',
      isPartyMember: false,
      photo: '',
      photoId: null,
      photoWidth: null,
      photoHeight: null,
      photoBorder: false,
      hometown: '',
      blog: '',
      github: '',
      leetcode: '',
      workYears: '',
      summary: preview.basicInfo?.trim() ?? '',
      privacyMasked: true,
      politicalStatusMasked: false,
    })],
    education: () => educations.map((education) => createModule('education', {
      school: education,
      schoolLogo: '',
      department: '',
      major: '',
      degree: '',
      startDate: '',
      endDate: '',
      is985: false,
      is211: false,
      isDoubleFirst: false,
    })),
    skill: () => skills.length ? [createModule('skill', {
      categories: [{ name: '', items: skills }],
    })] : [],
    internship: () => internships.length ? [createModule('internship', {
      company: '公开内容摘要',
      position: '',
      startDate: '',
      endDate: '',
      projects: [{
        id: 'preview-internship-1',
        projectName: '',
        role: '',
        startDate: '',
        endDate: '',
        techStack: '',
        projectDescription: '',
        responsibilities: internships,
      }],
    })] : [],
    work_experience: () => workExperiences.length ? [createModule('work_experience', {
      company: '公开内容摘要',
      position: '',
      startDate: '',
      endDate: '',
      projects: [{
        id: 'preview-work-1',
        projectName: '',
        role: '',
        startDate: '',
        endDate: '',
        techStack: '',
        projectDescription: '',
        responsibilities: workExperiences,
      }],
    })] : [],
    project: () => projects.map((project) => createModule('project', {
      projectName: project.title,
      role: '',
      startDate: '',
      endDate: '',
      techStack: '',
      description: '',
      achievements: project.descriptions,
    })),
  }

  const requestedOrder = (preview.moduleOrder ?? [])
    .filter((moduleType): moduleType is PreviewModuleType => (
      DEFAULT_PREVIEW_ORDER.includes(moduleType as PreviewModuleType)
    ))
  const orderedTypes = Array.from(new Set<PreviewModuleType>([
    'basic_info',
    ...requestedOrder.filter((moduleType) => moduleType !== 'basic_info'),
    ...DEFAULT_PREVIEW_ORDER.filter((moduleType) => moduleType !== 'basic_info'),
  ]))

  return orderedTypes
    .flatMap((moduleType) => factories[moduleType]())
    .map((module, index) => ({
      ...module,
      id: -(index + 1),
      sortOrder: index,
    }))
}
