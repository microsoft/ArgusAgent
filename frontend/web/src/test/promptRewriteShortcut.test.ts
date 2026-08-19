import { describe, expect, it, vi } from 'vitest';
import { handlePromptRewriteShortcut } from '../components/ChatBox';

function shortcut(key: string, ctrlKey = false, metaKey = false) {
  return {
    key,
    ctrlKey,
    metaKey,
    preventDefault: vi.fn(),
  };
}

describe('prompt rewrite shortcut', () => {
  it('rewrites the trimmed draft on Ctrl+R and prevents browser reload', () => {
    const event = shortcut('r', true);
    const onRewrite = vi.fn();

    expect(handlePromptRewriteShortcut(event, {
      value: '  improve the kernel  ',
      disabled: false,
      pending: false,
      rewriting: false,
      onRewrite,
    })).toBe(true);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onRewrite).toHaveBeenCalledWith('improve the kernel');
  });

  it('supports Cmd+R and consumes the shortcut while a rewrite is busy', () => {
    const event = shortcut('R', false, true);
    const onRewrite = vi.fn();

    expect(handlePromptRewriteShortcut(event, {
      value: 'draft',
      disabled: false,
      pending: false,
      rewriting: true,
      onRewrite,
    })).toBe(true);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onRewrite).not.toHaveBeenCalled();
  });

  it('leaves ordinary typing alone', () => {
    const event = shortcut('r');
    const onRewrite = vi.fn();

    expect(handlePromptRewriteShortcut(event, {
      value: 'draft',
      disabled: false,
      pending: false,
      rewriting: false,
      onRewrite,
    })).toBe(false);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onRewrite).not.toHaveBeenCalled();
  });
});
