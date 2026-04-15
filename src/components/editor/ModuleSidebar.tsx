import type { ResumeModule } from '../../api/resume'
import { MODULE_ICONS, type ModuleType } from '../../types'
import { findBasicInfoContent, getModuleDisplayLabel } from '../../utils/resumeDisplay'

interface ModuleSidebarProps {
  modules: ResumeModule[]
  activeModuleType: ModuleType | null
  onSelect: (moduleType: ModuleType) => void
  onAddModule: (moduleType: ModuleType) => void
  analysisActive?: boolean
  onSelectAnalysis?: () => void
  templateSelectionActive?: boolean
  onSelectTemplateSelection?: () => void
}

const ALL_MODULE_TYPES: ModuleType[] = [
  'basic_info',
  'education',
  'internship',
  'project',
  'skill',
  'paper',
  'research',
  'award',
]

export function ModuleSidebar({
  modules,
  activeModuleType,
  onSelect,
  onAddModule,
  analysisActive = false,
  onSelectAnalysis,
  templateSelectionActive = false,
  onSelectTemplateSelection,
}: ModuleSidebarProps) {
  const existingTypes = new Set(modules.map((m) => m.moduleType as ModuleType))
  const moduleViewActive = !analysisActive && !templateSelectionActive
  const basicInfoContent = findBasicInfoContent(modules)

  return (
    <aside className="sticky top-[65px] min-h-[calc(100vh-65px)] max-h-[calc(100vh-65px)] w-56 self-start overflow-y-auto border-r border-gray-200 bg-white">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">模块</h2>
        <nav className="space-y-1">
          {ALL_MODULE_TYPES.map((type) => {
            const exists = existingTypes.has(type)
            const isActive = moduleViewActive && activeModuleType === type
            const count = modules.filter((m) => m.moduleType === type).length

            return (
              <button
                key={type}
                onClick={() => {
                  if (exists) {
                    onSelect(type)
                  } else {
                    onAddModule(type)
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{MODULE_ICONS[type]}</span>
                <span className="flex-1">{getModuleDisplayLabel(type, basicInfoContent)}</span>
                {count > 1 && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                )}
                {!exists && (
                  <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
            )
          })}
        </nav>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">分析</h2>
          <button
            type="button"
            onClick={onSelectAnalysis}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              analysisActive
                ? 'bg-primary-50 font-medium text-primary-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">📊</span>
              <span className="flex-1">简历分析</span>
            </span>
          </button>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">导出</h2>
          <button
            type="button"
            onClick={onSelectTemplateSelection}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              templateSelectionActive
                ? 'bg-primary-50 font-medium text-primary-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">🖨️</span>
              <span className="flex-1">预览与导出</span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}
