import React, { useMemo } from 'react';
import { TEXT_PLAYER_TOKENS, createTextMessageContent } from '../lib/text-messages';

const styles = {
  container: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 16,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    boxShadow: '0 12px 28px rgba(6, 12, 20, 0.35)',
    display: 'grid',
    gap: 16,
  },
  intro: {
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--admin-body-color)',
    background: 'rgba(37, 99, 235, 0.08)',
    border: '1px solid rgba(37, 99, 235, 0.18)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  toggleColumn: {
    display: 'grid',
    gap: 12,
    background: 'rgba(15, 23, 42, 0.18)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  toggleLabel: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    fontWeight: 600,
    color: 'var(--admin-body-color)',
  },
  toggleInput: {
    marginTop: 4,
  },
  sectionBody: {
    display: 'grid',
    gap: 12,
    padding: 8,
    background: 'rgba(15, 118, 110, 0.08)',
    border: '1px solid rgba(45, 212, 191, 0.18)',
    borderRadius: 10,
  },
  divider: {
    border: 'none',
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.45), transparent)',
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  hint: {
    fontSize: 12,
    color: 'var(--admin-muted)',
    marginTop: 6,
  },
  tokenRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  tokenLabel: {
    fontSize: 12,
    color: 'var(--admin-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  tokenButton: {
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(37, 99, 235, 0.35)',
    background: 'rgba(37, 99, 235, 0.12)',
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--admin-body-color)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  conversationCard: {
    border: '1px solid rgba(59, 130, 246, 0.24)',
    borderRadius: 12,
    padding: 12,
    background: 'rgba(37, 99, 235, 0.08)',
    display: 'grid',
    gap: 8,
  },
};

