/// <reference types="vite/client" />

declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    readonly VITE_API_TOKEN?: string
    // Diğer environment variable'ları buraya ekleyebilirsiniz
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

