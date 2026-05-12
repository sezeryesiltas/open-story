'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Skeleton } from '@open-story/ui/components/skeleton';
import type { SdkFeedGroup, SdkFeedStory } from '@open-story/contracts';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ListFilter,
  MousePointerClick,
  X,
} from 'lucide-react';

import { AdminFilterSelect } from '@/components/admin/admin-table-panel';
import { PageHeader } from '@/components/admin/page-header';
import { StoryGroupLogo } from '@/components/admin/story-group-logo';
import { apiRequest } from '@/lib/api';
import type {
  PreviewSetSummary,
  PreviewVisibilityReason,
  PreviewWorkspaceSnapshot,
} from '@/lib/server/preview-store';

const NO_SELECTION = '__none';
const DEFAULT_STORY_ASPECT_RATIO = '9 / 16';

function buildPreviewQueryPath(placementId: string | null, setId: string | null) {
  const searchParams = new URLSearchParams();

  if (placementId) {
    searchParams.set('placementId', placementId);
  }

  if (setId) {
    searchParams.set('setId', setId);
  }

  const queryString = searchParams.toString();
  return queryString ? `/api/preview?${queryString}` : '/api/preview';
}

function formatTargetingSummary(storyGroupSet: PreviewSetSummary) {
  if (storyGroupSet.isFallback) {
    return 'Yedek Story Bar';
  }

  if (storyGroupSet.platformTargets.length === 0 && storyGroupSet.userSegments.length === 0) {
    return 'All users';
  }

  const platformSummary =
    storyGroupSet.platformTargets.length > 0
      ? storyGroupSet.platformTargets
          .map((target) => `${target.platform.toUpperCase()} ${target.minAppVersion}+`)
          .join(' • ')
      : 'No platform constraint';
  const segmentSummary =
    storyGroupSet.userSegments.length > 0
      ? storyGroupSet.userSegments.join(', ')
      : 'All users';

  return `${platformSummary} • ${segmentSummary}`;
}

function formatIssueReason(reason: PreviewVisibilityReason) {
  switch (reason) {
    case 'missing_group':
      return 'Linked group was not found.';
    case 'group_unpublished':
      return 'This group is not published yet.';
    case 'group_archived':
      return 'This group is not shown because it is archived.';
    case 'missing_group_logo':
      return 'Group logo was not found.';
    case 'empty_group':
      return 'This group has no stories that can be shown.';
    case 'missing_story':
      return 'Linked story record was not found.';
    case 'story_unpublished':
      return 'This story is not published yet.';
    case 'story_archived':
      return 'This story is not shown because it is archived.';
    case 'missing_media_asset':
      return 'Story media was not found.';
    case 'missing_poster_asset':
      return 'Poster image is missing for the video.';
  }
}

