import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { CategoryIcon } from '@/shared/ui/category-icon';
import { CATEGORY_ICON_GROUPS } from '@/shared/lib/category-icons';
import { cn } from '@/shared/lib/cn';

interface IconPickerProps {
  value?: string | null;
  onChange: (name: string | null) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORY_ICON_GROUPS;
    return CATEGORY_ICON_GROUPS
      .map((group) => ({
        ...group,
        icons: group.icons.filter((i) => i.name.toLowerCase().includes(q)),
      }))
      .filter((group) => group.icons.length > 0);
  }, [query]);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-3 h-12"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
            <CategoryIcon name={value} size={18} />
          </div>
          <span className="flex-1 text-left text-sm">
            {value ? value : 'Seleccionar icono'}
          </span>
          {value && (
            <span
              role="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              aria-label="Quitar icono"
            >
              <X className="h-4 w-4" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar icono..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-3 space-y-4">
          {filteredGroups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin resultados para "{query}"
            </p>
          )}

          {filteredGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {group.icons.map(({ name, component: Icon }) => {
                  const isSelected = name === value;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelect(name)}
                      title={name}
                      className={cn(
                        'aspect-square flex items-center justify-center rounded-md border transition-colors',
                        isSelected
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'border-transparent hover:bg-muted text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
