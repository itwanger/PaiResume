import { Link } from 'react-router-dom'
import { GITHUB_REPOSITORY_URL, RESUME_EDITOR_ENTRY_PATH } from '../../config/site'
import { EXCELLENT_RESUMES_PATH } from '../../utils/navigation'
import { LogoMark } from '../branding/LogoMark'

const CURRENT_YEAR = new Date().getFullYear()

const footerLinkClassName = 'text-sm text-slate-400 transition-colors hover:text-white'

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-3" aria-label="派简历首页">
              <LogoMark className="h-10 w-10" />
              <span className="text-lg font-semibold text-white">派简历</span>
            </Link>
          </div>

          <nav aria-label="页脚产品导航">
            <h2 className="text-sm font-semibold text-white">产品</h2>
            <div className="mt-4 flex flex-col items-start gap-3">
              <Link to="/" className={footerLinkClassName}>首页</Link>
              <Link to={EXCELLENT_RESUMES_PATH} className={footerLinkClassName}>优质简历</Link>
              <Link to={RESUME_EDITOR_ENTRY_PATH} className={footerLinkClassName}>制作简历</Link>
            </div>
          </nav>

          <nav aria-label="页脚协议与支持导航">
            <h2 className="text-sm font-semibold text-white">协议与支持</h2>
            <div className="mt-4 flex flex-col items-start gap-3">
              <Link to="/privacy" className={footerLinkClassName}>隐私政策</Link>
              <Link to="/terms" className={footerLinkClassName}>服务条款</Link>
              <Link to="/refund-policy" className={footerLinkClassName}>退款规则</Link>
              <Link to="/customer-service" className={footerLinkClassName}>客服说明</Link>
            </div>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-white">开源</h2>
            <a
              href={GITHUB_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-primary-400 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.59 2 12.254c0 4.531 2.865 8.374 6.839 9.729.5.095.682-.222.682-.494 0-.244-.009-.888-.014-1.743-2.782.618-3.369-1.374-3.369-1.374-.455-1.184-1.11-1.499-1.11-1.499-.908-.636.069-.623.069-.623 1.003.073 1.531 1.057 1.531 1.057.892 1.567 2.341 1.115 2.91.852.091-.663.349-1.115.635-1.371-2.221-.259-4.555-1.14-4.555-5.071 0-1.12.39-2.036 1.029-2.754-.103-.26-.446-1.303.098-2.716 0 0 .84-.275 2.75 1.052A9.326 9.326 0 0 1 12 7.973a9.32 9.32 0 0 1 2.504.346c1.909-1.327 2.748-1.052 2.748-1.052.546 1.413.203 2.456.1 2.716.64.718 1.028 1.634 1.028 2.754 0 3.941-2.338 4.809-4.566 5.062.359.317.679.944.679 1.902 0 1.373-.013 2.481-.013 2.818 0 .274.18.594.688.493C19.138 20.624 22 16.784 22 12.254 22 6.59 17.523 2 12 2Z" clipRule="evenodd" />
              </svg>
              GitHub 源码
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {CURRENT_YEAR} 派简历</span>
          <span>请勿在公开 Issue 中提交简历、邮箱或订单信息</span>
        </div>
      </div>
    </footer>
  )
}
