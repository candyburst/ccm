import { defineConfig } from 'vitepress'

export default defineConfig({
  title:       'CCM',
  description: 'Multi-account Claude Code manager. Switches accounts automatically when credits run out and resumes the conversation exactly where it left off.',
  lang:        'en-US',
  base:        '/ccm/',
  cleanUrls:   true,

  head: [
    ['link', { rel: 'icon', href: '/ccm/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#00d4a0' }],

    // Open Graph
    ['meta', { property: 'og:type',        content: 'website' }],
    ['meta', { property: 'og:site_name',   content: 'CCM' }],
    ['meta', { property: 'og:title',       content: 'CCM — Claude Code Manager' }],
    ['meta', { property: 'og:description', content: 'Manage multiple Claude Code accounts. Auto-switch on credit limits. Resume conversations instantly.' }],
    ['meta', { property: 'og:image',       content: 'https://candyburst.github.io/ccm/social-preview.png' }],
    ['meta', { property: 'og:url',         content: 'https://candyburst.github.io/ccm/' }],

    // Twitter card
    ['meta', { name: 'twitter:card',        content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title',       content: 'CCM — Claude Code Manager' }],
    ['meta', { name: 'twitter:description', content: 'Manage multiple Claude Code accounts. Auto-switch on credit limits. Resume conversations instantly.' }],
    ['meta', { name: 'twitter:image',       content: 'https://candyburst.github.io/ccm/social-preview.png' }],

    // JSON-LD structured data
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'SoftwareApplication',
      name:       'CCM — Claude Code Manager',
      description: 'Manage multiple Claude Code accounts. Auto-switch on credit limits. Resume conversations exactly where you left off.',
      applicationCategory: 'DeveloperApplication',
      operatingSystem:     'macOS, Linux, Windows',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url:  'https://github.com/candyburst/ccm',
      downloadUrl: 'https://www.npmjs.com/package/ccm',
      softwareVersion: '1.0.0',
      author: { '@type': 'Organization', name: 'CCM Contributors' },
    })],
  ],

  themeConfig: {
    logo:      '/logo.svg',
    siteTitle: 'CCM',

    nav: [
      { text: 'Guide',     link: '/guide/getting-started' },
      { text: 'CLI',       link: '/cli/reference' },
      { text: 'API',       link: '/api/core' },
      { text: 'Changelog', link: '/changelog' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'How it works',    link: '/guide/how-it-works' },
            { text: 'Configuration',   link: '/guide/configuration' },
          ],
        },
        {
          text: 'Using CCM',
          items: [
            { text: 'TUI guide',       link: '/guide/tui' },
            { text: 'Electron app',    link: '/guide/electron' },
            { text: 'Smart resume',    link: '/guide/smart-resume' },
            { text: 'GitHub sync',     link: '/guide/github-sync' },
            { text: 'Watch mode',      link: '/guide/watch-mode' },
            { text: 'Hooks',           link: '/guide/hooks' },
            { text: 'Plugins',         link: '/guide/plugins' },
            { text: 'Web dashboard',   link: '/guide/web-dashboard' },
          ],
        },
        {
          text: 'Security',
          items: [
            { text: 'Security model',  link: '/guide/security' },
            { text: 'Export & import', link: '/guide/export-import' },
          ],
        },
        {
          text: 'Help',
          items: [
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            { text: 'FAQ',             link: '/guide/faq' },
          ],
        },
      ],
      '/cli/': [
        { text: 'CLI reference', items: [{ text: 'All commands', link: '/cli/reference' }] },
      ],
      '/api/': [
        { text: 'API reference', items: [{ text: '@ccm/core', link: '/api/core' }] },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/candyburst/ccm' }],

    footer: {
      message:   'Released under the MIT License.',
      copyright: 'Copyright © 2026 CCM Contributors',
    },

    editLink: {
      pattern: 'https://github.com/candyburst/ccm/edit/main/docs/:path',
      text:    'Edit this page on GitHub',
    },

    search: { provider: 'local' },
  },

  sitemap: { hostname: 'https://candyburst.github.io/ccm' },

  // Per-page meta overrides for SEO
  transformPageData(pageData) {
    const overrides = {
      'index':                  { title: 'CCM — Claude Code Manager', description: 'Run Claude Code across multiple accounts. Auto-switch on credit limits. Resume conversations instantly.' },
      'guide/getting-started':  { title: 'Get started with CCM in 5 minutes', description: 'Install CCM, add your first Claude Code account, and run with automatic account rotation.' },
      'guide/smart-resume':     { title: 'How CCM resumes Claude sessions across accounts', description: 'CCM copies your session JSONL to the new account and relaunches with --resume so Claude picks up exactly where it left off.' },
      'guide/security':         { title: 'CCM security model', description: 'AES-256-GCM encryption, process isolation, threat model, and responsible disclosure.' },
      'guide/troubleshooting':  { title: 'CCM troubleshooting guide', description: 'Fix the most common CCM issues: CLAUDE_CONFIG_DIR, session resume failures, Electron IPC errors, and more.' },
      'cli/reference':          { title: 'CCM CLI reference — all commands', description: 'Complete reference for every ccm command and flag.' },
    }
    const key = pageData.relativePath.replace(/\.md$/, '')
    if (overrides[key]) {
      pageData.title       = overrides[key].title
      pageData.description = overrides[key].description
    }
  },
})
