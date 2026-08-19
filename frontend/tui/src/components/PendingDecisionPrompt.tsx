import React from 'react';
import { Box, Text } from 'ink';
import type { OperatorDecisionCard } from '../../../core/src/decisions.js';
import type { Edit } from '../input/editor.js';
import { theme } from '../theme.js';

export function PendingDecisionPrompt({
  card,
  selection,
  note,
  busy,
  error,
}: {
  card: OperatorDecisionCard;
  selection: number;
  note: Edit;
  busy: boolean;
  error: string;
}) {
  const selected = card.options[selection];
  const freeform = card.options.length === 0;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.warning} paddingX={1} marginTop={1}>
      <Text color={theme.warning} bold>ACTION REQUIRED</Text>
      <Text bold wrap="wrap">{card.title}</Text>
      <Box marginTop={1}><Text wrap="wrap">{card.question}</Text></Box>
      {card.options.length ? (
        <Box flexDirection="column" marginTop={1}>
          {card.options.map((option, index) => (
            <Text key={option.id} color={index === selection ? theme.accent : undefined} wrap="wrap">
              {index === selection ? '› ' : '  '}{index + 1}. {option.label}
              {option.description && option.description !== card.question
                ? ` — ${option.description}`
                : ''}
            </Text>
          ))}
        </Box>
      ) : null}
      {freeform || selected?.requires_note ? (
        <Box marginTop={1}>
          <Text color={theme.accent}>Your response › </Text>
          <Text>{note.value}</Text>
          {!busy ? <Text inverse> </Text> : null}
        </Box>
      ) : null}
      {error ? <Text color={theme.error} wrap="wrap">{error}</Text> : null}
      <Text dimColor>
        {busy
          ? 'Sending your answer…'
          : freeform
            ? 'Type your answer · Enter send'
            : '↑/↓ or number select · Enter confirm · typing selects an option that accepts guidance'}
      </Text>
    </Box>
  );
}
