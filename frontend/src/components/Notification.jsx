import { useEffect, useState } from 'react';

export default function Notification({ message, type, duration = 4000, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          if (onClose) onClose();
        }, 300); // Várunk az animációra
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  const isWin = type === 'win' || message.includes('GRATULÁLOK') || message.includes('Gratulálok') || message.includes('🎉');

  return (
    <div className={`notification-overlay ${visible ? 'visible' : ''}`}>
      <div className={`notification ${isWin ? 'notification-win' : 'notification-lose'}`}>
        <div className="notification-content">
          {message}
        </div>
      </div>
    </div>
  );
}

