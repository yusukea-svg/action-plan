/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' で相対パス出力にし、GitHub Pages のサブパス(/リポジトリ名/)でもそのまま動くようにする
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
