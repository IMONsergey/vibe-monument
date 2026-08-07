import { selectionLabel } from '../preview/selection';
import type { PromptQueueState } from '../queue/controller';

function compact(value: string, limit = 92): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

export function PromptQueue({
  state,
  dispatching,
  onTogglePause,
  onMove,
  onRemove,
}: {
  state: PromptQueueState | null;
  dispatching: boolean;
  onTogglePause: () => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onRemove: (itemId: string) => void;
}) {
  if (!state?.items.length) return null;
  return (
    <div className={`prompt-queue ${state.paused ? 'paused' : ''}`}>
      <div className="prompt-queue-header">
        <div>
          <strong>{dispatching ? 'Starting next…' : `${state.items.length} next`}</strong>
          <span>{state.paused ? 'Queue paused' : 'Runs after the current build and verification finish'}</span>
        </div>
        <button type="button" onClick={onTogglePause}>{state.paused ? 'Resume' : 'Pause'}</button>
      </div>
      <div className="prompt-queue-items">
        {state.items.map((item, index) => (
          <div className="prompt-queue-item" key={item.id}>
            <span className="prompt-queue-index">{index + 1}</span>
            <div className="prompt-queue-copy">
              <strong>{compact(item.text)}</strong>
              {item.selection ? <small>⌖ {selectionLabel(item.selection)}</small> : null}
            </div>
            <div className="prompt-queue-actions">
              <button type="button" disabled={index === 0} onClick={() => onMove(item.id, -1)} title="Move earlier">↑</button>
              <button type="button" disabled={index === state.items.length - 1} onClick={() => onMove(item.id, 1)} title="Move later">↓</button>
              <button type="button" onClick={() => onRemove(item.id)} title="Remove">×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
