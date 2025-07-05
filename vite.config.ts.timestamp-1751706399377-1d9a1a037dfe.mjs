// vite.config.ts
import path from "path";
import tailwindcss from "file:///home/project/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig(({ mode, isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  build: {
    rollupOptions: isSsrBuild ? {
      input: "src/entry-server.tsx",
      output: {
        format: "es"
      }
    } : void 0
  },
  ssr: {
    noExternal: ["@radix-ui/", "lucide-react"],
    external: ["express", "compression", "serve-static", "@communecter/cocolight-api-client"]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIlxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSwgaXNTc3JCdWlsZCB9KSA9PiAoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICB9LFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICB9LFxuICBkZWZpbmU6IHtcbiAgICAncHJvY2Vzcy5lbnYuTk9ERV9FTlYnOiBKU09OLnN0cmluZ2lmeShtb2RlKSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICByb2xsdXBPcHRpb25zOiBpc1NzckJ1aWxkID8ge1xuICAgICAgaW5wdXQ6ICdzcmMvZW50cnktc2VydmVyLnRzeCcsXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZm9ybWF0OiAnZXMnXG4gICAgICB9XG4gICAgfSA6IHVuZGVmaW5lZFxuICB9LFxuICBzc3I6IHtcbiAgICBub0V4dGVybmFsOiBbJ0ByYWRpeC11aS8nLCAnbHVjaWRlLXJlYWN0J10sXG4gICAgZXh0ZXJuYWw6IFsnZXhwcmVzcycsICdjb21wcmVzc2lvbicsICdzZXJ2ZS1zdGF0aWMnLCAnQGNvbW11bmVjdGVyL2NvY29saWdodC1hcGktY2xpZW50J11cbiAgfVxufSkpOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sT0FBTyxVQUFVO0FBQzFPLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sV0FBVztBQUNsQixTQUFTLG9CQUFvQjtBQUg3QixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLE1BQU0sV0FBVyxPQUFPO0FBQUEsRUFDckQsU0FBUyxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUM7QUFBQSxFQUNoQyxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTix3QkFBd0IsS0FBSyxVQUFVLElBQUk7QUFBQSxFQUM3QztBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZSxhQUFhO0FBQUEsTUFDMUIsT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGLElBQUk7QUFBQSxFQUNOO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxZQUFZLENBQUMsY0FBYyxjQUFjO0FBQUEsSUFDekMsVUFBVSxDQUFDLFdBQVcsZUFBZSxnQkFBZ0IsbUNBQW1DO0FBQUEsRUFDMUY7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
