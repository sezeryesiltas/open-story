'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-story/ui/components/select';
import { Skeleton } from '@open-story/ui/components/skeleton';
import type { SdkFeedGroup, SdkFeedStory } from '@open-story/contracts';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  MousePointerClick,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/page-header';
import { StoryGroupLogo } from '@/components/admin/story-group-logo';
import { apiRequest } from '@/lib/api';
import type {
  PreviewSetSummary,
  PreviewVisibilityReason,
  PreviewWorkspaceSnapshot,
} from '@/lib/server/preview-store';

const NO_SELECTION = '__none';

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
    return 'Tüm kullanıcılar';
  }

  const platformSummary =
    storyGroupSet.platformTargets.length > 0
      ? storyGroupSet.platformTargets
          .map((target) => `${target.platform.toUpperCase()} ${target.minAppVersion}+`)
          .join(' • ')
      : 'Platform kısıtı yok';
  const segmentSummary =
    storyGroupSet.userSegments.length > 0
      ? storyGroupSet.userSegments.join(', ')
      : 'Tüm kullanıcılar';

  return `${platformSummary} • ${segmentSummary}`;
}

function formatIssueReason(reason: PreviewVisibilityReason) {
  switch (reason) {
    case 'missing_group':
      return 'Bağlı grup bulunamadı.';
    case 'group_unpublished':
      return 'Bu grup henüz yayında değil.';
    case 'group_archived':
      return 'Bu grup arşivde olduğu için gösterilmiyor.';
    case 'missing_group_logo':
      return 'Grup logosu bulunamadı.';
    case 'empty_group':
      return 'Bu grup içinde gösterilebilecek story bulunmuyor.';
    case 'missing_story':
      return 'Bağlı story kaydı bulunamadı.';
    case 'story_unpublished':
      return 'Bu story henüz yayında değil.';
    case 'story_archived':
      return 'Bu story arşivde olduğu için gösterilmiyor.';
    case 'missing_media_asset':
      return 'Story medyası bulunamadı.';
    case 'missing_poster_asset':
      return 'Video için poster görseli eksik.';
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

function formatBadgeValue(group: SdkFeedGroup) {
  if (!group.badge) {
    return null;
  }

  if (group.badge.type === 'emoji') {
    return group.badge.value;
  }

  return 'SVG';
}

function StoryMedia({ story }: { story: SdkFeedStory }) {
  if (story.media_type === 'video') {
    return (
      <div className="relative aspect-[1/2] w-full overflow-hidden bg-black">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          poster={story.poster_asset?.url}
          src={story.asset.url}
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-[1/2] w-full overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={story.title} className="absolute inset-0 h-full w-full object-contain object-top" src={story.asset.url} />
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
  const issuePreview = (data?.issues ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="İçeriğin ekranda nasıl görüneceğini buradan kontrol edin."
        eyebrow="Preview"
        title="İçerik önizleme"
      />

      {previewQuery.isPending ? <PreviewLoadingState /> : null}

      {!previewQuery.isPending && previewQuery.isError ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Preview yüklenemedi</CardTitle>
            <CardDescription>Önizleme şu anda yüklenemiyor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => previewQuery.refetch()}>Tekrar dene</Button>
          </CardContent>
        </Card>
      ) : null}

      {!previewQuery.isPending && !previewQuery.isError && data && data.placements.length > 0 ? (
        <div className="flex flex-col gap-6">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Önizleme</CardTitle>
              <CardDescription>
                Placement ve Story Bar seçerek görünümü kontrol edin.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Placement</span>
                  <Select onValueChange={handlePlacementChange} value={selectedPlacementId ?? NO_SELECTION}>
                    <SelectTrigger>
                      <SelectValue placeholder="Placement seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {data.placements.map((placement) => (
                          <SelectItem key={placement.id} value={placement.id}>
                            {placement.name} ({placement.placementKey})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Story Bar</span>
                  <Select
                    disabled={data.candidateSets.length === 0}
                    onValueChange={handleSetChange}
                    value={selectedSetId ?? NO_SELECTION}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Story Bar seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {data.candidateSets.length === 0 ? (
                          <SelectItem disabled value={NO_SELECTION}>
                            Story Bar bulunamadı
                          </SelectItem>
                        ) : (
                          data.candidateSets.map((storyGroupSet) => (
                            <SelectItem key={storyGroupSet.id} value={storyGroupSet.id}>
                              {storyGroupSet.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {groups.length > 0 ? (
                <>
                  {activeGroup && activeStory ? (
                    <>
                      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-4">
                        <div className="overflow-x-auto px-1 pt-1 pb-2">
                          <div className="flex min-w-max gap-4 px-1">
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

                      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill
                            label="Görünür"
                            value={`${data.stats?.visibleGroupCount ?? 0} group / ${data.stats?.visibleStoryCount ?? 0} story`}
                          />
                          <StatusPill
                            label="Medya"
                            value={`${data.stats?.imageCount ?? 0} image / ${data.stats?.videoCount ?? 0} video`}
                          />
                          <StatusPill label="CTA" value={`${data.stats?.ctaCount ?? 0} story`} />
                        </div>

                        {selectedStoryGroupSet ? (
                          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                            <p className="text-sm leading-6 text-muted-foreground">
                              <span className="font-medium text-foreground">{selectedStoryGroupSet.name}</span>
                              {' • '}
                              {formatTargetingSummary(selectedStoryGroupSet)}
                            </p>
                          </div>
                        ) : null}

                        {data.warnings.length > 0 ? (
                          <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                            {data.warnings[0]}
                          </div>
                        ) : null}
                      </div>

                      <div className="mx-auto flex w-full max-w-[390px] flex-wrap items-center justify-center gap-2 text-center">
                        <Badge>Group {activeGroupIndex + 1}</Badge>
                        <Badge variant="secondary">
                          Story {activeStoryIndex + 1}/{activeGroup.stories.length}
                        </Badge>
                        <Badge variant="outline">{activeStory.media_type}</Badge>
                        {activeStory.cta ? <Badge>CTA var</Badge> : <Badge variant="outline">CTA yok</Badge>}
                      </div>

                      <div className="mx-auto flex w-full max-w-[390px] flex-wrap justify-center gap-3">
                        <Button disabled={!canGoBackward} onClick={goToPreviousStory} variant="outline">
                          <ArrowLeft />
                          Önceki
                        </Button>
                        <Button disabled={!canGoForward} onClick={goToNextStory}>
                          Sonraki
                          <ArrowRight />
                        </Button>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                        <div className="flex items-center gap-2">
                          <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">CTA bilgileri</span>
                        </div>
                        {activeStory.cta ? (
                          <div className="mt-4 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
                            <span>Label: {activeStory.cta.label}</span>
                            <span>Type: {activeStory.cta.type}</span>
                            <span className="break-all">Value: {activeStory.cta.value}</span>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            Bu story için CTA tanımlanmamış.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {activeGroup.stories.map((story, storyIndex) => (
                          <button
                            key={story.id}
                            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                              storyIndex === activeStoryIndex
                                ? 'border-primary bg-primary/10'
                                : 'border-border/60 bg-background/70 hover:bg-accent/60'
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
                    </>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-6 text-sm leading-6 text-muted-foreground">
                  Seçili Story Bar için gösterilebilecek içerik bulunmuyor.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Uyarılar</CardTitle>
              <CardDescription>Önizleme sırasında dikkat edilmesi gereken noktalar.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {issuePreview.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {issuePreview.map((issue) => (
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
                  <p>Seçili içerik için ek bir uyarı bulunmuyor.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!previewQuery.isPending && !previewQuery.isError && data && data.placements.length === 0 ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Önizleme için içerik ekleyin</CardTitle>
            <CardDescription>Önizlemeyi kullanmak için önce placement ve içerik oluşturun.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/placements">Placement oluştur</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/story-group-sets">Story Bar oluştur</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/story-groups">Story Group oluştur</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/stories">Story oluştur</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
