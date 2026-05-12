/**
 * SDK feed resolver for StoryGroupSet selection and runtime child filtering.
 */

/**
 * @param {string} version
 * @returns {[number, number, number]}
 */
function normalizeVersion(version) {
  const [maj = '0', min = '0', patch = '0'] = String(version ?? '0').split('.');
  return [Number(maj) || 0, Number(min) || 0, Number(patch) || 0];
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareDottedVersion(a, b) {
  const av = normalizeVersion(a);
  const bv = normalizeVersion(b);

  for (let i = 0; i < 3; i += 1) {
    if (av[i] > bv[i]) return 1;
    if (av[i] < bv[i]) return -1;
  }

  return 0;
}

/**
 * Step 1: fetch published set candidates linked to the placement.
 * @param {Array<any>} sets
 * @param {string} placementKey
 */
function getPublishedPlacementCandidates(sets, placementKey) {
  return (sets ?? []).filter(
    (set) => set.placementKey === placementKey && !!set.publishedRevisionId,
  );
}

/**
 * @param {any} set
 * @param {{ platform: string, appVersion: string, userSegments?: string[] }} ctx
 */
function evaluateTargeting(set, ctx) {
  const platformTargets = set.platformTargets ?? [];
  const segments = set.segments ?? [];
  const userSegments = ctx.userSegments ?? [];

  let compatibleMinVersion = '0.0.0';
  let platformScopeSize = Number.POSITIVE_INFINITY;

  if (platformTargets.length > 0) {
    const uniquePlatforms = new Set(platformTargets.map((it) => it.platform));
    platformScopeSize = uniquePlatforms.size;

    const compatibleTargets = platformTargets.filter(
      (target) =>
        target.platform === ctx.platform &&
        compareDottedVersion(ctx.appVersion, target.minAppVersion) >= 0,
    );

    if (compatibleTargets.length === 0) {
      return { matches: false };
    }

    compatibleMinVersion = compatibleTargets
      .map((target) => target.minAppVersion)
      .sort(compareDottedVersion)
      .at(-1);
  }

  const requestHasSegments = userSegments.length > 0;
  const setHasSegments = segments.length > 0;

  if (!requestHasSegments && setHasSegments) {
    return { matches: false };
  }

  if (requestHasSegments && setHasSegments) {
    const overlaps = segments.some((segment) => userSegments.includes(segment));
    if (!overlaps) {
      return { matches: false };
    }
  }

  return {
    matches: true,
    compatibleMinVersion,
    platformScopeSize,
    segmentSpecific: setHasSegments,
    segmentScopeSize: segments.length,
  };
}

/**
 * Step 2 + 3: filter candidates and apply prioritization.
 * @param {Array<any>} candidates
 * @param {{ platform: string, appVersion: string, userSegments?: string[] }} ctx
 */
function pickBestMatchingSet(candidates, ctx) {
  const normalSets = (candidates ?? []).filter((set) => !set.isFallback);

  const evaluated = normalSets
    .map((set) => ({ set, evalResult: evaluateTargeting(set, ctx) }))
    .filter((item) => item.evalResult.matches);

  if (evaluated.length === 0) {
    return null;
  }

  evaluated.sort((a, b) => {
    if (a.evalResult.platformScopeSize !== b.evalResult.platformScopeSize) {
      return a.evalResult.platformScopeSize - b.evalResult.platformScopeSize;
    }

    const versionCmp = compareDottedVersion(
      b.evalResult.compatibleMinVersion,
      a.evalResult.compatibleMinVersion,
    );
    if (versionCmp !== 0) {
      return versionCmp;
    }

    if (a.evalResult.segmentSpecific !== b.evalResult.segmentSpecific) {
      return a.evalResult.segmentSpecific ? -1 : 1;
    }

    if (a.evalResult.segmentScopeSize !== b.evalResult.segmentScopeSize) {
      return a.evalResult.segmentScopeSize - b.evalResult.segmentScopeSize;
    }

    return 0;
  });

  return evaluated[0].set;
}

/**
 * Step 5: runtime child filtering.
 * @param {any} set
 */
function filterSetRuntimeChildren(set) {
  if (!set) return null;

  const groups = (set.groups ?? [])
    .filter((group) => !!group.publishedRevisionId && !group.archived)
    .map((group) => {
      const stories = (group.stories ?? []).filter(
        (story) => !!story.publishedRevisionId && !story.archived,
      );
      return { ...group, stories };
    })
    .filter((group) => group.stories.length > 0);

  return {
    ...set,
    groups,
  };
}

/**
 * Step 4 + Step 5: handle fallback and empty set/group behavior when there is no match.
 * @param {{
 *  allSets: Array<any>,
 *  placementKey: string,
 *  platform: string,
 *  appVersion: string,
 *  userSegments?: string[]
 * }} input
 */
function resolveSdkFeedSet(input) {
  const placementCandidates = getPublishedPlacementCandidates(
    input.allSets,
    input.placementKey,
  );

  const best = pickBestMatchingSet(placementCandidates, {
    platform: input.platform,
    appVersion: input.appVersion,
    userSegments: input.userSegments ?? [],
  });

  const fallback = placementCandidates.find((set) => !!set.isFallback) ?? null;

  const tryFilter = (candidate) => {
    const filtered = filterSetRuntimeChildren(candidate);
    if (!filtered) return null;
    if (filtered.groups.length === 0) return null;
    return filtered;
  };

  const primaryFiltered = tryFilter(best);
  if (primaryFiltered) {
    return { resolvedSet: primaryFiltered, source: 'targeted' };
  }

  const fallbackFiltered = tryFilter(fallback);
  if (fallbackFiltered) {
    return { resolvedSet: fallbackFiltered, source: 'fallback' };
  }

  return { resolvedSet: null, source: 'empty' };
}

module.exports = {
  compareDottedVersion,
  getPublishedPlacementCandidates,
  pickBestMatchingSet,
  filterSetRuntimeChildren,
  resolveSdkFeedSet,
};
