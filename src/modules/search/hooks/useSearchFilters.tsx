import { createSearchParamsSync } from "@/hooks/createSearchParamsSync";


const useSearchFilters = createSearchParamsSync({
  q: { defaultValue: "", parse: v => v },
  tags: {
    defaultValue: {},
    parse: (v) => {
      try { return JSON.parse(v); } catch { return {}; }
    },
    serialize: (v) => JSON.stringify(v)
  },
  type: { defaultValue: null },
  map: {
    defaultValue: true,
    parse: v => v !== "false",
    serialize: v => (v === false ? "false" : undefined)
  }
});

export default useSearchFilters;