import { isAuthenticationError, LocalArgusUnavailableError } from '../api';
import { useI18n } from '../i18n';

export function ConnectionProblemBanner({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const pairing = isAuthenticationError(error);
  const unavailable = error instanceof LocalArgusUnavailableError;
  if (!pairing && !unavailable) return null;

  return (
    <div
      role="alert"
      className="fixed left-1/2 top-3 z-[100] flex w-[min(92vw,42rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-err/50 bg-panel/95 px-4 py-3 text-left text-sm text-ink shadow-xl backdrop-blur"
    >
      <span aria-hidden="true" className="mt-0.5 font-mono font-bold text-err">!</span>
      <div className="min-w-0 flex-1">
        <strong className="block text-err">
          {t(pairing ? 'connection.pairingTitle' : 'connection.unreachableTitle')}
        </strong>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-dim">
          {t(pairing ? 'connection.pairingDetail' : 'connection.unreachableDetail')}
        </span>
      </div>
      {!pairing ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-err/40 px-2.5 py-1 text-xs text-err hover:bg-err/10"
        >
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}
