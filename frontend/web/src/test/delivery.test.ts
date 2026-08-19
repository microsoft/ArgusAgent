import { describe, expect, it } from 'vitest';
import { emptyMissionView } from '../../../core/src/missionView';
import type { ArtifactInfo, DeliveryReceipt } from '../../../core/src/types';
import {
  defaultPreviewPath,
  selectPreviewArtifacts,
} from '../components/ResearchCanvas';
import { deliveryNotificationPayload } from '../lib/desktopBridge';

const delivery: DeliveryReceipt = {
  schema_version: 1,
  delivery_id: 'delivery:item-1:task_completed',
  kind: 'task_completed',
  item_id: 'item-1',
  title: 'Create final report',
  summary: 'Reviewed report is ready.',
  status: 'done',
  review_status: 'done',
  delivered_at: 1,
  primary_target: {
    path: 'out/final.md',
    label: 'final.md',
    source: 'reviewer_evidence',
    why: 'Reviewer accepted the file.',
  },
  targets: [{
    path: 'out/final.md',
    label: 'final.md',
    source: 'reviewer_evidence',
    why: 'Reviewer accepted the file.',
  }],
};

const artifact = (path: string, source: ArtifactInfo['source']): ArtifactInfo => ({
  path,
  name: path.split('/').at(-1) || path,
  why: 'test',
  exists: true,
  kind: 'markdown',
  mime: 'text/markdown',
  size: 1,
  mtime: 1,
  source,
});

describe('completed delivery presentation', () => {
  it('opens the receipt primary target before a stale live checkpoint', () => {
    const view = emptyMissionView();
    view.delivery = delivery;
    const artifacts = [
      artifact('.argus/live/status.md', 'manager_live'),
      artifact('out/final.md', 'delivery'),
    ];

    expect(defaultPreviewPath(view, artifacts)).toBe('out/final.md');
    expect(selectPreviewArtifacts(artifacts).map((item) => item.path)).toEqual([
      'out/final.md',
      '.argus/live/status.md',
    ]);
  });

  it('keeps a delivery notification display-only and bounded', () => {
    expect(deliveryNotificationPayload(delivery)).toEqual({
      deliveryId: delivery.delivery_id,
      title: delivery.title,
      summary: delivery.summary,
      path: 'out/final.md',
    });
  });
});
