import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for real-time notifications using Server-Sent Events
 */
export const useNotifications = (token) => {
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const connect = useCallback(() => {
    if (!token) return;

    try {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create new EventSource connection
      const eventSource = new EventSource(
        `${BACKEND_URL}/api/notifications/stream`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      eventSource.onopen = () => {
        console.log('✅ Notification stream connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.addEventListener('connected', (event) => {
        console.log('Connected to notifications:', event.data);
      });

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          setNotifications(prev => [...prev, data]);
          
          // Show browser notification if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(data.data.message || 'New Update', {
              body: data.data.message,
              icon: '/us-bakers-logo.jpg',
              badge: '/us-bakers-logo.jpg'
            });
          }
          
          // Play sound for important events
          if (['order_created', 'payment_received', 'order_status_changed'].includes(data.event)) {
            playNotificationSound();
          }
        } catch (err) {
          console.error('Failed to parse notification:', err);
        }
      });

      eventSource.addEventListener('ping', () => {
        // Heartbeat received, connection alive
        console.log('❤️ Heartbeat');
      });

      eventSource.onerror = (err) => {
        console.error('❌ Notification stream error:', err);
        setIsConnected(false);
        eventSource.close();

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          setError('Failed to connect to notification stream. Please refresh the page.');
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to establish notification connection');
    }
  }, [token, BACKEND_URL]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsConnected(false);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return {
    notifications,
    isConnected,
    error,
    clearNotifications,
    markAsRead,
    reconnect: connect
  };
};

/**
 * Play notification sound
 */
const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.log('Could not play notification sound:', err);
    });
  } catch (err) {
    console.log('Notification sound not available');
  }
};

/**
 * Show desktop notification
 */
export const showDesktopNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    return new Notification(title, {
      icon: '/us-bakers-logo.jpg',
      badge: '/us-bakers-logo.jpg',
      ...options
    });
  }
};
