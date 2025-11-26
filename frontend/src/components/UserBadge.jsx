import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function UserBadge({ userId, size = 'medium' }) {
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadBadge = async () => {
      try {
        const response = await api.get('/payments/badge');
        setBadgeData(response.data);
      } catch (err) {
        console.error('Failed to load badge:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBadge();
  }, [userId]);

  if (loading || !badgeData) {
    return null;
  }

  const { badge, totalDeposits, nextBadge } = badgeData;

  const getBadgeInfo = (badgeType) => {
    switch (badgeType) {
      case 'ADMIN':
        return { emoji: '👑', name: 'Admin', color: '#FF6B6B', bgColor: 'rgba(255, 107, 107, 0.2)' };
      case 'GOLD':
        return { emoji: '🥇', name: 'Gold', color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.2)' };
      case 'SILVER':
        return { emoji: '🥈', name: 'Silver', color: '#C0C0C0', bgColor: 'rgba(192, 192, 192, 0.2)' };
      case 'BRONZE':
        return { emoji: '🥉', name: 'Bronze', color: '#CD7F32', bgColor: 'rgba(205, 127, 50, 0.2)' };
      default:
        return null;
    }
  };

  const badgeInfo = badge ? getBadgeInfo(badge) : null;
  const sizeClass = `badge-${size}`;

  if (!badge) {
    return (
      <div className={`user-badge ${sizeClass} no-badge`} title={`Befizetve: ${totalDeposits.toLocaleString('hu-HU')} HUF`}>
        <span className="badge-emoji">⭐</span>
        <span className="badge-text">Újonc</span>
        {nextBadge && (
          <span className="badge-progress">
            {nextBadge.remaining > 0 ? `${nextBadge.remaining.toLocaleString('hu-HU')} HUF` : ''} a következő badge-hez
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`user-badge ${sizeClass}`}
      style={{
        borderColor: badgeInfo.color,
        background: badgeInfo.bgColor,
      }}
      title={`${badgeInfo.name} badge - Befizetve: ${totalDeposits.toLocaleString('hu-HU')} HUF`}
    >
      <span className="badge-emoji">{badgeInfo.emoji}</span>
      <span className="badge-text" style={{ color: badgeInfo.color }}>
        {badgeInfo.name}
      </span>
      {nextBadge && nextBadge.remaining > 0 && (
        <span className="badge-progress">
          {nextBadge.remaining.toLocaleString('hu-HU')} HUF a {nextBadge.name} badge-hez
        </span>
      )}
    </div>
  );
}

