/// <reference types="vite/client" />

declare module 'qrcode' {
  export function toDataURL(text: string, options?: object): Promise<string>;
  export function toString(text: string, options?: object): Promise<string>;
}

declare module 'video-react/dist/video-react.css' {
  const content: string;
  export default content;
}

// Anna App Runtime SDK — served by the Anna host at runtime; not bundled.
// Type is inlined at the call site in main.tsx via Function() dynamic import.
