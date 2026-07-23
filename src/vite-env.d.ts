/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  readonly VITE_APP_PUBLIC_URL?: string
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_OPERATOR_NAME?: string
  readonly VITE_AI_PROVIDER_NAME?: string
  readonly VITE_AI_PROVIDER_PRIVACY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
