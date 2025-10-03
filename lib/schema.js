// lib/schema.js
export const defaultGame = () => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  title: 'New Game',
  durationMinutes: 0, // 0 = infinite
  scoring: { pointsPerMission: 100, penaltyPerFail: 0, difficultyMultiplier: 1 },
  notifications: { alarmSound: '/sounds/alarm_1.mp3', warnAtMinutesLeft: 10 },
  monetization: { priceUSD: 9.99, plan: 'one_time', stripePriceId: '' },
  powerUps: [ /* { key:'signal_jammer', label:'Signal Jammer', durationSec:30, radiusMeters:50 } */ ],
  missions: [],
  roles: { ownerEmails: [], editorEmails: [], viewerEmails: [] },
});
