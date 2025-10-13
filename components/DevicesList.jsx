import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import styles from './DevicesList.module.css';

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function formatCoord(value) {
  if (value == null || value === '') return 'Not placed';
  const num = Number(value);
  if (Number.isFinite(num)) return num.toFixed(4);
  return String(value);
}

function deviceKey(device, index) {
  return device?.id || device?.key || `device-${index}`;
}

export default function DevicesList({
  devices = [],
  selectedId = null,
  onSelect = () => {},
  onReorder = () => {},
  onDuplicate = () => {},
  onDelete = () => {},
  getIconUrl = () => '',
}) {
  const listRef = useRef(null);
  const instructionsId = useId();
  const [pendingFocusId, setPendingFocusId] = useState(null);
  const selectedKey = useMemo(() => {
    if (!devices.length) return null;
    if (typeof selectedId === 'number' && selectedId >= 0 && selectedId < devices.length) {
      return deviceKey(devices[selectedId], selectedId);
    }
    if (selectedId) return selectedId;
    return deviceKey(devices[0], 0);
  }, [devices, selectedId]);

  useEffect(() => {
    if (!pendingFocusId || typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      if (!listRef.current) return;
      const el = listRef.current.querySelector(`[data-device-id="${pendingFocusId}"]`);
      if (el) {
        el.focus();
        setPendingFocusId(null);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocusId, devices]);

  function focusDevice(id) {
    setPendingFocusId(id);
  }

  function handleSelect(device, index) {
    const id = deviceKey(device, index);
    onSelect(device, index);
    focusDevice(id);
  }

  function handleMove(device, index, direction) {
    onReorder(device, direction, index);
    const targetIndex = direction < 0 ? Math.max(0, index - 1) : Math.min(devices.length - 1, index + 1);
    const targetDevice = devices[targetIndex];
    if (targetDevice) focusDevice(deviceKey(targetDevice, targetIndex));
  }

  function handleKeyDown(event, device, index) {
    const id = deviceKey(device, index);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(device, index);
      focusDevice(id);
      return;
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && (event.altKey || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const dir = event.key === 'ArrowUp' ? -1 : 1;
      handleMove(device, index, dir);
      return;
    }
    if (event.key === 'ArrowUp' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const prevIdx = Math.max(0, index - 1);
      const target = devices[prevIdx];
      if (target) {
        onSelect(target, prevIdx);
        focusDevice(deviceKey(target, prevIdx));
      }
      return;
    }
    if (event.key === 'ArrowDown' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const nextIdx = Math.min(devices.length - 1, index + 1);
      const target = devices[nextIdx];
      if (target) {
        onSelect(target, nextIdx);
        focusDevice(deviceKey(target, nextIdx));
      }
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && !event.shiftKey) {
      event.preventDefault();
      onDelete(device, index);
      return;
    }
    if (event.key.toLowerCase() === 'd' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onDuplicate(device, index);
    }
  }

  return (
    <div className={styles.container}>
      <p id={instructionsId} className={styles.hiddenLabel}>
        Use the arrow keys to move between devices. Press Enter or Space to select. Hold Alt and press the arrow keys to reorder.
        Press Delete to remove the focused device or Ctrl plus D to duplicate it.
      </p>
      <div
        ref={listRef}
        className={styles.list}
        role="listbox"
        aria-label="Devices"
        aria-describedby={instructionsId}
        tabIndex={-1}
      >
        {devices.length === 0 && (
          <div className={styles.emptyState}>No devices yet. Use “Add Device” to place your first device.</div>
        )}
        {devices.map((device, index) => {
          const id = deviceKey(device, index);
          const isSelected = selectedKey === id || (!selectedKey && index === 0);
          const iconUrl = getIconUrl(device);
          const hasCoords = device?.lat != null && device?.lng != null;
          const triggerEnabled = !!device?.trigger?.enabled;
          return (
            <div
              key={id}
              role="option"
              data-device-id={id}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={classNames(styles.item, isSelected && styles.itemSelected)}
              onClick={() => handleSelect(device, index)}
              onKeyDown={(event) => handleKeyDown(event, device, index)}
            >
              <div className={styles.thumbnail} aria-hidden="true">
                {iconUrl ? (
                  <img src={iconUrl} alt="" />
                ) : (
                  <span>{(device?.type || 'D').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className={styles.meta}>
                <div className={styles.metaHeader}>
                  <span>
                    {(device?.id || `D${index + 1}`)} — {device?.title || device?.name || '(untitled device)'}
                  </span>
                  <span className={styles.metaCoords}>
                    {hasCoords ? `${formatCoord(device.lat)}, ${formatCoord(device.lng)}` : 'Not placed'}
                  </span>
                </div>
                <div className={styles.metaBadges}>
                  <span className={styles.badge}>Type {device?.type || '—'}</span>
                  <span className={styles.badge}>Radius {device?.pickupRadius ?? '—'} m</span>
                  <span className={styles.badge}>Effect {device?.effectSeconds ?? '—'} s</span>
                  {triggerEnabled && <span className={styles.badge}>Trigger Enabled</span>}
                </div>
              </div>
              <div className={styles.controls}>
                <div className={styles.iconButtonRow}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={(event) => { event.stopPropagation(); handleMove(device, index, -1); }}
                    disabled={index === 0}
                    aria-label={`Move ${device?.title || device?.id || 'device'} up`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={(event) => { event.stopPropagation(); handleMove(device, index, 1); }}
                    disabled={index === devices.length - 1}
                    aria-label={`Move ${device?.title || device?.id || 'device'} down`}
                  >
                    ▼
                  </button>
                </div>
                <div className={styles.iconButtonRow}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={(event) => { event.stopPropagation(); onDuplicate(device, index); }}
                    aria-label={`Duplicate ${device?.title || device?.id || 'device'}`}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={(event) => { event.stopPropagation(); onDelete(device, index); }}
                    aria-label={`Delete ${device?.title || device?.id || 'device'}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
