import { useEffect, useState } from "react";

// Define a more specific type for the loader function and its return value
export function useClientModule<T>(loader: () => Promise<T>): [boolean, T | null] {
  const [mounted, setMounted] = useState<boolean>(false);
  const [mod, setMod] = useState<T | null>(null);

  useEffect(() => {
    setMounted(true);
    loader().then(setMod);
  }, [loader]);

  return [mounted, mod];
}
