import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ComposerAttachmentChip } from '../components/ComposerAttachmentChip';
import {
  addComposerFiles,
  attachmentMime,
  dataTransferHasFiles,
  extractFilesFromDataTransfer,
  MESSAGE_ATTACHMENT_MAX_COUNT,
  MESSAGE_ATTACHMENT_MAX_BYTES,
} from '../lib/attachments';

describe('composer attachment helpers', () => {
  it('accepts supported files and deduplicates exact re-adds', () => {
    const note = new File(['# note\n'], 'notes.md', { type: 'text/markdown' });

    const first = addComposerFiles([], [note]);
    const second = addComposerFiles([note], [note]);

    expect(first.accepted).toEqual([note]);
    expect(first.issues).toEqual([]);
    expect(second.accepted).toEqual([]);
  });

  it('rejects unsupported, oversized, and excess files with stable codes', () => {
    const unsupported = new File(['hello'], 'brief.exe', { type: 'application/octet-stream' });
    const tooLarge = new File(
      [new Uint8Array(MESSAGE_ATTACHMENT_MAX_BYTES + 1)],
      'big.pdf',
      { type: 'application/pdf' },
    );
    const crowd = Array.from({ length: MESSAGE_ATTACHMENT_MAX_COUNT + 1 }, (_, index) => (
      new File([`${index}`], `note-${index}.txt`, { type: 'text/plain' })
    ));

    expect(addComposerFiles([], [unsupported]).issues[0]).toEqual({
      code: 'unsupported',
      fileName: 'brief.exe',
    });
    expect(addComposerFiles([], [tooLarge]).issues[0]).toMatchObject({
      code: 'too-large',
      fileName: 'big.pdf',
    });
    expect(addComposerFiles([], crowd).issues.at(-1)).toEqual({
      code: 'too-many',
      limitCount: MESSAGE_ATTACHMENT_MAX_COUNT,
    });
  });

  it('extracts pasted or dropped files from clipboard-like payloads', () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'paste.png', { type: 'image/png' });
    const transfer = {
      types: ['Files'],
      items: [{ kind: 'file', getAsFile: () => image }],
    };

    expect(dataTransferHasFiles(transfer)).toBe(true);
    expect(extractFilesFromDataTransfer(transfer)).toEqual([image]);
  });
});

describe('composer attachment chip', () => {
  it('renders the file name, size, and canonical MIME label', () => {
    const file = new File(['alpha,beta\n1,2\n'], 'table.csv', { type: 'text/csv' });
    const html = renderToStaticMarkup(
      <ComposerAttachmentChip
        file={file}
        removeLabel="remove attachment table.csv"
        onRemove={() => undefined}
      />,
    );

    expect(attachmentMime(file)).toBe('text/csv');
    expect(html).toContain('table.csv');
    expect(html).toContain('15 B');
    expect(html).toContain('text/csv');
    expect(html).toContain('remove attachment table.csv');
  });
});
