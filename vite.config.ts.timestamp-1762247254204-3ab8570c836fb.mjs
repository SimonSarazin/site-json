import path from "path";
import tailwindcss from "file:///home/fah/Bureau/co/site-json/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///home/fah/Bureau/co/site-json/node_modules/@vitejs/plugin-react/dist/index.js";
import { defineConfig } from "file:///home/fah/Bureau/co/site-json/node_modules/vite/dist/node/index.js";
import { visualizer } from "file:///home/fah/Bureau/co/site-json/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "/home/fah/Bureau/co/site-json";
var vite_config_default = defineConfig(({ mode, isSsrBuild }) => ({
  plugins: [
    react(),
    tailwindcss(),
    !isSsrBuild && visualizer({
      filename: "./dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ].filter(Boolean),
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
    } : {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@radix-ui/")) {
            return "ui-vendor";
          }
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "query-vendor";
          }
          if (id.includes("node_modules/lucide-react/")) {
            return "icons-vendor";
          }
          if (id.includes("node_modules/clsx") || id.includes("node_modules/tailwind-merge") || id.includes("node_modules/class-variance-authority") || id.includes("node_modules/date-fns")) {
            return "utils-vendor";
          }
          if (id.includes("node_modules/i18next") && !id.includes("node_modules/react-i18next")) {
            return "i18n-vendor";
          }
          if (id.includes("node_modules/react-hook-form") || id.includes("node_modules/zod") || id.includes("node_modules/@hookform")) {
            return "form-vendor";
          }
          if (id.includes("node_modules/leaflet") || id.includes("node_modules/leaflet.markercluster")) {
            return "maps-vendor";
          }
          if (id.includes("node_modules/markdown-it")) {
            return "markdown-vendor";
          }
          if (id.includes("node_modules/dompurify") || id.includes("node_modules/isomorphic-dompurify")) {
            return "sanitize-vendor";
          }
          if (id.includes("node_modules/@communecter/cocolight-api-client")) {
            return "api-vendor";
          }
        }
      }
    }
  },
  ssr: {
    noExternal: ["@radix-ui/", "lucide-react"],
    external: ["express", "compression", "serve-static", "@communecter/cocolight-api-client"]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9mYWgvQnVyZWF1L2NvL3NpdGUtanNvblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvZmFoL0J1cmVhdS9jby9zaXRlLWpzb24vdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvZmFoL0J1cmVhdS9jby9zaXRlLWpzb24vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIlxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gJ3JvbGx1cC1wbHVnaW4tdmlzdWFsaXplcic7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlLCBpc1NzckJ1aWxkIH0pID0+ICh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIHRhaWx3aW5kY3NzKCksXG4gICAgLy8gR2VuZXJhdGUgYnVuZGxlIGFuYWx5c2lzIHJlcG9ydFxuICAgICFpc1NzckJ1aWxkICYmIHZpc3VhbGl6ZXIoe1xuICAgICAgZmlsZW5hbWU6ICcuL2Rpc3Qvc3RhdHMuaHRtbCcsXG4gICAgICBvcGVuOiBmYWxzZSxcbiAgICAgIGd6aXBTaXplOiB0cnVlLFxuICAgICAgYnJvdGxpU2l6ZTogdHJ1ZSxcbiAgICB9KVxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGRlZmluZToge1xuICAgICdwcm9jZXNzLmVudi5OT0RFX0VOVic6IEpTT04uc3RyaW5naWZ5KG1vZGUpLFxuICB9LFxuICBidWlsZDoge1xuICAgIHJvbGx1cE9wdGlvbnM6IGlzU3NyQnVpbGQgPyB7XG4gICAgICBpbnB1dDogJ3NyYy9lbnRyeS1zZXJ2ZXIudHN4JyxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBmb3JtYXQ6ICdlcydcbiAgICAgIH1cbiAgICB9IDoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgLy8gUmVhY3QgY29yZSBsaWJyYXJpZXNcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9yZWFjdC8nKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LWRvbS8nKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LXJvdXRlcicpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3JlYWN0LXZlbmRvcic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gUmFkaXggVUkgY29tcG9uZW50c1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL0ByYWRpeC11aS8nKSkge1xuICAgICAgICAgICAgcmV0dXJuICd1aS12ZW5kb3InO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRhblN0YWNrIFF1ZXJ5XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5JykpIHtcbiAgICAgICAgICAgIHJldHVybiAncXVlcnktdmVuZG9yJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBMdWNpZGUgUmVhY3QgaWNvbnMgLSBzZXBhcmF0ZSBjaHVuayBmb3IgaWNvbnNcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9sdWNpZGUtcmVhY3QvJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnaWNvbnMtdmVuZG9yJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBVdGlsaXR5IGxpYnJhcmllc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL2Nsc3gnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3RhaWx3aW5kLW1lcmdlJykgfHxcbiAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9jbGFzcy12YXJpYW5jZS1hdXRob3JpdHknKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL2RhdGUtZm5zJykpIHtcbiAgICAgICAgICAgIHJldHVybiAndXRpbHMtdmVuZG9yJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBpMThuIGxpYnJhcmllcyAtIHJlYWN0LWkxOG5leHQgZGVwZW5kcyBvbiBSZWFjdCBjb250ZXh0LCBrZWVwIGluIG1haW4gYnVuZGxlXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvaTE4bmV4dCcpICYmXG4gICAgICAgICAgICAgICFpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LWkxOG5leHQnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdpMThuLXZlbmRvcic7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHJlYWN0LWkxOG5leHQgc3RheXMgaW4gbWFpbiBidW5kbGUgdG8gYXZvaWQgaW5pdGlhbGl6YXRpb24gaXNzdWVzXG5cbiAgICAgICAgICAvLyBGb3JtIGxpYnJhcmllc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LWhvb2stZm9ybScpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvem9kJykgfHxcbiAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9AaG9va2Zvcm0nKSkge1xuICAgICAgICAgICAgcmV0dXJuICdmb3JtLXZlbmRvcic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gUmVjaGFydHMgaGFzIGNpcmN1bGFyIGRlcGVuZGVuY2llcyAtIGtlZXAgaW4gbWFpbiBidW5kbGUgb3Igd2l0aCByZWFjdFxuICAgICAgICAgIC8vIERvIG5vdCBzZXBhcmF0ZSByZWNoYXJ0cyB0byBhdm9pZCBpbml0aWFsaXphdGlvbiBpc3N1ZXNcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL2xlYWZsZXQnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL2xlYWZsZXQubWFya2VyY2x1c3RlcicpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ21hcHMtdmVuZG9yJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ21hcmtkb3duLXZlbmRvcic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvZG9tcHVyaWZ5JykgfHxcbiAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9pc29tb3JwaGljLWRvbXB1cmlmeScpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3Nhbml0aXplLXZlbmRvcic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tbXVuZWN0ZXIgQVBJIGNsaWVudFxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL0Bjb21tdW5lY3Rlci9jb2NvbGlnaHQtYXBpLWNsaWVudCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2FwaS12ZW5kb3InO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgc3NyOiB7XG4gICAgbm9FeHRlcm5hbDogWydAcmFkaXgtdWkvJywgJ2x1Y2lkZS1yZWFjdCddLFxuICAgIGV4dGVybmFsOiBbJ2V4cHJlc3MnLCAnY29tcHJlc3Npb24nLCAnc2VydmUtc3RhdGljJywgJ0Bjb21tdW5lY3Rlci9jb2NvbGlnaHQtYXBpLWNsaWVudCddXG4gIH1cbn0pKTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQXlRLE9BQU8sVUFBVTtBQUMxUixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLFdBQVc7QUFDbEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxrQkFBa0I7QUFKM0IsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxNQUFNLFdBQVcsT0FBTztBQUFBLEVBQ3JELFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQTtBQUFBLElBRVosQ0FBQyxjQUFjLFdBQVc7QUFBQSxNQUN4QixVQUFVO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsSUFDZCxDQUFDO0FBQUEsRUFDSCxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2hCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsRUFDMUI7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLHdCQUF3QixLQUFLLFVBQVUsSUFBSTtBQUFBLEVBQzdDO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlLGFBQWE7QUFBQSxNQUMxQixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0YsSUFBSTtBQUFBLE1BQ0YsUUFBUTtBQUFBLFFBQ04sY0FBYyxDQUFDLE9BQU87QUFFcEIsY0FBSSxHQUFHLFNBQVMscUJBQXFCLEtBQ2pDLEdBQUcsU0FBUyx5QkFBeUIsS0FDckMsR0FBRyxTQUFTLDJCQUEyQixHQUFHO0FBQzVDLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQzFDLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLG9DQUFvQyxHQUFHO0FBQ3JELG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLDRCQUE0QixHQUFHO0FBQzdDLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLG1CQUFtQixLQUMvQixHQUFHLFNBQVMsNkJBQTZCLEtBQ3pDLEdBQUcsU0FBUyx1Q0FBdUMsS0FDbkQsR0FBRyxTQUFTLHVCQUF1QixHQUFHO0FBQ3hDLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLHNCQUFzQixLQUNsQyxDQUFDLEdBQUcsU0FBUyw0QkFBNEIsR0FBRztBQUM5QyxtQkFBTztBQUFBLFVBQ1Q7QUFJQSxjQUFJLEdBQUcsU0FBUyw4QkFBOEIsS0FDMUMsR0FBRyxTQUFTLGtCQUFrQixLQUM5QixHQUFHLFNBQVMsd0JBQXdCLEdBQUc7QUFDekMsbUJBQU87QUFBQSxVQUNUO0FBS0EsY0FBSSxHQUFHLFNBQVMsc0JBQXNCLEtBQ2xDLEdBQUcsU0FBUyxvQ0FBb0MsR0FBRztBQUNyRCxtQkFBTztBQUFBLFVBQ1Q7QUFFQSxjQUFJLEdBQUcsU0FBUywwQkFBMEIsR0FBRztBQUMzQyxtQkFBTztBQUFBLFVBQ1Q7QUFFQSxjQUFJLEdBQUcsU0FBUyx3QkFBd0IsS0FDcEMsR0FBRyxTQUFTLG1DQUFtQyxHQUFHO0FBQ3BELG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLGdEQUFnRCxHQUFHO0FBQ2pFLG1CQUFPO0FBQUEsVUFDVDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFlBQVksQ0FBQyxjQUFjLGNBQWM7QUFBQSxJQUN6QyxVQUFVLENBQUMsV0FBVyxlQUFlLGdCQUFnQixtQ0FBbUM7QUFBQSxFQUMxRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
