function parseVersionParts(version) {
  return String(version || '0')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(a, b) {
  const aParts = parseVersionParts(a);
  const bParts = parseVersionParts(b);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const left = aParts[index] || 0;
    const right = bParts[index] || 0;

    if (left > right) {
      return 1;
    }

    if (left < right) {
      return -1;
    }
  }

  return 0;
}

function toSegmentSet(segments) {
  return new Set((segments || []).map((segment) => String(segment).trim()).filter(Boolean));
}

function findPlatformRule(set, platform) {
  return (set.platformTargets || []).find((target) => target.platform === platform) || null;
}

function isNormalSetMatch(set, context) {
  if (set.isFallback) {
    return false;
  }

  const platformRule = findPlatformRule(set, context.platform);
  if (!platformRule) {
    return false;
  }

  if (compareVersions(context.appVersion, platformRule.minAppVersion) < 0) {
    return false;
  }

  if (platformRule.maxAppVersion && compareVersions(context.appVersion, platformRule.maxAppVersion) > 0) {
    return false;
  }

  const setSegments = toSegmentSet(set.segments);
  const requestSegments = toSegmentSet(context.userSegments);

  if (setSegments.size === 0) {
    return requestSegments.size === 0;
  }

  if (requestSegments.size === 0) {
    return false;
  }

  for (const segment of setSegments) {
    if (requestSegments.has(segment)) {
      return true;
    }
  }

  return false;
}

function resolutionRank(set, context) {
  const platformRule = findPlatformRule(set, context.platform);
  const segmentCount = toSegmentSet(set.segments).size;

  return {
    platformBreadth: (set.platformTargets || []).length,
    minVersion: platformRule ? platformRule.minAppVersion : '0.0.0',
    segmentSpecificity: segmentCount > 0 ? 1 : 0,
    segmentCount,
  };
}

function compareRank(a, b) {
  if (a.platformBreadth !== b.platformBreadth) {
    return a.platformBreadth < b.platformBreadth ? -1 : 1;
  }

  const minVersionComparison = compareVersions(a.minVersion, b.minVersion);
  if (minVersionComparison !== 0) {
    return minVersionComparison > 0 ? -1 : 1;
  }

  if (a.segmentSpecificity !== b.segmentSpecificity) {
    return a.segmentSpecificity > b.segmentSpecificity ? -1 : 1;
  }

  if (a.segmentCount !== b.segmentCount) {
    return a.segmentCount < b.segmentCount ? -1 : 1;
  }

  return 0;
}

function resolveSet(sets, context) {
  const normalMatches = sets
    .filter((set) => isNormalSetMatch(set, context))
    .map((set) => ({ set, rank: resolutionRank(set, context) }))
    .sort((left, right) => compareRank(left.rank, right.rank));

  if (normalMatches.length > 0) {
    return normalMatches[0].set;
  }

  return sets.find((set) => set.isFallback) || null;
}

function platformRangesOverlap(left, right) {
  const leftMin = left.minAppVersion || '0.0.0';
  const rightMin = right.minAppVersion || '0.0.0';
  const leftMax = left.maxAppVersion || null;
  const rightMax = right.maxAppVersion || null;

  const start = compareVersions(leftMin, rightMin) >= 0 ? leftMin : rightMin;

  let end = null;
  if (leftMax && rightMax) {
    end = compareVersions(leftMax, rightMax) <= 0 ? leftMax : rightMax;
  } else {
    end = leftMax || rightMax || null;
  }

  if (!end) {
    return true;
  }

  return compareVersions(start, end) <= 0;
}

function segmentsOverlap(leftSegments, rightSegments) {
  const left = toSegmentSet(leftSegments);
  const right = toSegmentSet(rightSegments);

  if (left.size === 0 || right.size === 0) {
    return left.size === 0 && right.size === 0;
  }

  for (const segment of left) {
    if (right.has(segment)) {
      return true;
    }
  }

  return false;
}

function setsAreAmbiguous(left, right) {
  if (left.isFallback || right.isFallback) {
    return false;
  }

  if (!segmentsOverlap(left.segments, right.segments)) {
    return false;
  }

  const leftPlatforms = left.platformTargets || [];
  const rightPlatforms = right.platformTargets || [];

  for (const leftRule of leftPlatforms) {
    for (const rightRule of rightPlatforms) {
      if (leftRule.platform !== rightRule.platform) {
        continue;
      }

      if (platformRangesOverlap(leftRule, rightRule)) {
        return true;
      }
    }
  }

  return false;
}

