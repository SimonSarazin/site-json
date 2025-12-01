import { MapPin, ExternalLink, ImageIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

interface EntityCardDetailedProps {

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
  lastItemRef?: (node: HTMLDivElement) => void;

  linkPrefix?: string;
}

export function EntityCardDetailed({
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
  maxTags = 5,
  moreTagsLabel = "more",
  metadata,
  isLastItem,
  lastItemRef,
  linkPrefix = "/profil/",
}: EntityCardDetailedProps) {
  const linkTo = slug ? `${linkPrefix}${slug}` : "#";
  const [imageError, setImageError] = useState(false);

  const showPlaceholder = !imageUrl || imageError;

  return (
    <div
      ref={isLastItem ? lastItemRef : undefined}
      className="bg-background p-4 sm:p-6 rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-32 md:w-40 h-24 sm:h-24 md:h-28 rounded-lg overflow-hidden bg-muted shrink-0">
          {showPlaceholder ? (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          )}
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-grow">
              {typeBadge && <div className="mb-2">{typeBadge}</div>}

              <h3 className="font-semibold text-foreground text-base sm:text-lg line-clamp-1">
                {name}
              </h3>

              {description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                {locality && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>
                      {locality}
                      {postalCode && `, ${postalCode}`}
                    </span>
                  </div>
                )}

                {(startDate || endDate) && formatDate && (
                  <div className="flex items-center gap-1">
                    {startDate && <span>{formatDate(startDate)}</span>}
                    {startDate && endDate && <span> - </span>}
                    {endDate && <span>{formatDate(endDate)}</span>}
                  </div>
                )}

                {metadata}
              </div>

              {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tags.slice(0, maxTags).map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                  {tags.length > maxTags && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-muted text-muted-foreground font-medium">
                      +{tags.length - maxTags} {moreTagsLabel}
                    </span>
                  )}
                </div>
              )}
            </div>

            {slug && (
              <Link
                to={linkTo}
                className="ml-2 shrink-0 p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
