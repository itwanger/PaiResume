import { Link } from 'react-router-dom'

export function LegalConsentNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs leading-5 text-gray-500 ${className}`}>
      扫码登录即代表你已阅读并同意
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
      <span className="block">仅在使用 AI 时，由第三方模型处理简历内容</span>
    </p>
  )
}
