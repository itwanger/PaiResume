import type { Resume } from '../../types'
import { normalizePhotoSource } from '../../utils/resumePhoto'

interface ResumePreviewProps {
  resume: Resume
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  const { basicInfo, educations, skills, experiences } = resume
  const photoSource = normalizePhotoSource(basicInfo.photo)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
      {/* 头部：基本信息 */}
      <div className="border-b border-gray-200 pb-6 mb-6">
        <div className={photoSource ? 'grid grid-cols-[minmax(0,1fr)_128px] gap-6 items-start' : 'space-y-4'}>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {basicInfo.name || '您的姓名'}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {basicInfo.email && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {basicInfo.email}
                </span>
              )}
              {basicInfo.phone && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {basicInfo.phone}
                </span>
              )}
              {basicInfo.location && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {basicInfo.location}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm">
              {basicInfo.github && (
                <a
                  href={basicInfo.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub
                </a>
              )}
              {basicInfo.website && (
                <a
                  href={basicInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  个人网站
                </a>
              )}
            </div>
            {basicInfo.summary && (
              <p className="mt-4 text-gray-700 leading-relaxed">
                {basicInfo.summary}
              </p>
            )}
          </div>
          {photoSource ? (
            <div className="flex justify-end">
              <div className="aspect-[3/4] w-32 overflow-hidden border border-gray-200 bg-slate-50 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.45)]">
                <img src={photoSource} alt="简历照片" className="h-full w-full object-cover" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 教育背景 */}
      {educations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-2">
            教育背景
          </h2>
          {educations.map((edu) => (
            <div key={edu.id} className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{edu.school}</span>
                  <span className="mx-2 text-gray-500">|</span>
                  <span className="text-gray-700">{edu.major}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <div className="mt-1">
                <span className="text-sm text-gray-600">{edu.degree}</span>
              </div>
              {edu.description && (
                <p className="mt-2 text-sm text-gray-600">{edu.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 专业技能 */}
      {skills.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-2">
            专业技能
          </h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 工作/项目经历 */}
      {experiences.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-2">
            工作/项目经历
          </h2>
          {experiences.map((exp) => (
            <div key={exp.id} className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="font-medium text-gray-900">{exp.position}</span>
                  <span className="mx-2 text-gray-500">|</span>
                  <span className="text-gray-700">{exp.company}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {exp.startDate} - {exp.endDate}
                </span>
              </div>
              <p className="text-gray-700 whitespace-pre-line mb-2">
                {exp.description}
              </p>
              {exp.achievements && exp.achievements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {exp.achievements.map((achievement, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded"
                    >
                      {achievement}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 空状态提示 */}
      {educations.length === 0 && skills.length === 0 && experiences.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>请先填写简历内容，此处将实时预览</p>
        </div>
      )}
    </div>
  )
}