function validatePublishCandidate(existingSets, candidate) {
  const errors = [];

  if (candidate.isFallback) {
    const hasFallback = existingSets.some((set) => set.isFallback);
    if (hasFallback) {
      errors.push('FALLBACK_SET_MUST_BE_UNIQUE');
    }

    if ((candidate.platformTargets || []).length > 0 || toSegmentSet(candidate.segments).size > 0) {
      errors.push('FALLBACK_SET_CANNOT_HAVE_TARGETING');
    }
  }

  for (const rule of candidate.platformTargets || []) {
    if (rule.maxAppVersion && compareVersions(rule.minAppVersion, rule.maxAppVersion) > 0) {
      errors.push(`INVALID_MIN_MAX_FOR_${rule.platform.toUpperCase()}`);
    }
  }

  for (const existing of existingSets) {
    if (setsAreAmbiguous(existing, candidate)) {
      errors.push(`AMBIGUOUS_WITH_${existing.id}`);
    }
  }

  return errors;
}

function filterGroupStories(group) {
  const filteredStories = (group.stories || []).filter(
    (story) => story.isPublished && !story.isArchived,
  );

  if (!group.isPublished || group.isArchived || filteredStories.length === 0) {
    return null;
  }

  return {
    ...group,
    stories: filteredStories,
  };
}

function buildFeedFromSet(set) {
  const groups = (set.groups || []).map(filterGroupStories).filter(Boolean);

  return {
    setId: set.id,
    groups,
  };
}

function resolveFeed(sets, context) {
  const selectedSet = resolveSet(sets, context);
  if (!selectedSet) {
    return {
      setId: null,
      groups: [],
    };
  }

  const resolved = buildFeedFromSet(selectedSet);
  if (resolved.groups.length > 0) {
    return resolved;
  }

  const fallback = sets.find((set) => set.isFallback);
  if (!fallback || fallback.id === selectedSet.id) {
    return {
      setId: null,
      groups: [],
    };
  }

  const fallbackFeed = buildFeedFromSet(fallback);
  if (fallbackFeed.groups.length === 0) {
    return {
      setId: null,
      groups: [],
    };
  }

  return fallbackFeed;
}

function publishStory(story) {
  return {
    ...story,
    publishedRevisionId: story.draftRevisionId,
  };
}

function publishGroup(group) {
  return {
    ...group,
    publishedRevisionId: group.draftRevisionId,
    publishedStoryIds: [...group.draftStoryIds],
  };
}

function publishSet(set) {
  return {
    ...set,
    publishedRevisionId: set.draftRevisionId,
    publishedGroupIds: [...set.draftGroupIds],
  };
}

function buildLiveSnapshot({ set, groupsById, storiesById }) {
  const groupIds = set.publishedGroupIds || [];
  return groupIds.map((groupId) => {
    const group = groupsById[groupId];
    const storyIds = group.publishedStoryIds || [];

    return {
      groupId,
      groupRevisionId: group.publishedRevisionId,
      storyIds,
      storyRevisionIds: storyIds.map((storyId) => storiesById[storyId].publishedRevisionId),
    };
  });
}

function authorizeFeedRequest({ clientId, tokenValue, client, tokens }) {
  if (!client || !client.isActive) {
    return { allowed: false, reason: 'CLIENT_INACTIVE' };
  }

  const token = tokens.find((candidate) => candidate.value === tokenValue);
  if (!token) {
    return { allowed: false, reason: 'TOKEN_NOT_FOUND' };
  }

  if (!token.isActive) {
    return { allowed: false, reason: 'TOKEN_REVOKED' };
  }

  if (token.clientId !== clientId) {
    return { allowed: false, reason: 'TOKEN_CLIENT_MISMATCH' };
  }

  if (client.id !== clientId) {
    return { allowed: false, reason: 'CLIENT_NOT_FOUND' };
  }

  return { allowed: true };
}

module.exports = {
  authorizeFeedRequest,
  buildLiveSnapshot,
  compareVersions,
  publishGroup,
  publishSet,
  publishStory,
  resolveFeed,
  resolveSet,
  validatePublishCandidate,
};
