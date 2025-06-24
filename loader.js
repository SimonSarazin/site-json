import { pathToFileURL } from 'url';
import { resolve as resolvePath } from 'path';

export async function resolve(specifier, context, defaultResolve) {
  // Handle relative imports
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const resolved = resolvePath(context.parentURL ? new URL(context.parentURL).pathname : process.cwd(), specifier);
    return {
      url: pathToFileURL(resolved).href,
      shortCircuit: true
    };
  }
  
  // Use default resolution for everything else
  return defaultResolve(specifier, context);
}