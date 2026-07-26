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
    <div className={`flex items-start gap-3 text-sm leading-6 text-gray-600 ${className}`}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <span id={descriptionId}>
        <label htmlFor={checkboxId} className="cursor-pointer">
          我已阅读并同意
        </label>
        <Link
          to="/terms"
          target="_blank"
          rel="noreferrer"
          className="mx-1 font-medium text-primary-600 hover:text-primary-700"
        >
          《服务条款》
        </Link>
        和
        <Link
          to="/privacy"
          target="_blank"
          rel="noreferrer"
          className="ml-1 font-medium text-primary-600 hover:text-primary-700"
        >
          《隐私政策》
        </Link>
        ，并知悉仅在我主动使用 AI 功能时，相关简历内容会发送给政策所述第三方模型服务商处理
      </span>
    </div>
  )
}
