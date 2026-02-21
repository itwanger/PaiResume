import { useReducer, useCallback, createContext, useContext, ReactNode } from 'react'
import { Resume, BasicInfo, Education, Experience } from '../types'

// 初始状态
const initialResume: Resume = {
  basicInfo: {
    name: '',
    email: '',
    phone: '',
    github: '',
    website: '',
    location: '',
    summary: ''
  },
  educations: [],
  skills: [],
  experiences: []
}

// Action 类型
type ResumeAction =
  | { type: 'UPDATE_BASIC_INFO'; payload: Partial<BasicInfo> }
  | { type: 'ADD_EDUCATION'; payload: Education }
  | { type: 'UPDATE_EDUCATION'; payload: Education }
  | { type: 'DELETE_EDUCATION'; payload: string }
  | { type: 'ADD_SKILL'; payload: string }
  | { type: 'REMOVE_SKILL'; payload: number }
  | { type: 'SET_SKILLS'; payload: string[] }
  | { type: 'ADD_EXPERIENCE'; payload: Experience }
  | { type: 'UPDATE_EXPERIENCE'; payload: Experience }
  | { type: 'DELETE_EXPERIENCE'; payload: string }
  | { type: 'SET_RESUME'; payload: Resume }
  | { type: 'CLEAR_RESUME' }

// Reducer
function resumeReducer(state: Resume, action: ResumeAction): Resume {
  switch (action.type) {
    case 'UPDATE_BASIC_INFO':
      return {
        ...state,
        basicInfo: { ...state.basicInfo, ...action.payload }
      }

    case 'ADD_EDUCATION':
      return {
        ...state,
        educations: [...state.educations, action.payload]
      }

    case 'UPDATE_EDUCATION':
      return {
        ...state,
        educations: state.educations.map(edu =>
          edu.id === action.payload.id ? action.payload : edu
        )
      }

    case 'DELETE_EDUCATION':
      return {
        ...state,
        educations: state.educations.filter(edu => edu.id !== action.payload)
      }

    case 'ADD_SKILL':
      return {
        ...state,
        skills: [...state.skills, action.payload]
      }

    case 'REMOVE_SKILL':
      return {
        ...state,
        skills: state.skills.filter((_, index) => index !== action.payload)
      }

    case 'SET_SKILLS':
      return {
        ...state,
        skills: action.payload
      }

    case 'ADD_EXPERIENCE':
      return {
        ...state,
        experiences: [...state.experiences, action.payload]
      }

    case 'UPDATE_EXPERIENCE':
      return {
        ...state,
        experiences: state.experiences.map(exp =>
          exp.id === action.payload.id ? action.payload : exp
        )
      }

    case 'DELETE_EXPERIENCE':
      return {
        ...state,
        experiences: state.experiences.filter(exp => exp.id !== action.payload)
      }

    case 'SET_RESUME':
      return action.payload

    case 'CLEAR_RESUME':
      return initialResume

    default:
      return state
  }
}

// Context
interface ResumeContextValue {
  resume: Resume
  updateBasicInfo: (info: Partial<BasicInfo>) => void
  addEducation: (education: Education) => void
  updateEducation: (education: Education) => void
  deleteEducation: (id: string) => void
  addSkill: (skill: string) => void
  removeSkill: (index: number) => void
  setSkills: (skills: string[]) => void
  addExperience: (experience: Experience) => void
  updateExperience: (experience: Experience) => void
  deleteExperience: (id: string) => void
  setResume: (resume: Resume) => void
  clearResume: () => void
}

const ResumeContext = createContext<ResumeContextValue | null>(null)

// Provider 组件
export function ResumeProvider({ children }: { children: ReactNode }) {
  const [resume, dispatch] = useReducer(resumeReducer, initialResume)

  const updateBasicInfo = useCallback((info: Partial<BasicInfo>) => {
    dispatch({ type: 'UPDATE_BASIC_INFO', payload: info })
  }, [])

  const addEducation = useCallback((education: Education) => {
    dispatch({ type: 'ADD_EDUCATION', payload: education })
  }, [])

  const updateEducation = useCallback((education: Education) => {
    dispatch({ type: 'UPDATE_EDUCATION', payload: education })
  }, [])

  const deleteEducation = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EDUCATION', payload: id })
  }, [])

  const addSkill = useCallback((skill: string) => {
    dispatch({ type: 'ADD_SKILL', payload: skill })
  }, [])

  const removeSkill = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_SKILL', payload: index })
  }, [])

  const setSkills = useCallback((skills: string[]) => {
    dispatch({ type: 'SET_SKILLS', payload: skills })
  }, [])

  const addExperience = useCallback((experience: Experience) => {
    dispatch({ type: 'ADD_EXPERIENCE', payload: experience })
  }, [])

  const updateExperience = useCallback((experience: Experience) => {
    dispatch({ type: 'UPDATE_EXPERIENCE', payload: experience })
  }, [])

  const deleteExperience = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EXPERIENCE', payload: id })
  }, [])

  const setResume = useCallback((resume: Resume) => {
    dispatch({ type: 'SET_RESUME', payload: resume })
  }, [])

  const clearResume = useCallback(() => {
    dispatch({ type: 'CLEAR_RESUME' })
  }, [])

  return (
    <ResumeContext.Provider
      value={{
        resume,
        updateBasicInfo,
        addEducation,
        updateEducation,
        deleteEducation,
        addSkill,
        removeSkill,
        setSkills,
        addExperience,
        updateExperience,
        deleteExperience,
        setResume,
        clearResume
      }}
    >
      {children}
    </ResumeContext.Provider>
  )
}

// Hook
export function useResume() {
  const context = useContext(ResumeContext)
  if (!context) {
    throw new Error('useResume must be used within a ResumeProvider')
  }
  return context
}

// 生成唯一 ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
