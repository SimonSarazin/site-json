import { useEffect, useState } from "react";
import { useIsMounted } from "@/hooks/useIsMounted";

// Define a more specific type for the loader function and its return value
export function useClientModule<T>(loader: () => Promise<T>): [boolean, T | null] {
  const mounted = useIsMounted();
  const [mod, setMod] = useState<T | null>(null);

  useEffect(() => {
    if (!mounted) return;
    loader().then(setMod);
  }, [loader, mounted]);

  return [mounted, mod];
}
