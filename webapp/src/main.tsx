import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import display from '@fontsource-variable/red-hat-display/files/red-hat-display-latin-wght-normal.woff2';
import text from '@fontsource-variable/red-hat-text/files/red-hat-text-latin-wght-normal.woff2';
import mono from '@fontsource-variable/red-hat-mono/files/red-hat-mono-latin-wght-normal.woff2';
import './styles.css';
import { App } from './App';

const fonts = document.createElement('style');
fonts.textContent = `
@font-face{font-family:'Red Hat Display Variable';font-style:normal;font-display:swap;font-weight:300 900;src:url(${display}) format('woff2')}
@font-face{font-family:'Red Hat Text Variable';font-style:normal;font-display:swap;font-weight:300 700;src:url(${text}) format('woff2')}
@font-face{font-family:'Red Hat Mono Variable';font-style:normal;font-display:swap;font-weight:300 700;src:url(${mono}) format('woff2')}`;
document.head.appendChild(fonts);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
