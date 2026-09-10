import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dev server accepts only loopback hosts: DNS-rebinding a public hostname
  // to 127.0.0.1 must not reach the local gateway during development.
  server: { host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1'] }
})
