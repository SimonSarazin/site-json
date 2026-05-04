import { Inbox } from 'lucide-react';

type SectionEmptyStateProps = {
  message: string;
  className?: string;
};

export default function SectionEmptyState({ message, className = '' }: SectionEmptyStateProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-sm text-muted-foreground ${className}`}
      role="status"
      aria-live="polite"
    >
      <Inbox className="h-4 w-4 text-primary" />
      <span className="italic">{message}</span>
    </div>
  );
}

