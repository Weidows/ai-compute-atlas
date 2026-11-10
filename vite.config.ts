import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * 站点挂在哪个路径由仓库身份决定，不靠手工 env：
 *   <owner>.github.io  用户站点 → `/`
 *   其他仓库           → `/<repo>/`（GitHub Pages 项目站点）
 * 将来又挂自定义域名（域根）时，用 `VITE_BASE=/` 覆盖即可。
 */
const [OWNER = '', REPO = ''] = (process.env.GITHUB_REPOSITORY ?? '').split('/')
const IS_USER_SITE = REPO.toLowerCase() === `${OWNER.toLowerCase()}.github.io`
const AUTO_BASE = REPO && !IS_USER_SITE ? `/${REPO}/` : '/'

/** SEO 的绝对地址只能是 origin + base，别再写死域名。 */
const SITE_URL = (process.env.SITE_URL ?? `https://${(OWNER || 'weidows').toLowerCase()}.github.io`).replace(/\/$/, '')
const BASE = process.env.VITE_BASE ?? AUTO_BASE
const SITE = `${SITE_URL}${BASE.replace(/\/$/, '')}`

/** index.html 里的 `__SITE_URL__` / `__BASE__` 占位符在这里落地。 */
const siteTokens = (): Plugin => ({
  name: 'site-url-tokens',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE).replaceAll('__BASE__', BASE),
})

export default defineConfig({
  plugins: [react(), tailwindcss(), siteTokens()],
  base: BASE,
  build: { outDir: 'dist', target: 'es2022', cssMinify: 'lightningcss' },
})
