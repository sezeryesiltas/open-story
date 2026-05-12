'use client';

import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@open-story/ui/components/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-story/ui/components/select';
import { cn } from '@open-story/ui/lib/utils';
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';

export const ADMIN_TABLE_PAGE_SIZE = 10;

export function AdminFilterSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <Select disabled={disabled} onValueChange={onChange} value={value}>
        <SelectTrigger className="h-10 rounded-lg border-border/70 bg-background/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function AdminTablePanel({
  title = 'Filtreler',
  filters,
  children,
  visibleCount,
  currentPage,
  pageCount,
  pageSize = ADMIN_TABLE_PAGE_SIZE,
  hasActiveFilters,
  onResetFilters,
  onPageChange,
  toolbarContent,
  filterGridClassName,
}: {
  title?: string;
  filters: ReactNode;
  children: ReactNode;
  visibleCount: number;
  currentPage: number;
  pageCount: number;
  pageSize?: number;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  toolbarContent?: ReactNode;
  filterGridClassName?: string;
}) {
  const normalizedPageCount = Math.max(1, pageCount);
  const normalizedPage = Math.min(Math.max(currentPage, 1), normalizedPageCount);

  return (
    <Card className="overflow-hidden rounded-lg border-border/60 bg-card/80 shadow-2xl">
      <CardHeader className="gap-5 space-y-0 border-b border-border/60 bg-muted/20 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ListFilter aria-hidden className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters ? (
              <Button onClick={onResetFilters} size="sm" variant="outline">
                Filtreleri temizle
              </Button>
            ) : null}
            <Badge variant="secondary">{visibleCount} görünür satır</Badge>
            {toolbarContent}
          </div>
        </div>

        <div className={cn('grid gap-4 sm:grid-cols-2', filterGridClassName)}>{filters}</div>
      </CardHeader>

      <CardContent className="p-0">{children}</CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 border-t border-border/60 bg-muted/20 p-4 pt-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{visibleCount} görünür satır</span>
          <span className="rounded-md border border-border/60 bg-background/50 px-2.5 py-1">
            Sayfa boyutu:{' '}
            <span className="font-semibold text-foreground">{pageSize}</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">
            Sayfa <span className="text-primary">{normalizedPage}</span> / {normalizedPageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Önceki sayfa"
              disabled={normalizedPage <= 1}
              onClick={() => onPageChange(normalizedPage - 1)}
              size="icon"
              variant="outline"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              aria-label="Sonraki sayfa"
              disabled={normalizedPage >= normalizedPageCount}
              onClick={() => onPageChange(normalizedPage + 1)}
              size="icon"
              variant="outline"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
