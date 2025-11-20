import ProfileMenu from './ProfileMenu';

const baseNavItems = [
  { key: 'home', label: 'Home' },
  { key: 'bets', label: 'Fogadások' },
  { key: 'active', label: 'Aktív fogadások' },
  { key: 'history', label: 'Napló' },
];

export default function Navbar({ active, onChange, user, onLogout }) {
  const items = baseNavItems;
  const isAdmin = Boolean(user?.is_admin);

  return (
    <nav className="app-navbar">
      <div className="logo-mark">
        <span>Tipmix Pro</span>
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
        {isAdmin && (
          <button
            type="button"
            className={active === 'admin' ? 'active' : ''}
            onClick={() => onChange('admin')}
          >
            Admin
          </button>
        )}
      </div>
      <ProfileMenu user={user} onLogout={onLogout} onNavigate={onChange} />
    </nav>
  );
}

