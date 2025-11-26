import SimpleBetCard from './SimpleBetCard';

export default function BetDetailsModal({ open, onClose, detailBets, onPlaceBet, disabled }) {
  if (!open || !detailBets.length) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          maxWidth: '1200px',
          width: '100%',
          position: 'relative',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            transition: 'all 0.2s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.transform = 'rotate(90deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.transform = 'rotate(0deg)';
          }}
        >
          ×
        </button>

        <div style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              marginBottom: '0.5rem',
              fontSize: '2rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Részlet fogadások
          </h2>
          <p style={{ color: 'rgba(226, 232, 240, 0.6)', fontSize: '0.95rem' }}>
            Ezek külön fogadások, amikkel külön-külön vagy kötésben is lehet fogadni
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {detailBets.map((bet) => (
            <SimpleBetCard key={bet.id} bet={bet} onPlaceBet={onPlaceBet} disabled={disabled} />
          ))}
        </div>
      </div>
    </div>
  );
}

