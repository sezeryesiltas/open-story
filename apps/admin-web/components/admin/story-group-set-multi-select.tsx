'use client';

import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@open-story/ui/components/dropdown-menu';
import { Input } from '@open-story/ui/components/input';
import { Check, ChevronDown, X } from 'lucide-react';
import { useMemo, useState } from 'react';

type StoryGroupSetOption = {
  id: string;
  name: string;
};

export function StoryGroupSetMultiSelect({
  options,
  value,
  onChange,
}: {
  options: StoryGroupSetOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [search, setSearch] = useState('');

  const selectedValues = useMemo(() => Array.from(new Set(value)), [value]);
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedValueSet.has(option.id)),
    [options, selectedValueSet],
  );

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('en');
    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) => option.name.toLocaleLowerCase('en').includes(normalizedSearch));
  }, [options, search]);

  const toggleValue = (optionId: string, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      onChange(Array.from(new Set([...selectedValues, optionId])));
      return;
    }

    onChange(selectedValues.filter((value) => value !== optionId));
  };

  return (
    <div className="space-y-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-full justify-between" type="button" variant="outline">
            <span className="truncate text-left">
              {selectedOptions.length > 0
                ? `${selectedOptions.length} Story Bars selected`
                : 'Select Story Bar'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[340px] p-0">
          <div className="p-2">
            <Input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Story Bar..."
              value={search}
            />
          </div>
          <DropdownMenuSeparator />
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No Story Bars match the search.</p>
            ) : (
              filteredOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  checked={selectedValueSet.has(option.id)}
                  key={option.id}
                  onCheckedChange={(checked) => toggleValue(option.id, checked)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {option.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <Badge className="flex items-center gap-1.5 pr-1" key={option.id} variant="secondary">
              <Check className="h-3 w-3" />
              <span>{option.name}</span>
              <button
                aria-label={`Remove ${option.name} Story Bar selection`}
                className="rounded-sm p-0.5 transition-colors hover:bg-foreground/10"
                onClick={() => onChange(selectedValues.filter((value) => value !== option.id))}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          Selected Story Bars become the list that references this group. Use `X` on a chip to remove items one by one.
        </p>
      )}
    </div>
  );
}