function PreviewLoadingState() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="border-border/60 bg-card/80">
          <CardHeader className="flex flex-col gap-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-border/60 bg-background/70 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>{' '}
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PreviewWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Preview warnings</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
            {warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function formatBadgeValue(group: SdkFeedGroup) {
  if (!group.badge) {
    return null;
  }

  if (group.badge.type === 'emoji') {
    return group.badge.value;
  }

  return 'SVG';
}

function mediaAspectRatio(asset: SdkFeedStory['asset'] | undefined) {
  if (!asset?.width || !asset.height) {
    return DEFAULT_STORY_ASPECT_RATIO;
  }

  return `${asset.width} / ${asset.height}`;
}

function StoryMedia({ story }: { story: SdkFeedStory }) {
  if (story.media_type === 'video') {
    return (
      <div className="relative aspect-[1/2] w-full overflow-hidden bg-black">
        <video
          className="absolute left-1/2 top-1/2 block w-full max-w-none -translate-x-1/2 -translate-y-1/2"
          autoPlay
          loop
          muted
          playsInline
          poster={story.poster_asset?.url}
          src={story.asset.url}
          style={{ aspectRatio: mediaAspectRatio(story.asset) }}
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-[1/2] w-full overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={story.title}
        className="absolute left-1/2 top-1/2 block h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2"
        height={story.asset.height}
        src={story.asset.url}
        width={story.asset.width}
        style={{ aspectRatio: mediaAspectRatio(story.asset) }}
      />
    </div>
  );
}

function GroupAvatarButton({
  group,
  isActive,
  bottomLabel,
  onSelect,
}: {
  group: SdkFeedGroup;
  isActive: boolean;
  bottomLabel: string | null;
  onSelect: () => void;
}) {
  const badgeValue = formatBadgeValue(group);

  return (
    <button
      className="flex flex-col items-center gap-2 text-center"
      onClick={onSelect}
      type="button"
    >
      <StoryGroupLogo
        active={isActive}
        alt={group.title}
        badgeLabel={badgeValue}
        bottomLabel={bottomLabel}
        inactiveGradientRing
        size="lg"
        src={group.logo_url}
      />
      <span className={`max-w-[5.75rem] text-xs font-medium leading-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
        {group.title}
      </span>
    </button>
  );
}

function ViewerStage({
  group,
  story,
  activeStoryIndex,
  canGoBackward,
  canGoForward,
  onPrevious,
  onNext,
}: {
  group: SdkFeedGroup;
  story: SdkFeedStory;
  activeStoryIndex: number;
  canGoBackward: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const badgeValue = formatBadgeValue(group);

  return (
    <div className="relative mx-auto w-full max-w-[390px] overflow-hidden rounded-[2px] border border-border/60 bg-black shadow-[0_24px_80px_-28px_rgba(0,0,0,0.8)]">
      <StoryMedia story={story} />

      <button
        aria-label="Previous story"
        className="absolute inset-y-0 left-0 z-[1] w-1/2"
        disabled={!canGoBackward}
        onClick={onPrevious}
        type="button"
      />
      <button
        aria-label="Next story"
        className="absolute inset-y-0 right-0 z-[1] w-1/2"
        disabled={!canGoForward}
        onClick={onNext}
        type="button"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent via-black/35 to-black" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-4 p-4">
        <div className="flex items-center gap-1.5">
          {group.stories.map((groupStory, storyIndex) => (
            <div
              key={groupStory.id}
              className={`h-1 flex-1 rounded-full ${
                storyIndex === activeStoryIndex ? 'bg-white' : 'bg-white/35'
              }`}
            />
          ))}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <StoryGroupLogo alt={group.title} badgeLabel={badgeValue} size="sm" src={group.logo_url} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-white">{group.title}</span>
            </div>
          </div>

          <button
            aria-label="Close preview"
            className="pointer-events-auto inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-black/35 text-white transition-colors hover:bg-black/55"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

      </div>

      {story.cta ? (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-5 pb-6">
          <Button className="h-10 rounded-full bg-amber-400 px-8 text-base font-semibold text-black hover:bg-amber-300">
            {story.cta.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PreviewWorkspace() {
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [setId, setSetId] = useState<string | null>(null);
  const previewQuery = useQuery({
    queryKey: ['preview-workspace', placementId ?? 'default', setId ?? 'default'],
    queryFn: () => apiRequest<PreviewWorkspaceSnapshot>(buildPreviewQueryPath(placementId, setId)),
  });

  const data = previewQuery.data;
  const selectedPlacementId = placementId ?? data?.selectedPlacementId ?? null;
  const selectedSetId = setId ?? data?.selectedSetId ?? null;
  const resolvedSet = data?.feedResponse?.resolved_set ?? null;
  const groups = resolvedSet?.groups ?? [];
  const viewerKey = useMemo(() => {
    if (!resolvedSet) {
      return 'empty';
    }

    return resolvedSet.groups
      .map((group) => `${group.id}:${group.revision_id}:${group.stories.map((story) => `${story.id}:${story.revision_id}`).join(',')}`)
      .join('|');
  }, [resolvedSet]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  useEffect(() => {
    setActiveGroupIndex(0);
    setActiveStoryIndex(0);
  }, [viewerKey]);

  const activeGroup = groups[activeGroupIndex] ?? null;
  const activeStory = activeGroup?.stories[activeStoryIndex] ?? null;

  const handlePlacementChange = (nextPlacementId: string) => {
    setPlacementId(nextPlacementId === NO_SELECTION ? null : nextPlacementId);
    setSetId(null);
  };

  const handleSetChange = (nextSetId: string) => {
    setSetId(nextSetId === NO_SELECTION ? null : nextSetId);
  };

  const goToPreviousStory = () => {
    if (!activeGroup) {
      return;
    }

    if (activeStoryIndex > 0) {
      setActiveStoryIndex((currentValue) => currentValue - 1);
      return;
    }

    if (activeGroupIndex === 0) {
      return;
    }

    const previousGroup = groups[activeGroupIndex - 1];
    setActiveGroupIndex((currentValue) => currentValue - 1);
    setActiveStoryIndex(Math.max(previousGroup.stories.length - 1, 0));
  };

  const goToNextStory = () => {
    if (!activeGroup) {
      return;
    }

    if (activeStoryIndex < activeGroup.stories.length - 1) {
      setActiveStoryIndex((currentValue) => currentValue + 1);
      return;
    }

    if (activeGroupIndex >= groups.length - 1) {
      return;
    }

    setActiveGroupIndex((currentValue) => currentValue + 1);
    setActiveStoryIndex(0);
  };

  const canGoBackward = activeGroupIndex > 0 || activeStoryIndex > 0;
  const canGoForward =
    !!activeGroup &&
    (activeStoryIndex < activeGroup.stories.length - 1 || activeGroupIndex < groups.length - 1);
  const selectedStoryGroupSet =
    data?.candidateSets.find((storyGroupSet) => storyGroupSet.id === selectedSetId) ?? null;
  const visibilityIssues = (data?.issues ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Content Preview" />

      {previewQuery.isPending ? <PreviewLoadingState /> : null}

      {!previewQuery.isPending && previewQuery.isError ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Preview could not be loaded</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => previewQuery.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : null}

      {!previewQuery.isPending && !previewQuery.isError && data && data.placements.length > 0 ? (
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden rounded-lg border-border/60 bg-card/80 shadow-2xl">
            <CardHeader className="gap-5 space-y-0 border-b border-border/60 bg-muted/20 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <ListFilter aria-hidden className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Filtreler
                </CardTitle>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
                <AdminFilterSelect
                  label="Placement"
                  onChange={handlePlacementChange}
                  options={data.placements.map((placement) => ({
                    label: `${placement.name} (${placement.placementKey})`,
                    value: placement.id,
                  }))}
                  value={selectedPlacementId ?? NO_SELECTION}
                />

                <AdminFilterSelect
                  disabled={data.candidateSets.length === 0}
                  label="Story Bar"
                  onChange={handleSetChange}
                  options={
                    data.candidateSets.length === 0
                      ? [{ disabled: true, label: 'Story Bar was not found', value: NO_SELECTION }]
                      : data.candidateSets.map((storyGroupSet) => ({
                          label: storyGroupSet.name,
                          value: storyGroupSet.id,
                        }))
                  }
                  value={selectedSetId ?? NO_SELECTION}
                />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-5">
              {data ? <PreviewWarnings warnings={data.warnings} /> : null}

              {groups.length > 0 ? (
                <>
                  {activeGroup && activeStory ? (
                    <>
                      <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
                        <div className="order-2 flex flex-col gap-4 xl:order-1">
                          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                            <div className="flex flex-wrap gap-2">
                              <StatusPill
                                label="Visible"
                                value={`${data.stats?.visibleGroupCount ?? 0} group / ${data.stats?.visibleStoryCount ?? 0} story`}
                              />
                              <StatusPill
                                label="Medya"
                                value={`${data.stats?.imageCount ?? 0} image / ${data.stats?.videoCount ?? 0} video`}
                              />
                              <StatusPill label="CTA" value={`${data.stats?.ctaCount ?? 0} story`} />
                            </div>

                            {selectedStoryGroupSet ? (
                              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                <span className="font-medium text-foreground">{selectedStoryGroupSet.name}</span>
                                {' • '}
                                {formatTargetingSummary(selectedStoryGroupSet)}
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                            <div className="flex flex-wrap gap-2">
                              <Badge>Group {activeGroupIndex + 1}</Badge>
                              <Badge variant="secondary">
                                Story {activeStoryIndex + 1}/{activeGroup.stories.length}
                              </Badge>
                              <Badge variant="outline">{activeStory.media_type}</Badge>
                              {activeStory.cta ? <Badge>CTA var</Badge> : <Badge variant="outline">CTA yok</Badge>}
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <Button
                                className="justify-between"
                                disabled={!canGoBackward}
                                onClick={goToPreviousStory}
                                variant="outline"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <ArrowLeft className="h-4 w-4" data-icon />
                                  Previous
                                </span>
                              </Button>
                              <Button className="justify-between" disabled={!canGoForward} onClick={goToNextStory}>
                                <span className="inline-flex items-center gap-2">
                                  Sonraki
                                  <ArrowRight className="h-4 w-4" data-icon />
                                </span>
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                            <div className="flex items-center gap-2">
                              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">CTA bilgileri</span>
                            </div>
                            {activeStory.cta ? (
                              <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
                                <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                                  <span className="font-medium text-foreground">Label:</span> {activeStory.cta.label}
                                </div>
                                <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                                  <span className="font-medium text-foreground">Type:</span> {activeStory.cta.type}
                                </div>
                                <div className="rounded-lg border border-border/60 bg-background px-3 py-2 break-all">
                                  <span className="font-medium text-foreground">Value:</span> {activeStory.cta.value}
                                </div>
                              </div>
                            ) : (
                              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                No CTA is defined for this story.
                              </p>
                            )}
                          </div>

                          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">Story navigasyonu</span>
                              <Badge variant="secondary">{activeGroup.stories.length} story</Badge>
                            </div>
                            <div className="mt-4 flex flex-col gap-3">
                              {activeGroup.stories.map((story, storyIndex) => (
                                <button
                                  key={story.id}
                                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                    storyIndex === activeStoryIndex
                                      ? 'border-primary bg-primary/10'
                                      : 'border-border/60 bg-background hover:bg-accent/60'
                                  }`}
                                  onClick={() => setActiveStoryIndex(storyIndex)}
                                  type="button"
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">#{storyIndex + 1}</Badge>
                                    <span className="font-medium">{story.title}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge variant="secondary">{story.media_type}</Badge>
                                    {story.cta ? <Badge>CTA</Badge> : null}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="order-1 flex flex-col gap-4 xl:order-2 xl:items-center">
                          <div className="mx-auto w-full max-w-[390px] overflow-x-auto px-1 pt-1 pb-2">
                            <div className="flex min-w-full w-max justify-center gap-4 px-1">
                              {groups.map((group, groupIndex) => (
                                <GroupAvatarButton
                                  bottomLabel={data.groupMetaById[group.id]?.bottomLabel ?? null}
                                  group={group}
                                  key={group.id}
                                  onSelect={() => {
                                    setActiveGroupIndex(groupIndex);
                                    setActiveStoryIndex(0);
                                  }}
                                  isActive={groupIndex === activeGroupIndex}
                                />
                              ))}
                            </div>
                          </div>

                          <ViewerStage
                            activeStoryIndex={activeStoryIndex}
                            canGoBackward={canGoBackward}
                            canGoForward={canGoForward}
                            group={activeGroup}
                            onNext={goToNextStory}
                            onPrevious={goToPreviousStory}
                            story={activeStory}
                          />
                        </div>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-6 text-sm leading-6 text-muted-foreground">
                  No content can be shown for the selected Story Bar.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Visibility Issues</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {visibilityIssues.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {visibilityIssues.map((issue) => (
                    <div
                      key={`${issue.entity}-${issue.id}-${issue.reason}`}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-muted-foreground"
                    >
                      <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{issue.name}</span>
                        <p>{formatIssueReason(issue.reason)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <p>No additional visibility issues exist for the selected content.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!previewQuery.isPending && !previewQuery.isError && data && data.placements.length === 0 ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Add content for preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data ? <PreviewWarnings warnings={data.warnings} /> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
