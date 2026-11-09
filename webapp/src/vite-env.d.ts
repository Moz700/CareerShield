/// <reference types="vite/client" />
declare const __OFFLINE__: boolean;
declare module '*.woff2' {
  const src: string;
  export default src;
}
declare module 'pdfjs-dist/build/pdf.worker.min.mjs';
