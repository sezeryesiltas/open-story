import { cn } from '@open-story/ui/lib/utils';
import { SquareStack } from 'lucide-react';

type StoryGroupLogoSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<
  StoryGroupLogoSize,
  {
    frame: string;
    fallbackIcon: string;
    badge: string;
  }
> = {
  sm: {
    frame: 'size-11',
    fallbackIcon: 'h-4 w-4',
    badge: 'min-h-5 min-w-5 text-[10px]',
  },
  md: {
    frame: 'size-12',
    fallbackIcon: 'h-5 w-5',
    badge: 'min-h-6 min-w-6 text-[11px]',
  },
  lg: {
    frame: 'size-16',
    fallbackIcon: 'h-6 w-6',
    badge: 'min-h-6 min-w-6 text-[11px]',
  },
};

export function StoryGroupLogo({
  alt,
  src,
  badgeLabel,
  bottomLabel,
  size = 'md',
  active = false,
  inactiveGradientRing = false,
}: {
  alt: string;
  src?: string | null;
  badgeLabel?: string | null;
  bottomLabel?: string | null;
  size?: StoryGroupLogoSize;
  active?: boolean;
  inactiveGradientRing?: boolean;
}) {
  const classes = sizeClasses[size];

  return (
    <div className={cn('relative flex shrink-0 items-center justify-center', classes.frame)}>
      <div
        className={cn(
          'flex size-full items-center justify-center rounded-full p-px shadow-sm transition-colors',
          active ? 'bg-border/60 ring-2 ring-primary/50' : '',
          !active && inactiveGradientRing ? 'bg-gradient-to-br from-orange-400 to-purple-500' : '',
          !active && !inactiveGradientRing ? 'bg-border/60' : '',
        )}
      >
        <div className="flex size-full items-center justify-center rounded-full bg-background/80 p-1">
          <div className="relative flex size-full items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/20">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={alt} className="h-full w-full object-cover" src={src} />
            ) : (
              <SquareStack className={cn(classes.fallbackIcon, 'text-muted-foreground')} />
            )}

            {bottomLabel ? (
              <div className="pointer-events-none absolute bottom-1 left-1/2 z-10 max-w-[calc(100%-8px)] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap rounded-[2px] bg-black p-0.5 text-center text-[8px] font-medium leading-none text-white">
                {bottomLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {badgeLabel ? (
        <div
          className={cn(
            'absolute -bottom-1 -right-1 z-20 inline-flex items-center justify-center rounded-full bg-transparent px-1.5 font-semibold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]',
            classes.badge,
          )}
        >
          {badgeLabel}
        </div>
      ) : null}
    </div>
  );
}
