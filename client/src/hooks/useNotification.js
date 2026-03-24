import { useState, useCallback } from 'react';

export function useNotification() {
  const [notif, setNotif] = useState(null);

  const notify = useCallback((msg, type = 'info') => {
    setNotif({ msg, type, id: Date.now() });
  }, []);

  const dismiss = useCallback(() => setNotif(null), []);

  return { notif, notify, dismiss };
}
