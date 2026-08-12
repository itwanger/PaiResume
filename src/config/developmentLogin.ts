export interface DevelopmentLoginCredentials {
  email: string
  password: string
}

const DEFAULT_DEVELOPMENT_ACCOUNT: DevelopmentLoginCredentials = {
  email: 'test@example.com',
  password: 'Test123456',
}

const DEVELOPMENT_PASSWORD_BY_EMAIL: Readonly<Record<string, string>> = {
  'test@example.com': 'Test123456',
  'admin@example.com': 'Admin123456',
}

export function getDevelopmentLoginCredentials(
  rememberedEmail: string,
): DevelopmentLoginCredentials {
  const email = rememberedEmail.trim() || DEFAULT_DEVELOPMENT_ACCOUNT.email

  return {
    email,
    password: DEVELOPMENT_PASSWORD_BY_EMAIL[email.toLowerCase()] ?? '',
  }
}
