import { useState } from 'react'
import type { ResumeModule } from '../../api/resume'
import { MODULE_ICONS, type ModuleType } from '../../types'
import {
  DEFAULT_RESUME_MODULE_TYPE_ORDER,
  findBasicInfoContent,
  getModuleDisplayLabel,
  getOrderedExistingModuleTypes,
} from '../../utils/resumeDisplay'

interface ModuleSidebarProps {
  variant?: 'desktop' | 'drawer'
  modules: ResumeModule[]
  activeModuleType: ModuleType | null
  onSelect: (moduleType: ModuleType) => void
  onAddModule: (moduleType: ModuleType) => void
  onRemoveModuleType: (moduleType: ModuleType) => void
  onReorderModuleTypes?: (moduleTypes: ModuleType[]) => Promise<void>
  analysisActive?: boolean
  onSelectAnalysis?: () => void
  templateSelectionActive?: boolean
  onSelectTemplateSelection?: () => void
}

const NON_REMOVABLE_MODULE_TYPES = new Set<ModuleType>(['basic_info'])

export function ModuleSidebar({
  variant = 'desktop',
  modules,
  activeModuleType,
  onSelect,
  onAddModule,
  onRemoveModuleType,
  onReorderModuleTypes,
  analysisActive = false,
  onSelectAnalysis,
  templateSelectionActive = false,
  onSelectTemplateSelection,
}: ModuleSidebarProps) {
  const [sorting, setSorting] = useState(false)
  const [draggedType, setDraggedType] = useState<ModuleType | null>(null)
  const [dragOverType, setDragOverType] = useState<ModuleType | null>(null)
  const [reorderPending, setReorderPending] = useState(false)
  const [reorderError, setReorderError] = useState('')
  const existingTypes = new Set(modules.map((m) => m.moduleType as ModuleType))
  const orderedExistingTypes = getOrderedExistingModuleTypes(modules)
  const sortableTypes: ModuleType[] = orderedExistingTypes.filter((type) => type !== 'basic_info')
  const missingTypes = DEFAULT_RESUME_MODULE_TYPE_ORDER.filter((type) => !existingTypes.has(type))
  const moduleViewActive = !analysisActive && !templateSelectionActive
  const basicInfoContent = findBasicInfoContent(modules)
  const asideClassName = variant === 'drawer'
    ? 'h-full w-full overflow-y-auto bg-white'
    : 'hidden h-full min-h-0 w-44 shrink-0 overflow-y-auto border-r border-gray-200 bg-white md:block'

  const reorder = async (sourceType: ModuleType, targetType: ModuleType) => {
    if (!onReorderModuleTypes || reorderPending || sourceType === targetType || sourceType === 'basic_info') {
      return
    }

    const sourceIndex = sortableTypes.indexOf(sourceType)
    const targetIndex = sortableTypes.indexOf(targetType)
    if (sourceIndex < 0 || targetIndex < 0) return

    const nextSortableTypes = [...sortableTypes]
    nextSortableTypes.splice(sourceIndex, 1)
    nextSortableTypes.splice(targetIndex, 0, sourceType)
    const nextOrder = existingTypes.has('basic_info')
      ? ['basic_info' as ModuleType, ...nextSortableTypes]
      : nextSortableTypes

    setReorderPending(true)
    setReorderError('')
    try {
      await onReorderModuleTypes(nextOrder)
    } catch {
      setReorderError('顺序保存失败，请重试')
    } finally {
      setReorderPending(false)
      setDraggedType(null)
      setDragOverType(null)
    }
  }

  const renderModuleRow = (type: ModuleType, exists: boolean) => {
    const isActive = moduleViewActive && activeModuleType === type
    const count = modules.filter((module) => module.moduleType === type).length
    const canRemove = exists && !NON_REMOVABLE_MODULE_TYPES.has(type)
    const canDrag = sorting && exists && type !== 'basic_info'
    const moduleLabel = getModuleDisplayLabel(type, basicInfoContent)
    const sortableIndex = sortableTypes.indexOf(type)

    return (
      <div
        key={type}
        onDragOver={(event) => {
          if (!canDrag || !draggedType) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setDragOverType(type)
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (draggedType) void reorder(draggedType, type)
        }}
        className={`flex items-center gap-1 rounded-lg text-sm transition-colors ${
          dragOverType === type && draggedType !== type
            ? 'bg-primary-50 ring-1 ring-primary-200'
            : isActive
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-50'
        } ${draggedType === type ? 'opacity-45' : ''}`}
      >
        {canDrag ? (
          <button
            type="button"
            draggable={!reorderPending}
            onClick={(event) => event.preventDefault()}
            onDragStart={(event) => {
              setDraggedType(type)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', type)
            }}
            onDragEnd={() => {
              setDraggedType(null)
              setDragOverType(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp' && sortableIndex > 0) {
                event.preventDefault()
                void reorder(type, sortableTypes[sortableIndex - 1])
              }
              if (event.key === 'ArrowDown' && sortableIndex >= 0 && sortableIndex < sortableTypes.length - 1) {
                event.preventDefault()
                void reorder(type, sortableTypes[sortableIndex + 1])
              }
            }}
            className="ml-1 flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-white hover:text-primary-600 active:cursor-grabbing disabled:cursor-wait"
            aria-label={`拖动${moduleLabel}调整顺序，或使用上下方向键`}
            title="拖动排序"
            disabled={reorderPending}
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="3" r="1" /><circle cx="11" cy="3" r="1" />
              <circle cx="5" cy="8" r="1" /><circle cx="11" cy="8" r="1" />
              <circle cx="5" cy="13" r="1" /><circle cx="11" cy="13" r="1" />
            </svg>
          </button>
        ) : sorting && type === 'basic_info' ? (
          <span className="ml-1 flex h-7 w-5 shrink-0 items-center justify-center text-gray-300" title="基本信息固定在首位" aria-label="基本信息固定在首位">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V7a4 4 0 118 0v4m-9 0h10v9H11z" />
            </svg>
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (sorting) return
            if (exists) onSelect(type)
            else onAddModule(type)
          }}
          aria-label={exists && count > 1 ? `${moduleLabel}，共 ${count} 项` : undefined}
          aria-disabled={sorting || undefined}
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
            isActive ? 'font-medium' : ''
          } ${sorting ? 'cursor-default' : ''}`}
        >
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center text-base" aria-hidden="true">
            {MODULE_ICONS[type]}
            {count > 1 ? (
              <span
                className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white ${
                  isActive ? 'bg-primary-600' : 'bg-slate-500'
                }`}
              >
                {count}
              </span>
            ) : null}
          </span>
          <span className="flex-1 truncate">{moduleLabel}</span>
        </button>

        {!sorting && canRemove ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemoveModuleType(type)
            }}
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
            title={`删除${moduleLabel}`}
            aria-label={`删除${moduleLabel}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        ) : !sorting && !exists ? (
          <button
            type="button"
            onClick={() => onAddModule(type)}
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-primary-50 hover:text-primary-600"
            title={`添加${moduleLabel}`}
            aria-label={`添加${moduleLabel}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <aside
      className={asideClassName}
      aria-label={variant === 'drawer' ? '移动端模块导航' : '编辑器模块导航'}
    >
      <div className={variant === 'drawer' ? 'p-4' : 'p-3'}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">模块</h2>
          {sortableTypes.length > 1 && onReorderModuleTypes ? (
            <button
              type="button"
              onClick={() => {
                setSorting((value) => !value)
                setReorderError('')
                setDraggedType(null)
                setDragOverType(null)
              }}
              className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              {sorting ? '完成' : '调整顺序'}
            </button>
          ) : null}
        </div>
        {reorderPending ? <p className="mb-2 text-xs text-gray-400" role="status">正在保存顺序…</p> : null}
        {reorderError ? <p className="mb-2 text-xs text-red-600" role="alert">{reorderError}</p> : null}
        <nav className="space-y-1">
          {orderedExistingTypes.map((type) => renderModuleRow(type, true))}
        </nav>

        {!sorting && missingTypes.length > 0 ? (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="mb-1.5 px-2.5 text-[11px] font-medium text-gray-400">可添加模块</p>
            <nav className="space-y-1">
              {missingTypes.map((type) => renderModuleRow(type, false))}
            </nav>
          </div>
        ) : null}

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