export default function TextMessageMissionEditor({
  content,
  onChange,
  onAppendToken,
  playerTokens = TEXT_PLAYER_TOKENS,
  inputStyle,
  textareaStyle,
}) {
  const normalized = useMemo(() => createTextMessageContent(content), [content]);
  const incomingEnabled = normalized.enableIncoming;
  const outgoingEnabled = normalized.enableOutgoing;
  const textAreaInput = useMemo(() => {
    if (textareaStyle) return textareaStyle;
    const base = inputStyle || {};
    return {
      ...base,
      minHeight: base?.minHeight || 120,
      height: base?.height || 120,
      fontFamily: base?.fontFamily || 'ui-monospace, Menlo, Monaco, Consolas',
    };
  }, [inputStyle, textareaStyle]);

  const handlePartial = (partial) => {
    if (typeof onChange === 'function') {
      onChange(partial);
    }
  };

  const renderTokenButtons = (fieldKey) => (
    <div style={styles.tokenRow}>
      <span style={styles.tokenLabel}>Dynamic IDs:</span>
      {playerTokens.map((token) => (
        <button
          key={token.token}
          type="button"
          style={styles.tokenButton}
          onClick={() => onAppendToken && onAppendToken(fieldKey, token.token)}
        >
          {token.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.intro}>
        Configure how this mission texts the player. Use the toggles below to reveal the appropriate message flow. Incoming
        texts let you push story updates, while outgoing prompts collect responses and forward them through Twilio or future
        Supabase messaging pipelines.
      </div>

      <div style={styles.toggleColumn}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={incomingEnabled}
            onChange={(e) => handlePartial({ enableIncoming: e.target.checked })}
            style={styles.toggleInput}
          />
          <span>
            Enable incoming text message — send clues or updates straight to the player as soon as the mission is triggered.
          </span>
        </label>
        {incomingEnabled && (
          <div style={styles.sectionBody}>
            <div>
              <div style={styles.sectionTitle}>Incoming message title</div>
              <input
                style={inputStyle}
                value={normalized.incomingTitle}
                onChange={(e) => handlePartial({ incomingTitle: e.target.value })}
                placeholder="Incoming text title"
              />
              <div style={styles.hint}>
                Players will see this title as the SMS header inside the admin logs.
              </div>
            </div>
            <div>
              <div style={styles.sectionTitle}>Incoming message body</div>
              <textarea
                style={textAreaInput}
                value={normalized.incomingBody}
                onChange={(e) => handlePartial({ incomingBody: e.target.value })}
                placeholder="This is what the player receives by text"
              />
              <div style={styles.hint}>Use tokens to personalise the content with player data.</div>
              {renderTokenButtons('incomingBody')}
            </div>
          </div>
        )}
      </div>

      <hr style={styles.divider} />

      <div style={styles.toggleColumn}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={outgoingEnabled}
            onChange={(e) => handlePartial({ enableOutgoing: e.target.checked })}
            style={styles.toggleInput}
          />
          <span>
            Enable outgoing text message — let the player craft a reply that we forward through Twilio or Supabase handlers.
          </span>
        </label>
        {outgoingEnabled && (
          <div style={styles.sectionBody}>
            <div>
              <div style={styles.sectionTitle}>Prompt for the player</div>
              <textarea
                style={textAreaInput}
                value={normalized.outgoingPrompt}
                onChange={(e) => handlePartial({ outgoingPrompt: e.target.value })}
                placeholder="Tell the player what to text back or who to contact"
              />
              <div style={styles.hint}>
                This displays in the mission UI so the player knows what kind of response you expect.
              </div>
            </div>
            <div>
              <div style={styles.sectionTitle}>Outgoing message template</div>
              <textarea
                style={textAreaInput}
                value={normalized.outgoingPlayerMessage}
                onChange={(e) => handlePartial({ outgoingPlayerMessage: e.target.value })}
                placeholder="Auto-filled SMS the player can send"
              />
              <div style={styles.hint}>Pre-fill with dynamic IDs or instructions for rapid responses.</div>
              {renderTokenButtons('outgoingPlayerMessage')}
            </div>
            <div style={styles.gridTwo}>
              <div>
                <div style={styles.sectionTitle}>Recipient number ID</div>
                <input
                  style={inputStyle}
                  value={normalized.targetNumberKey}
                  onChange={(e) => handlePartial({ targetNumberKey: e.target.value })}
                  placeholder="Env/database key, e.g. TWILIO_SUPPORT"
                />
                <div style={styles.hint}>
                  Reference an environment variable or Supabase stored contact (preferred).
                </div>
              </div>
              <div>
                <div style={styles.sectionTitle}>Fallback phone number</div>
                <input
                  style={inputStyle}
                  value={normalized.targetNumberDirect}
                  onChange={(e) => handlePartial({ targetNumberDirect: e.target.value })}
                  placeholder="+15551234567"
                />
                <div style={styles.hint}>
                  Used if the ID above is blank or not found. Numbers are sanitised automatically.
                </div>
              </div>
            </div>
            <div>
              <div style={styles.sectionTitle}>Response note</div>
              <textarea
                style={textAreaInput}
                value={normalized.outgoingResponseNote}
                onChange={(e) => handlePartial({ outgoingResponseNote: e.target.value })}
                placeholder="Internal guide for staff reviewing replies"
              />
              <div style={styles.hint}>Visible in the admin console to keep moderators on script.</div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.conversationCard}>
        <div style={styles.sectionTitle}>Conversation log (You ↔ GPT)</div>
        <div style={styles.hint}>
          Track the collaboration that shaped this mission. Paste helpful exchanges with GPT or teammates so future editors can
          review the reasoning behind each text flow.
        </div>
        <textarea
          style={textAreaInput}
          value={normalized.conversationLog}
          onChange={(e) => handlePartial({ conversationLog: e.target.value })}
          placeholder="Example:\nDEV: Asked GPT for tone guidance...\nGPT: Suggested playful intro with FIRST_NAME token."
        />
      </div>
    </div>
  );
}
