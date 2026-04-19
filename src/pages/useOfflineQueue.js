// useOfflineQueue.js
import { useEffect, useRef, useState } from 'react';

const KEY = 'pos_offline_queue_v1';

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function saveQueue(q) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export default function useOfflineQueue({ retryMs = 4000 } = {}) {
  const [queue, setQueue] = useState(loadQueue());
  const timer = useRef(null);

  const enqueue = (item) => {
    const q = [...queue, item];
    setQueue(q);
    saveQueue(q);
  };

  const dequeueById = (id) => {
    const q = queue.filter((i) => i.id !== id);
    setQueue(q);
    saveQueue(q);
  };

  // auto retry when online
  useEffect(() => {
    const tick = async () => {
      if (!navigator.onLine) return;
      for (const item of queue) {
        try {
          const res = await fetch(item.url, {
            method: item.method || 'POST',
            headers: { 'Content-Type': 'application/json', ...(item.headers || {}) },
            body: JSON.stringify(item.body),
            credentials: 'include'
          });
          if (res.ok) dequeueById(item.id);
        } catch { /* keep in queue */ }
      }
    };
    timer.current = setInterval(tick, retryMs);
    window.addEventListener('online', tick);
    return () => {
      clearInterval(timer.current);
      window.removeEventListener('online', tick);
    };
  }, [queue, retryMs]);

  return { queue, enqueue, dequeueById };
}
