import { useEffect, useState } from 'react'
import { publicApi } from '../api/public'
import { AI_PROVIDER_NAME, AI_PROVIDER_PRIVACY_URL } from '../config/legalDisclosure'

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

export interface AiProviderDisclosure {
  name: string
  privacyUrl: string
}

/**
 * 用户端第三方 AI 处理披露：优先读服务端当前生效的服务商配置，
 * 服务端不可用或未提供时回退到构建时注入的常量。
 */
export function useAiProviderDisclosure(): AiProviderDisclosure {
  const [disclosure, setDisclosure] = useState<AiProviderDisclosure>({
    name: AI_PROVIDER_NAME,
    privacyUrl: AI_PROVIDER_PRIVACY_URL,
  })

  useEffect(() => {
    let cancelled = false
    void publicApi.aiDisclosure()
      .then((response) => {
        if (cancelled) return
        const data = response.data.data
        if (!data) return
        const name = typeof data.aiProviderName === 'string' ? data.aiProviderName.trim() : ''
        const privacyUrl = typeof data.aiProviderPrivacyUrl === 'string'
          ? data.aiProviderPrivacyUrl.trim()
          : ''
        if (name) {
          setDisclosure({
            name,
            privacyUrl: isHttpsUrl(privacyUrl) ? privacyUrl : AI_PROVIDER_PRIVACY_URL,
          })
        }
      })
      .catch(() => {
        // 服务端不可用时保持构建时常量。
      })
    return () => {
      cancelled = true
    }
  }, [])

  return disclosure
}
