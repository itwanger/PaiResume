import { createContext, useContext } from 'react'

export type ModuleFeedbackTone = 'success' | 'error'

export interface ModuleSaveFeedbackContextValue {
  clearFeedback: () => void
  showFeedback: (message: string, tone?: ModuleFeedbackTone) => void
}

export const ModuleSaveFeedbackContext = createContext<ModuleSaveFeedbackContextValue | null>(null)

export function useModuleSaveFeedback() {
  return useContext(ModuleSaveFeedbackContext)
}
