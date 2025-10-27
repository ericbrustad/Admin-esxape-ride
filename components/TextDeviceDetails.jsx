import React from 'react';

const styles = {
  container: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(59, 130, 246, 0.24)',
    background: 'rgba(37, 99, 235, 0.08)',
    color: 'var(--admin-body-color)',
    fontSize: 13,
    lineHeight: 1.55,
    display: 'grid',
    gap: 8,
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    display: 'grid',
    gap: 4,
  },
  warning: {
    fontWeight: 600,
    color: '#fbbf24',
  },
  success: {
    fontWeight: 600,
    color: '#34d399',
  },
};

export default function TextDeviceDetails({ trigger }) {
  const armed = !!trigger?.enabled;
  const hasTarget = Boolean(trigger?.actionTarget);

  return (
    <div style={styles.container}>
      <div>
        {armed ? (
          <span style={styles.success}>Trigger armed.</span>
        ) : (
          <span style={styles.warning}>Trigger disabled.</span>
        )}{' '}
        Text Message devices dispatch SMS actions when the linked trigger fires — perfect for geo fences, incorrect responses,
        wrong-answer remediation, or timed nudges.
      </div>
      <ul style={styles.list}>
        <li>Ensure the trigger stays enabled so the Twilio/Supabase bridge knows when to send messages.</li>
        <li>Pick an action target (media, device, or mission) to accompany the text. This prevents blank states in the client.</li>
        <li>Geo fence triggers inherit the mission coordinates; timer triggers respect the effect duration above.</li>
      </ul>
      {!armed && (
        <div style={styles.warning}>Enable the trigger before saving so the device does not stall during deployment.</div>
      )}
      {armed && !hasTarget && (
        <div style={styles.warning}>Select an action target to complete the automation path.</div>
      )}
    </div>
  );
}
