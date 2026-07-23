import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_URL = 'https://resume.paicoding.com'
const DEFAULT_TITLE = '派简历 - 在线简历制作、AI 优化与 PDF 导出'
const DEFAULT_DESCRIPTION = '派简历提供在线简历编辑、实时预览、AI 辅助优化与 PDF 导出，帮助求职者高效制作专业中文简历。'

interface RouteSeoConfig {
  title: string
  description: string
  indexable: boolean
}

const EXACT_ROUTES: Record<string, RouteSeoConfig> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    indexable: true,
  },
  '/excellent-resumes': {
    title: '优秀简历案例 - 派简历',
    description: '查看派简历精选的优秀中文简历案例，参考真实的内容组织、项目表达与排版方式。',
    indexable: true,
  },
  '/privacy': {
    title: '隐私政策 - 派简历',
    description: '了解派简历如何收集、使用、保存和保护账号、简历、AI 辅助与支付相关信息。',
    indexable: true,
  },
  '/terms': {
    title: '服务条款 - 派简历',
    description: '查看派简历账号、内容、人工智能辅助、付费服务和使用规范。',
    indexable: true,
  },
  '/refund-policy': {
    title: '退款规则 - 派简历',
    description: '查看派简历数字化会员与服务的退款适用情形、申请材料、核验方式和到账说明。',
    indexable: true,
  },
  '/customer-service': {
    title: '客服说明 - 派简历',
    description: '查看派简历产品反馈、账号问题、订单核验和退款咨询的正确联系渠道与隐私提示。',
    indexable: true,
  },
  '/login': {
    title: '登录 - 派简历',
    description: '登录派简历，继续编辑和管理你的简历。',
    indexable: false,
  },
  '/register': {
    title: '注册 - 派简历',
    description: '注册派简历账号，开始在线制作和优化简历。',
    indexable: false,
  },
  '/forgot-password': {
    title: '找回密码 - 派简历',
    description: '通过注册邮箱重置派简历账号密码。',
    indexable: false,
  },
  '/legal-consent': {
    title: '协议确认 - 派简历',
    description: '确认派简历当前版本的服务条款、隐私政策与人工智能辅助处理说明。',
    indexable: false,
  },
  '/settings/account': {
    title: '账号与数据 - 派简历',
    description: '管理派简历账号、隐私资料与账号注销。',
    indexable: false,
  },
  '/vip/claim': {
    title: '领取知识星球 VIP - 派简历',
    description: '使用知识星球邀请码和派聪明服务号扫码，领取派简历 VIP 会员权益。',
    indexable: false,
  },
}

function getRouteSeo(pathname: string): RouteSeoConfig {
  const exactConfig = EXACT_ROUTES[pathname]
  if (exactConfig) {
    return exactConfig
  }

  if (/^\/marketplace\/resumes\/[^/]+$/.test(pathname)) {
    return {
      title: '精选简历详情 - 派简历',
      description: '查看派简历平台上的精选简历内容、排版和求职表达方式。',
      indexable: true,
    }
  }

  return {
    title: '个人工作台 - 派简历',
    description: DEFAULT_DESCRIPTION,
    indexable: false,
  }
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

export function RouteSeo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/+$/, '')
    const config = getRouteSeo(normalizedPath)
    const canonicalUrl = new URL(normalizedPath, SITE_URL).toString()

    document.title = config.title
    document.documentElement.lang = 'zh-CN'

    setMeta('meta[name="description"]', 'name', 'description', config.description)
    setMeta('meta[name="robots"]', 'name', 'robots', config.indexable ? 'index, follow' : 'noindex, nofollow')
    setMeta('meta[property="og:title"]', 'property', 'og:title', config.title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', config.description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', config.title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', config.description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl
  }, [pathname])

  return null
}
