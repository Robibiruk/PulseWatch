import React from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import { ThemeIcon } from '@docusaurus/ThemeIcon';

export function navbar() {
  return {
    title: 'PulseWatch',
    items: [
      { type: 'docSidebar', sidebarId: 'mainSidebar', position: 'left', label: 'Docs' },
      { to: '/blog', label: 'Changelog', position: 'left' },
      {
        component: 'ThemeToggle',
        position: 'right',
      },
      {
        href: 'https://github.com/Robibiruk/PulseWatch',
        label: 'GitHub',
        position: 'right',
      },
    ],
  };
}