import { useMemo } from 'react';
import ProfileMenu from './ProfileMenu';

const baseNavItems = [
  { key: 'home', label: 'Home' },
  { key: 'bets', label: 'Fogadások' },
  { key: 'casino', label: 'Kaszinó' },
  { key: 'investment', label: 'Befektetés' },
];

export default function Navbar({ active, onChange, user, onLogout, onPaymentRequest, onTransferRequest }) {
  const items = baseNavItems;
  const isAdmin = Boolean(user?.is_admin);

  const balance = useMemo(
    () => new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(user?.balance ?? 0),
    [user?.balance],
  );

  return (
    <nav className="app-navbar">
      <div className="logo-mark">
        <span>MixMix Pro</span>
      </div>
      <div className="nav-links">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={active === item.key ? 'active' : ''}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="navbar-right">
        <div className="balance-display">
          <span className="balance-label">Egyenleg</span>
          <strong className="balance-amount">{balance}</strong>
        </div>
        <ProfileMenu
        user={user}
        onLogout={onLogout}
        onNavigate={onChange}
        onPaymentRequest={() => onPaymentRequest?.('withdraw')}
        onDepositRequest={() => onPaymentRequest?.('deposit')}
        onTransferRequest={onTransferRequest}
      />
      </div>
    </nav>
  );
}

