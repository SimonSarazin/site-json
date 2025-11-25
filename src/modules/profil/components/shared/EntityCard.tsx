import { MapPin, ImageIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

interface EntityCardProps {
  name: string;
  description?: string;
  imageUrl?: string;
  slug?: string;

  locality?: string;
  postalCode?: string;

  startDate?: Date;
  endDate?: Date;
  formatDate?: (date: Date) => string;

  typeBadge?: ReactNode;

  tags?: string[];
  maxTags?: number;
  moreTagsLabel?: string;

  metadata?: ReactNode;

  isLastItem?: boolean;
  lastItemRef?: (node: HTMLAnchorElement) => void;

  linkPrefix?: string;
}

export function EntityCard({
  name,
  description,
  imageUrl,
  slug,
  locality,
  postalCode,
  startDate,
  endDate,
  formatDate,
  typeBadge,
  tags,
  maxTags = 2,
  moreTagsLabel = "more",
  metadata,
  isLastItem,
  lastItemRef,
  linkPrefix = "/profil/",
}: EntityCardProps) {
  const linkTo = slug ? `${linkPrefix}${slug}` : "#";
  const [imageError, setImageError] = useState(false);

  const showPlaceholder = !imageUrl || imageError;

  return (
    <Link
      ref={isLastItem ? lastItemRef : undefined}
      to={linkTo}
      className="group bg-background rounded-lg border border-border shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col h-full"
    >
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {showPlaceholder ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        {typeBadge && <div className="mb-2">{typeBadge}</div>}

        <h3 className="font-semibold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2 mb-2">
          {name}
        </h3>

        {locality && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <MapPin className="w-3 h-3" />
            <span className="truncate">
              {locality}
              {postalCode && `, ${postalCode}`}
            </span>
          </div>
        )}

        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-grow">
            {description}
          </p>
        )}

        {(startDate || endDate) && formatDate && (
          <div className="text-xs text-muted-foreground mb-3">
            {startDate && <span>{formatDate(startDate)}</span>}
            {startDate && endDate && <span> - </span>}
            {endDate && <span>{formatDate(endDate)}</span>}
          </div>
        )}

        {metadata && <div className="mb-3">{metadata}</div>}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-border">
            {tags.slice(0, maxTags).map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
              >
                {tag}
              </span>
            ))}
            {tags.length > maxTags && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                +{tags.length - maxTags} {moreTagsLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
