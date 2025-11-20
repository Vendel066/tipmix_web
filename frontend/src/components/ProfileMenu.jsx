import { useState } from 'react';

export default function ProfileMenu({ user, onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);

  const initials = user?.username?.slice(0, 2)?.toUpperCase() || 'US';

  const handleNavigate = (target) => {
    onNavigate?.(target);
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    onLogout?.();
  };

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="profile-chip"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="avatar">{initials}</span>
        <div>
          <strong>{user?.username}</strong>
          <p>{user?.email}</p>
        </div>
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="profile-dropdown" role="menu">
          <button type="button" onClick={() => handleNavigate('home')}>
            Kezdőlap
          </button>
          <button type="button" onClick={() => handleNavigate('active')}>
            Aktív fogadások
          </button>
          <button type="button" onClick={() => handleNavigate('history')}>
            Napló
          </button>
          <hr />
          <button type="button" className="danger" onClick={handleLogout}>
            Kijelentkezés
          </button>
        </div>
      )}
    </div>
  );
}

