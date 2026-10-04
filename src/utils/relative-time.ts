function formatUnit(amount: number, unit: string): string {
  const suffix = amount === 1 ? '' : 's';
  return `${amount} ${unit}${suffix} ago`;
}

export function formatRelativeTime(timestamp: string, now: number = Date.now()): string {
  const createdAt = Date.parse(timestamp);

  if (!Number.isFinite(createdAt)) {
    return 'just now';
  }

  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000));

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return formatUnit(hours, 'hour');
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return formatUnit(days, 'day');
  }

  if (days < 28) {
    return formatUnit(Math.floor(days / 7), 'week');
  }

  if (days < 365) {
    const months = Math.min(11, Math.max(1, Math.floor(days / 30)));
    return formatUnit(months, 'month');
  }

  return formatUnit(Math.floor(days / 365), 'year');
}
