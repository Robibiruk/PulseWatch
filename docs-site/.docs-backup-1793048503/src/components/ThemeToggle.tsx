import React from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import { ThemeIcon } from '@docusaurus/ThemeIcon';

export default function ThemeToggle() {
  const { colorMode } = useColorMode();

  return (
    <button
      className="theme-toggle button button--plain button--sm"
      onClick={() => colorMode.toggleColorMode()}
      aria-label="Toggle document theme">
      <ThemeIcon />
    </button>
  );
}