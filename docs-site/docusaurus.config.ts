import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'PulseWatch',
  tagline: 'Free, open-source uptime monitoring with status pages, alerts, and incident tracking.',
  favicon: 'img/pulsewatch.svg',

  future: {
    v4: true,
  },

  url: 'https://pulsewatch.dev',
  baseUrl: '/',

  organizationName: 'Robibiruk',
  projectName: 'PulseWatch',
  onBrokenLinks: 'throw',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: {
          showReadingTime: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        language: ["en"],
      },
    ],
  ],

  themeConfig: {
    image: 'img/pulsewatch.png',
    colorMode: {
      respectPrefersColorScheme: true,
      defaultMode: 'light',
    },
    navbar: {
      title: 'PulseWatch',
      logo: {
        alt: 'PulseWatch Logo',
        src: 'img/pulsewatch.png',
      },
      items: [
        { type: 'docSidebar', sidebarId: 'mainSidebar', position: 'left', label: 'Docs' },
        { to: '/blog', label: 'Changelog', position: 'left' },
        {
          href: 'https://github.com/Robibiruk/PulseWatch',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/docs/getting-started' },
            { label: 'API Reference', to: '/docs/api-reference' },
            { label: 'Status Pages', to: '/docs/status-pages' },
            { label: 'Changelog', to: '/docs/changelog' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/Robibiruk/PulseWatch' },
            { label: 'Report an Issue', href: 'https://github.com/Robibiruk/PulseWatch/issues' },
            { label: 'Discussions', href: 'https://github.com/Robibiruk/PulseWatch/discussions' },
          ],
        },
        {
          title: 'Resources',
          items: [
            { label: 'Documentation', to: '/docs/getting-started' },
            { label: 'Roadmap', to: '/docs/roadmap' },
            { label: 'Blog', to: '/blog' },
          ],
        },
        {
          title: 'Legal',
          items: [
            { label: 'Privacy Policy', to: '/docs/privacy' },
            { label: 'Terms of Service', to: '/docs/terms' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} PulseWatch. Built with ❤️ by Robel Biruk.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;