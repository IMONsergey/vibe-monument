import type { ApprovalRequest, SimpleApprovalDecision, UserInputQuestion } from '../types';

export type UserAnswers = Record<string, string[]>;

function approvalTitle(approval: ApprovalRequest): string {
  switch (approval.kind) {
    case 'command': return 'Codex wants to run a command';
    case 'file-change': return 'Codex wants to change files';
    case 'permissions': return 'Codex needs additional access';
    case 'user-input': return 'Codex has a question';
    case 'elicitation': return 'An integration needs your input';
    default: return 'Codex needs attention';
  }
}

function decisionLabel(approval: ApprovalRequest, decision: SimpleApprovalDecision): string {
  if (decision === 'acceptForSession') return 'Allow for session';
  if (decision === 'decline') return 'Decline';
  if (decision === 'cancel') return 'Cancel turn';
  if (approval.kind === 'command') return 'Run once';
  if (approval.kind === 'file-change') return 'Apply';
  if (approval.kind === 'permissions') return 'Allow once';
  return 'Approve';
}

function permissionLines(approval: ApprovalRequest): string[] {
  if (approval.kind !== 'permissions') return [];
  const permissions = approval.params.permissions;
  if (!permissions || typeof permissions !== 'object') return [];
  const record = permissions as Record<string, unknown>;
  const lines: string[] = [];
  const network = record.network;
  if (network && typeof network === 'object' && (network as Record<string, unknown>).enabled === true) lines.push('Network access');
  const fileSystem = record.fileSystem;
  if (fileSystem && typeof fileSystem === 'object') {
    const fs = fileSystem as Record<string, unknown>;
    for (const key of ['read', 'write']) {
      const paths = fs[key];
      if (!Array.isArray(paths)) continue;
      for (const path of paths) if (typeof path === 'string') lines.push(`${key === 'write' ? 'Write' : 'Read'} · ${path}`);
    }
  }
  return lines;
}

function questionComplete(question: UserInputQuestion, answers: UserAnswers): boolean {
  return (answers[question.id] ?? []).some((answer) => answer.trim().length > 0);
}

export function ApprovalCard({
  approval,
  answers,
  busy,
  onAnswers,
  onDecision,
  onSubmitAnswers,
}: {
  approval: ApprovalRequest;
  answers: UserAnswers;
  busy: boolean;
  onAnswers: (answers: UserAnswers) => void;
  onDecision: (decision: SimpleApprovalDecision) => void;
  onSubmitAnswers: () => void;
}) {
  const questions = approval.questions ?? [];
  const permissions = permissionLines(approval);
  const answersReady = questions.length > 0 && questions.every((question) => questionComplete(question, answers));

  return (
    <section className={`approval-card approval-${approval.kind}`}>
      <div className="approval-heading">
        <div><span className="attention-dot" /><strong>{approvalTitle(approval)}</strong></div>
        {approval.isBlocking === false ? <span className="approval-meta">Optional</span> : <span className="approval-meta">Paused</span>}
      </div>
      {approval.reason ? <p className="approval-reason">{approval.reason}</p> : null}
      {approval.command ? <pre className="approval-command"><code>{approval.command}</code></pre> : null}
      {approval.cwd ? <div className="approval-context"><span>Working folder</span><code>{approval.cwd}</code></div> : null}
      {approval.changedPaths?.length ? (
        <div className="approval-paths">
          <span>Files</span>
          {approval.changedPaths.slice(0, 8).map((path) => <code key={path}>{path}</code>)}
          {approval.changedPaths.length > 8 ? <small>+{approval.changedPaths.length - 8} more</small> : null}
        </div>
      ) : null}
      {permissions.length ? <div className="approval-permissions">{permissions.map((line) => <span key={line}>{line}</span>)}</div> : null}

      {approval.kind === 'user-input' ? (
        <div className="question-stack">
          {questions.map((question) => {
            const selected = answers[question.id] ?? [];
            const options = question.options ?? [];
            return (
              <div className="question-card" key={question.id}>
                {question.header ? <span className="question-kicker">{question.header}</span> : null}
                <strong>{question.question}</strong>
                {options.length ? (
                  <div className="question-options">
                    {options.map((option) => (
                      <button type="button" className={selected.includes(option.label) ? 'active' : ''} key={option.label} disabled={busy} onClick={() => onAnswers({ ...answers, [question.id]: [option.label] })}>
                        <span>{option.label}</span>{option.description ? <small>{option.description}</small> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!options.length || question.isOther ? (
                  <input className="question-input" type={question.isSecret ? 'password' : 'text'} value={!options.length ? (selected[0] ?? '') : ''} disabled={busy} placeholder={question.isSecret ? 'Enter securely…' : 'Type another answer…'} onChange={(event) => onAnswers({ ...answers, [question.id]: [event.target.value] })} />
                ) : null}
              </div>
            );
          })}
          <div className="approval-actions"><button type="button" className="approval-primary" disabled={!answersReady || busy} onClick={onSubmitAnswers}>{busy ? 'Sending…' : 'Continue'}</button></div>
        </div>
      ) : (
        <div className="approval-actions">
          {approval.availableDecisions.map((decision) => (
            <button type="button" key={decision} disabled={busy} className={decision === 'accept' || decision === 'acceptForSession' ? 'approval-primary' : decision === 'cancel' ? 'approval-danger' : 'approval-secondary'} onClick={() => onDecision(decision)}>{decisionLabel(approval, decision)}</button>
          ))}
        </div>
      )}
      {approval.kind === 'elicitation' ? <small className="approval-footnote">Structured integration forms are declined safely until Monument can render their exact schema.</small> : null}
    </section>
  );
}
