/// <reference types="vite/client" />

declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    // Diğer environment variable'ları buraya ekleyebilirsiniz
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

