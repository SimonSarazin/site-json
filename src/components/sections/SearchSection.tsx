import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Search, Filter, X } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";

interface SearchSectionProps {
  id?: string;
  props: {
    placeholder: Record<string, string>;
    searchEndpoint: string;
    categories?: Array<{
      id: string;
      label: Record<string, string>;
    }>;
    filters?: Array<{
      id: string;
      label: Record<string, string>;
      type: 'checkbox' | 'radio' | 'range';
      options?: Array<{
        value: string;
        label: Record<string, string>;
      }>;
    }>;
  };
}

export function SearchSection({ id, props }: SearchSectionProps) {
  const { t } = useLocalization();
  const { placeholder, searchEndpoint, categories = [], filters = [] } = props;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        category: selectedCategory,
        ...activeFilters
      });
      
      const response = await fetch(`${searchEndpoint}?${params}`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilterChange = (filterId: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterId]: value
    }));
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSelectedCategory('');
  };

  const renderFilter = (filter: any) => {
    switch (filter.type) {
      case 'checkbox':
        return (
          <div className="space-y-2">
            {filter.options?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${filter.id}-${option.value}`}
                  checked={activeFilters[filter.id]?.includes(option.value) || false}
                  onCheckedChange={(checked) => {
                    const current = activeFilters[filter.id] || [];
                    if (checked) {
                      handleFilterChange(filter.id, [...current, option.value]);
                    } else {
                      handleFilterChange(filter.id, current.filter((v: string) => v !== option.value));
                    }
                  }}
                />
                <Label htmlFor={`${filter.id}-${option.value}`} className="text-sm">
                  {t(option.label)}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'radio':
        return (
          <RadioGroup
            value={activeFilters[filter.id] || ''}
            onValueChange={(value) => handleFilterChange(filter.id, value)}
          >
            {filter.options?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${filter.id}-${option.value}`} />
                <Label htmlFor={`${filter.id}-${option.value}`} className="text-sm">
                  {t(option.label)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'range':
        return (
          <div className="space-y-4">
            <Slider
              value={activeFilters[filter.id] || [0, 100]}
              onValueChange={(value) => handleFilterChange(filter.id, value)}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{activeFilters[filter.id]?.[0] || 0}</span>
              <span>{activeFilters[filter.id]?.[1] || 100}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t(placeholder)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Recherche...' : 'Rechercher'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtres
              </Button>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('')}
                >
                  Toutes les catégories
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    {t(category.label)}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            {showFilters && filters.length > 0 && (
              <div className="lg:col-span-1">
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Filtres</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Effacer
                    </Button>
                  </div>
                  
                  <div className="space-y-6">
                    {filters.map((filter) => (
                      <div key={filter.id}>
                        <Label className="text-sm font-medium mb-3 block">
                          {t(filter.label)}
                        </Label>
                        {renderFilter(filter)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            <div className={showFilters && filters.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}>
              {results.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {results.length} résultat(s) trouvé(s)
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.map((result, index) => (
                      <div key={index} className="bg-card rounded-lg border p-6">
                        <h4 className="font-semibold mb-2">{result.title}</h4>
                        <p className="text-muted-foreground text-sm mb-4">{result.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {result.tags?.map((tag: string, tagIndex: number) => (
                            <Badge key={tagIndex} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchQuery && !isSearching ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Aucun résultat trouvé</h3>
                  <p className="text-muted-foreground">
                    Essayez de modifier votre recherche ou vos filtres
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Commencez votre recherche</h3>
                  <p className="text-muted-foreground">
                    Saisissez un terme de recherche pour commencer
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}