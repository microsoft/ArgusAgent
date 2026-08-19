import type { KeyboardEvent } from 'react';

/** Whether this keystroke belongs to an IME candidate window rather than the app.
 *
 * While composing Chinese, Japanese, or Korean text, Enter confirms the
 * highlighted candidate and the arrow keys page through the candidate list.
 * Those keystrokes still arrive as `keydown`, so a handler that submits on
 * Enter will send the message the moment the user picks their first word —
 * the input clears mid-sentence and the caret lands somewhere unexpected.
 * Windows makes it especially easy to hit, because Microsoft Pinyin commits
 * on Enter by default.
 *
 * `isComposing` is the standard signal. `keyCode === 229` is the legacy value
 * some IMEs still report and costs nothing to keep, since 229 is not a real
 * key any handler wants to act on. */
export function isImeComposing(event: KeyboardEvent<Element>): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
