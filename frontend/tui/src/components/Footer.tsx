import React from 'react';
import { Text } from 'ink';

const HINTS = 'Enter send · Ctrl-R rewrite · / commands · scroll up · Ctrl-C quit UI';
const COMPACT_HINTS = 'Enter send · Ctrl-R rewrite · / commands · Ctrl-C quit UI';

export function Footer({
  notice,
  health,
  width,
}: {
  notice?: string;
  health?: string;
  width: number;
}) {
  const raw = notice || (health ? `⚠ ${health}` : '') || (width < 132 ? COMPACT_HINTS : HINTS);
  const limit = Math.max(12, width - 2);
  const text = raw.length <= limit ? raw : `${raw.slice(0, limit - 1)}…`;
  return <Text dimColor wrap="truncate-end">{text}</Text>;
}
