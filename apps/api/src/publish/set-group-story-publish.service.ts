import {
  enforceNoTargetingConflict,
  enforceSinglePublishedFallback,
  GroupRevisionSnapshot,
  PublishedSet,
  requireGroupRepublishForCompositionChange,
  requireSetRepublishForCompositionOrConfigChange,
  SetRevisionSnapshot,
  validateStoryGroupCountRange,
} from './publish-guards';

export class StoryPublishService {
  validateStoryPublishPreconditions(groupDraftRevision: GroupRevisionSnapshot, groupPublishedRevision?: GroupRevisionSnapshot): void {
    // Story content publish akışı içinde composition farkı taşınmamalı.
    requireGroupRepublishForCompositionChange(groupDraftRevision, groupPublishedRevision);
  }
}

export class StoryGroupPublishService {
  validateGroupPublishPreconditions(params: {
    draftRevision: GroupRevisionSnapshot;
    publishedRevision?: GroupRevisionSnapshot;
  }): void {
    requireGroupRepublishForCompositionChange(params.draftRevision, params.publishedRevision);
  }
}

export class StoryGroupSetPublishService {
  validateSetPublishPreconditions(params: {
    placementId: string;
    draftRevision: SetRevisionSnapshot;
    publishedRevision?: SetRevisionSnapshot;
    minStoryGroupCount: number;
    maxStoryGroupCount: number;
    incomingSet: PublishedSet;
    alreadyPublishedSets: PublishedSet[];
  }): void {
    validateStoryGroupCountRange(params.minStoryGroupCount, params.maxStoryGroupCount);

    if (params.incomingSet.isFallback) {
      enforceSinglePublishedFallback(params.placementId, params.alreadyPublishedSets, params.incomingSet.id);
    }

    enforceNoTargetingConflict(params.placementId, params.incomingSet, params.alreadyPublishedSets);
    requireSetRepublishForCompositionOrConfigChange(params.draftRevision, params.publishedRevision);
  }
}
