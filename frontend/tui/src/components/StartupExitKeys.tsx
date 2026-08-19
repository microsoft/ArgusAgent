import React from 'react';
import { useApp, useInput } from 'ink';

/** Keep Ctrl-C/Ctrl-D usable before the live App input handler is mounted. */
export function StartupExitKeys({
  active,
  onExit,
}: {
  active: boolean;
  onExit?: () => void;
}) {
  const { exit } = useApp();
  useInput((input, key) => {
    if (key.ctrl && (input === 'c' || input === 'd')) {
      onExit?.();
      exit();
    }
  }, { isActive: active });
  return null;
}
