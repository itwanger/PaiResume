import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { useLocation } from 'react-router-dom'
import type { ResumeModule } from '../api/resume'

export interface FieldOptimizeReturnTarget {
  moduleId: number
  projectIndex: number
  fieldType: string
  index: number | null
}

export function fieldOptimizeInputId(moduleId: number, projectIndex: number, fieldType: string, index: number | null = null) {
  return `optimize-input-${moduleId}-${projectIndex}-${fieldType}-${index ?? 'description'}`
}

interface Options {
  resumeId: number
  modules: ResumeModule[]
  modulesLoaded: boolean
  activeModuleType: string | null
  focusedExperienceModuleId: number | null
  setFocusedExperienceModuleId: Dispatch<SetStateAction<number | null>>
  setCollapsedModuleIds: Dispatch<SetStateAction<Set<number>>>
}

export function useFieldOptimizeReturn({ resumeId, modules, modulesLoaded, activeModuleType, focusedExperienceModuleId, setFocusedExperienceModuleId, setCollapsedModuleIds }: Options) {
  const location = useLocation()
  // Preserve the target while the editor normalizes its query parameters.
  const targetRef = useRef<FieldOptimizeReturnTarget | null>(location.state?.fieldOptimizeReturn ?? null)
  useEffect(() => {
    const target = targetRef.current
    if (!target || !modulesLoaded) return
    const module = modules.find((item) => item.id === target.moduleId && item.resumeId === resumeId)
    if (!module) { targetRef.current = null; return }
    if (module.moduleType !== activeModuleType) return
    const experience = module.moduleType === 'internship' || module.moduleType === 'work_experience'
    if (experience && focusedExperienceModuleId !== module.id) {
      setFocusedExperienceModuleId(module.id)
      return
    }
    setCollapsedModuleIds((current) => {
      if (!current.has(module.id)) return current
      const next = new Set(current)
      next.delete(module.id)
      return next
    })
    const frame = window.requestAnimationFrame(() => {
      const input = document.getElementById(fieldOptimizeInputId(module.id, target.projectIndex, target.fieldType, target.index))
      const destination = input ?? document.getElementById(`module-card-${module.id}`)
      destination?.scrollIntoView({ block: 'center' })
      if (input instanceof HTMLTextAreaElement) input.focus({ preventScroll: true })
      targetRef.current = null
    })
    return () => window.cancelAnimationFrame(frame)
  }, [resumeId, modules, modulesLoaded, activeModuleType, focusedExperienceModuleId, setFocusedExperienceModuleId, setCollapsedModuleIds])
}
