import type { ResumeModule } from '../../api/resume'
import { MODULE_ICONS, type ModuleType } from '../../types'
import { findBasicInfoContent, getModuleDisplayLabel } from '../../utils/resumeDisplay'

interface ModuleSidebarProps {
  variant?: 'desktop' | 'drawer'
  modules: ResumeModule[]
  activeModuleType: ModuleType | null
  onSelect: (moduleType: ModuleType) => void
  onAddModule: (moduleType: ModuleType) => void
  onRemoveModuleType: (moduleType: ModuleType) => void
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
  'work_experience',
  'skill',
  'paper',
  'research',
  'award',
]
const NON_REMOVABLE_MODULE_TYPES = new Set<ModuleType>(['basic_info'])

export function ModuleSidebar({
  variant = 'desktop',
  modules,
  activeModuleType,
  onSelect,
  onAddModule,
  onRemoveModuleType,
  analysisActive = false,
  onSelectAnalysis,
  templateSelectionActive = false,
  onSelectTemplateSelection,
}: ModuleSidebarProps) {
  const existingTypes = new Set(modules.map((m) => m.moduleType as ModuleType))
  const moduleViewActive = !analysisActive && !templateSelectionActive
  const basicInfoContent = findBasicInfoContent(modules)
  const asideClassName = variant === 'drawer'
    ? 'h-full w-full overflow-y-auto bg-white'
    : 'sticky top-[65px] hidden min-h-[calc(100vh-65px)] max-h-[calc(100vh-65px)] w-56 shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white md:block'

  return (
    <aside
      className={asideClassName}
      aria-label={variant === 'drawer' ? '移动端模块导航' : '编辑器模块导航'}
    >
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">模块</h2>
        <nav className="space-y-1">
          {ALL_MODULE_TYPES.map((type) => {
            const exists = existingTypes.has(type)
            const isActive = moduleViewActive && activeModuleType === type
            const count = modules.filter((m) => m.moduleType === type).length
            const canRemove = exists && !NON_REMOVABLE_MODULE_TYPES.has(type)
            const moduleLabel = getModuleDisplayLabel(type, basicInfoContent)

            return (
              <div
                key={type}
                className={`flex items-center gap-1 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (exists) {
                      onSelect(type)
                    } else {
                      onAddModule(type)
                    }
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left ${
                    isActive ? 'font-medium' : ''
                  }`}
                >
                  <span className="text-base">{MODULE_ICONS[type]}</span>
                  <span className="flex-1 truncate">{moduleLabel}</span>
                  {count > 1 && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {count}
                    </span>
                  )}
                </button>

                {canRemove ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onRemoveModuleType(type)
                    }}
                    className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    title={`删除${moduleLabel}`}
                    aria-label={`删除${moduleLabel}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                ) : !exists ? (
                  <button
                    type="button"
                    onClick={() => onAddModule(type)}
                    className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-primary-50 hover:text-primary-600"
                    title={`添加${moduleLabel}`}
                    aria-label={`添加${moduleLabel}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                ) : null}
              </div>
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
