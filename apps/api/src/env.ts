function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`)
  return v
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  /** URL pública do app (o mesmo endereço serve o front e a /api). */
  APP_URL: required('APP_URL'),
  /** Origens extras aceitas no login (ex.: http://localhost:4173 do vite preview), separadas por vírgula. */
  EXTRA_TRUSTED_ORIGINS: (process.env.EXTRA_TRUSTED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  PORT: Number(process.env.PORT ?? 3001),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? './uploads',
  /** E-mail (recuperação de senha). Opcional: sem ele, o link vai para o log. */
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
  APPLE_CLIENT_SECRET: process.env.APPLE_CLIENT_SECRET,
}
