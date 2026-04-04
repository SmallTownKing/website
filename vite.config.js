// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000, // 指定本地开发端口
    open: true, // 启动时自动在浏览器打开网页
    proxy: {
      // 当你前端代码请求 /api 时，Vite 会拦截并转发给真正的后端
      '/api': {
        target: 'http://120.24.175.14:10085', // 真实的后端跨域接口地址
        changeOrigin: true, // 必须开启，修改请求头中的 Host 为目标地址
        // 如果后端接口本身没有 /api 这个前缀，可以在这里重写去掉
        // rewrite: (path) => path.replace(/^\/api/, '') 
      }
    }
  }
});