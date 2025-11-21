import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import AuthPanel from './components/AuthPanel';
import BetCard from './components/BetCard';
import ComboBetCard from './components/ComboBetCard';
import AdminPanel from './components/AdminPanel';
import HistoryTable from './components/HistoryTable';
import Navbar from './components/Navbar';
import PaymentModal from './components/PaymentModal';
import Casino from './components/Casino';
import { api } from './services/api';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, loading: authLoading, logout, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [openBets, setOpenBets] = useState([]);
  const [activeTickets, setActiveTickets] = useState([]);
  const [history, setHistory] = useState([]);
  const [adminBets, setAdminBets] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);

  const isAdmin = Boolean(user?.is_admin);

  const balance = useMemo(
    () => new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF' }).format(user?.balance ?? 0),
    [user],
  );

  const settledHistory = history.filter((bet) => bet.status !== 'PENDING');

  const loadData = useCallback(async () => {
    if (!user) return;
    setGlobalLoading(true);
    try {
      const requests = [
        api.get('/bets'),
        api.get('/bets/me/history'),
        api.get('/bets/me/active'),
      ];
      if (isAdmin) {
        requests.push(api.get('/bets/admin'));
      }
      const [betsRes, historyRes, activeRes, adminRes] = await Promise.all(requests);
      setOpenBets(betsRes.data.bets);
      setHistory(historyRes.data.bets);
      setActiveTickets(activeRes.data.bets);
      setAdminBets(isAdmin ? adminRes.data.bets : []);
    } finally {
      setGlobalLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') {
      setActiveTab('home');
    }
  }, [isAdmin, activeTab]);

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3500);
  };

  const handlePlaceBet = async (betId, outcomeId, stake) => {
    const response = await api.post(`/bets/${betId}/place`, { outcome_id: outcomeId, stake });
    await refreshProfile();
    await loadData();
    showToast(response.data.message || 'Fogadás leadva');
  };

  const handleCreateBet = async (payload) => {
    const response = await api.post('/bets', payload);
    showToast(`Fogadás létrehozva: ${response.data.bet.title}`);
    await loadData();
  };

  const handleCloseBet = async (betId, outcomeId) => {
    await api.post(`/bets/${betId}/close`, { outcome_id: outcomeId });
    showToast('Fogadás lezárva');
    await loadData();
  };

  const handlePaymentRequest = (type) => {
    setPaymentModal(type);
  };

  const handlePaymentSuccess = (message) => {
    showToast(message);
    refreshProfile();
  };

  if (authLoading) {
    return (
      <div className="page centered">
        <div className="loader" />
        <p>Betöltés...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page hero">
        <AuthPanel />
      </div>
    );
  }

  const renderHome = () => (
    <section className="home-hero">
      <div className="hero-copy">
        <p className="eyebrow">Szia {user.username}</p>
        <h1>Fogadj okosan, kövesd professzionális dashboardon.</h1>
        <p>
          Válts a tabok között, hogy gyorsan megtaláld az aktív fogadásaidat, nézd meg a naplót vagy kezeld az eseményeket
          admin módban.
        </p>
      </div>
      <div className="hero-stats">
        <div>
          <p className="muted-small">Egyenleg</p>
          <strong>{balance}</strong>
        </div>
        <div>
          <p className="muted-small">Aktív fogadások</p>
          <strong>{activeTickets.length}</strong>
        </div>
        <div>
          <p className="muted-small">Lezárt napló</p>
          <strong>{settledHistory.length}</strong>
        </div>
      </div>
    </section>
  );

  const renderBetGrid = () => (
    <section>
      <div className="bet-grid">
        {openBets.length ? (
          openBets.map((bet) => (
            <BetCard key={bet.id} bet={bet} onPlaceBet={handlePlaceBet} disabled={globalLoading} />
          ))
        ) : (
          <div className="empty-state">Nincsenek nyitott fogadások. Nézz vissza később vagy hozz létre egyet!</div>
        )}
      </div>
    </section>
  );

  const renderCombo = () => (
    <section>
      {openBets.length >= 2 ? (
        <ComboBetCard
          bets={openBets}
          onSuccess={(msg) => {
            showToast(msg);
            refreshProfile();
            loadData();
          }}
        />
      ) : (
        <div className="empty-state">Legalább 2 nyitott fogadás szükséges a kötéses fogadáshoz.</div>
      )}
    </section>
  );

  const renderActive = () => <HistoryTable bets={activeTickets} variant="active" />;
  const renderHistory = () => <HistoryTable bets={settledHistory} variant="history" />;

  const renderAdmin = () =>
    isAdmin ? <AdminPanel bets={adminBets} onCreate={handleCreateBet} onClose={handleCloseBet} /> : null;

  const renderCasino = () => (
    <Casino
      user={user}
      onBalanceUpdate={async (newBalance) => {
        // Közvetlenül frissítjük az egyenleget, ne hívjuk meg a refreshProfile()-t,
        // mert az újra lekéri az adatbázisból az egyenleget, ami már tartalmazza a nyereményt is
        // Csak az animáció végén hívjuk meg, amikor a nyereményt is hozzáadjuk
        await refreshProfile();
      }}
    />
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHome();
      case 'bets':
        return renderBetGrid();
      case 'combo':
        return renderCombo();
      case 'active':
        return renderActive();
      case 'history':
        return renderHistory();
      case 'admin':
        return renderAdmin();
      case 'casino':
        return renderCasino();
      default:
        return renderHome();
    }
  };

  return (
    <div className="page dashboard">
      <Navbar
        active={activeTab}
        onChange={setActiveTab}
        user={user}
        onLogout={logout}
        onPaymentRequest={handlePaymentRequest}
      />
      {globalLoading && (
        <div className="inline-loader">
          <div className="loader tiny" />
          <span>Frissítés...</span>
        </div>
      )}
      <div className="content-area">{renderContent()}</div>
      {toast && (
        <div className={`toast ${toast.variant}`}>
          <p>{toast.message}</p>
        </div>
      )}
      {paymentModal && (
        <PaymentModal
          type={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

export default App;
