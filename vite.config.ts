import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: { // Adicionado para permitir acesso externo
    host: true, // Ouve em todos os endereços, incluindo IPs locais e públicos
    port: 3000, // Porta padrão
    strictPort: false, // Permite tentar outra porta se a 3000 estiver ocupada
    hmr: {
        protocol: 'wss',
        host: '3001-iix3kthuw6edmczjwv644-986a5781.manus.computer',
        clientPort: 443
    },
    allowedHosts: [
        '3001-iix3kthuw6edmczjwv644-986a5781.manus.computer'
    ]
  }
})

