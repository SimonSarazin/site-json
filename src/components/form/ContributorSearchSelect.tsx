import { useMemo, useState, useCallback, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearchUsers } from '@/hooks/useSearchUsers';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityTypes } from '@communecter/cocolight-api-client';

export type CitizenOption = {
  id: string;
  name: string;
};

type ContributorSearchSelectProps = {
  values: string[];
  onChange: (citizenIds: string[]) => void;
  onSelectedOptionsChange?: (options: CitizenOption[]) => void;
  initialContributors?: CitizenOption[];
  entity?: EntityTypes | null;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ContributorSearchSelect({
  values,
  onChange,
  onSelectedOptionsChange,
  initialContributors = [],
  entity,
  disabled = false,
  placeholder = 'Rechercher un contributeur...',
  label = 'Contributeur',
  autoFocus = false,
}: ContributorSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cachedContributors, setCachedContributors] = useState<Record<string, CitizenOption>>({});
  const safeValues = useMemo(() => (Array.isArray(values) ? values : []), [values]);
  const debouncedSearch = useDebounce(searchQuery, 250);
  const normalizedQuery = debouncedSearch.trim();
  const shouldSearch = normalizedQuery.length >= 2 && !disabled;

  const { data: citizenResults = [], isFetching: isCitizensLoading } = useSearchUsers(
    normalizedQuery,
    shouldSearch,
    entity,
  );

  const citizenOptions = useMemo<CitizenOption[]>(() => {
    return ((citizenResults as unknown) as Array<Record<string, unknown>>)
      .map((citizen) => {
        const rawName =
          (typeof citizen.name === 'string' && citizen.name) ||
          (typeof citizen.username === 'string' && citizen.username) ||
          ((citizen._serverData as Record<string, unknown> | undefined)?.name as string | undefined) ||
          '';
        const rawId =
          (typeof citizen.id === 'string' && citizen.id) ||
          ((citizen._serverData as Record<string, unknown> | undefined)?.id as string | undefined) ||
          (((citizen._serverData as Record<string, unknown> | undefined)?._id as { _str?: string } | undefined)?._str as string | undefined) ||
          '';

        if (!rawId || !rawName) return null;
        return { id: rawId, name: rawName };
      })
      .filter((option): option is CitizenOption => option !== null);
  }, [citizenResults]);

  const initialContributorMap = useMemo(() => {
    return (Array.isArray(initialContributors) ? initialContributors : []).reduce<Record<string, CitizenOption>>((acc, option) => {
      if (!option?.id || !option?.name) return acc;
      acc[option.id] = { id: option.id, name: option.name };
      return acc;
    }, {});
  }, [initialContributors]);

  const searchContributorMap = useMemo(() => {
    return citizenOptions.reduce<Record<string, CitizenOption>>((acc, option) => {
      acc[option.id] = option;
      return acc;
    }, {});
  }, [citizenOptions]);

  const mergeContributorCache = useCallback((options: CitizenOption[]) => {
    if (!Array.isArray(options) || options.length === 0) return;
    setCachedContributors((prev) => {
      let changed = false;
      const next = { ...prev };
      options.forEach((option) => {
        if (!option?.id || !option?.name) return;
        const existing = next[option.id];
        if (!existing || existing.name !== option.name) {
          next[option.id] = { id: option.id, name: option.name };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    mergeContributorCache(initialContributors);
  }, [initialContributors, mergeContributorCache]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    mergeContributorCache(citizenOptions);
  }, [citizenOptions, mergeContributorCache]);

  const citizenCache = useMemo(
    () => ({ ...cachedContributors, ...initialContributorMap, ...searchContributorMap }),
    [cachedContributors, initialContributorMap, searchContributorMap]
  );

  const selectedContributors = useMemo(() => {
    if (safeValues.length === 0) return [];
    return safeValues.map((id) => citizenCache[id] || { id, name: id });
  }, [citizenCache, safeValues]);

  const emitSelectedOptions = useCallback(
    (nextValues: string[]) => {
      if (!onSelectedOptionsChange) return;
      const nextOptions = nextValues.map((id) => citizenCache[id] || { id, name: id });
      onSelectedOptionsChange(nextOptions);
    },
    [citizenCache, onSelectedOptionsChange]
  );

  const handleSelect = useCallback(
    (citizenId: string) => {
      const selectedOption = searchContributorMap[citizenId] || citizenCache[citizenId];
      if (selectedOption) {
        mergeContributorCache([selectedOption]);
      }
      const alreadySelected = safeValues.includes(citizenId);
      const nextValues = alreadySelected ? safeValues.filter((id) => id !== citizenId) : [...safeValues, citizenId];
      onChange(nextValues);
      emitSelectedOptions(nextValues);
      setSearchQuery('');
    },
    [citizenCache, emitSelectedOptions, mergeContributorCache, onChange, safeValues, searchContributorMap]
  );

  const handleClear = useCallback(
    (e: MouseEvent, citizenId: string) => {
      e.stopPropagation();
      const nextValues = safeValues.filter((id) => id !== citizenId);
      onChange(nextValues);
      emitSelectedOptions(nextValues);
    },
    [emitSelectedOptions, onChange, safeValues]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && citizenOptions.length > 0) {
        event.preventDefault();
        handleSelect(citizenOptions[0].id);
      }
    },
    [citizenOptions, handleSelect]
  );

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}

      {selectedContributors.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/40 px-2.5 py-2">
          {selectedContributors.map((contributor) => (
            <div key={contributor.id} className="flex items-center gap-2 rounded-full border bg-background px-2 py-1 text-xs">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-primary/20 text-primary">{initials(contributor.name)}</AvatarFallback>
              </Avatar>
              <span className="max-w-40 truncate font-medium">{contributor.name}</span>
              {!disabled && (
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => handleClear(e, contributor.id)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                onChange([]);
                emitSelectedOptions([]);
              }}
            >
              Tout retirer
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-8"
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>

      {searchQuery.trim().length > 0 && (
        <div className="rounded-md border bg-card">
          {isCitizensLoading ? (
            <div className="flex items-center justify-center py-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : searchQuery.trim().length < 2 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Tapez au moins 2 caracteres...</p>
          ) : citizenOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Aucun contributeur trouvé.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto py-1">
              {citizenOptions.map((citizen) => {
                const isActive = safeValues.includes(citizen.id);
                return (
                  <button
                    key={citizen.id}
                    type="button"
                    onClick={() => handleSelect(citizen.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors',
                      isActive && 'bg-primary/10 text-primary'
                    )}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {initials(citizen.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{citizen.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
