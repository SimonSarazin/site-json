import React from "react";

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children?: React.ReactNode;
  /** Contexte pour identifier la source de l'erreur (ex: section type/id) */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const ctx = this.props.context ? `[${this.props.context}]` : "";
    console.error(
      `ErrorBoundary${ctx} caught an error:`,
      "\n  Message:", error.message,
      "\n  Stack:", error.stack,
      "\n  Component Stack:", errorInfo.componentStack
    );
  }

  render() {
    if (this.state.hasError) {
      // En dev, afficher plus d'infos
      if (process.env.NODE_ENV === "development" && this.state.error) {
        return (
          <section className="py-8 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg m-4">
            <div className="container mx-auto px-4">
              <p className="text-red-600 dark:text-red-400 font-semibold">
                ⚠️ Error in {this.props.context || "component"}
              </p>
              <pre className="mt-2 text-sm text-red-500 dark:text-red-300 whitespace-pre-wrap overflow-auto max-h-48">
                {this.state.error.message}
              </pre>
            </div>
          </section>
        );
      }
      return this.props.fallback;
    }
    return this.props.children;
  }
}