import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dev server accepts only loopback hosts: DNS-rebinding a public hostname
  // to 127.0.0.1 must not reach the local gateway during development.
  // GitHub Actions renders deterministic UI evidence rather than using HMR;
  // disabling the dev-only websocket there keeps product CSP strict and avoids
  // injecting a connection that the renderer is intentionally forbidden to make.
  server: {
    host: '127.0.0.1',
    allowedHosts: ['localhost', '127.0.0.1'],
    hmr: process.env.CI ? false : undefined,
  }
})
