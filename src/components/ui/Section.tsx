import { ReactNode } from 'react'

interface SectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function Section({ title, description, children, className = '' }: SectionProps) {
  return (
    <section className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}
