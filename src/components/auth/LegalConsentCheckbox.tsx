import { useId } from 'react'
import { Link } from 'react-router-dom'

interface LegalConsentCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function LegalConsentCheckbox({
  checked,
  onChange,
  disabled = false,
  className = '',
}: LegalConsentCheckboxProps) {
  const checkboxId = useId()
  const descriptionId = `${checkboxId}-description`

  return (
    <div className={`flex items-start gap-3 text-xs leading-5 text-gray-600 ${className}`}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-label="我已阅读并同意服务条款和隐私政策"
        aria-describedby={descriptionId}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div id={descriptionId}>
        <span className="block">
          <label htmlFor={checkboxId} className="cursor-pointer">
            我同意
          </label>
          <Link
            to="/terms"
            target="_blank"
            rel="noreferrer"
            className="mx-1 font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
          >
            《服务条款》
          </Link>
          和
          <Link
            to="/privacy"
            target="_blank"
            rel="noreferrer"
            className="ml-1 font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
          >
            《隐私政策》
          </Link>
        </span>
        <span className="block text-gray-500">
          仅在使用 AI 时，由第三方模型处理简历内容
        </span>
      </div>
    </div>
  )
}
