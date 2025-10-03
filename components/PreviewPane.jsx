// components/PreviewPane.jsx
import React from 'react';

export default function PreviewPane({ mission, game }) {
  if (!mission) return <p className="text-sm text-gray-500">Select a mission to preview.</p>;
  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <h4 className="text-lg font-semibold">{mission.title || 'Untitled Mission'}</h4>
      {mission.type === 'mcq' && (
        <div>
          <p className="text-sm mb-2">{mission.prompt}</p>
          <ul className="list-disc pl-5 text-sm">
            {(mission.choices||[]).map((c,i)=>(<li key={i}>{c}</li>))}
          </ul>
        </div>
      )}
      {mission.type === 'short' && (
        <div>
          <p className="text-sm">{mission.prompt}</p>
          <input disabled className="mt-2 border rounded-xl px-3 py-2 w-full" placeholder="Player answer..." />
        </div>
      )}
      {mission.type === 'statement' && (
        <p className="text-sm">{mission.text}</p>
      )}
      {mission.geofence && (
        <p className="text-xs text-gray-500">Geofence at {mission.geofence.lat},{mission.geofence.lng} ± {mission.geofence.radius}m</p>
      )}
      {mission.mediaUrl && (
        <video className="w-full rounded-xl" controls src={mission.mediaUrl} />
      )}
      <div className="text-xs text-gray-500">
        <p>Scoring: +{game?.scoring?.pointsPerMission ?? 100} / −{game?.scoring?.penaltyPerFail ?? 0}</p>
      </div>
    </div>
  );
}
