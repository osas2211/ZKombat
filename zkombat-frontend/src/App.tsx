import { Routes, Route, Outlet } from 'react-router-dom';
import { config } from './config';
import { Layout } from './components/Layout';
import { useWallet } from './hooks/useWallet';
import { ZkombatGame } from './games/zkombat/ZkombatGame';

const GAME_ID = 'zkombat';
const GAME_TITLE = import.meta.env.VITE_GAME_TITLE || 'Zkombat';
const GAME_TAGLINE = import.meta.env.VITE_GAME_TAGLINE || 'On-chain game on Stellar';

function AppLayout() {
  return (
    <Layout title={GAME_TITLE} subtitle={GAME_TAGLINE}>
      <Outlet />
    </Layout>
  );
}

function HomePage() {
  const { publicKey, isConnected, isConnecting, error, isDevModeAvailable } = useWallet();
  const userAddress = publicKey ?? '';
  const contractId = config.contractIds[GAME_ID] || '';
  const hasContract = contractId && contractId !== 'YOUR_CONTRACT_ID';
  const devReady = isDevModeAvailable();

  if (!hasContract) {
    return (
      <div className="card">
        <h3 className="gradient-text">Contract Not Configured</h3>
        <p style={{ color: 'var(--color-ink-muted)', marginTop: '1rem' }}>
          Run <code>bun run setup</code> to deploy and configure testnet contract IDs, or set
          <code>VITE_ZKOMBAT_CONTRACT_ID</code> in the root <code>.env</code>.
        </p>
      </div>
    );
  }

  if (!devReady) {
    return (
      <div className="card">
        <h3 className="gradient-text">Dev Wallets Missing</h3>
        <p style={{ color: 'var(--color-ink-muted)', marginTop: '0.75rem' }}>
          Run <code>bun run setup</code> to generate dev wallets for Player 1 and Player 2.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="card">
        <h3 className="gradient-text">Connecting Dev Wallet</h3>
        <p style={{ color: 'var(--color-ink-muted)', marginTop: '0.75rem' }}>
          The dev wallet switcher auto-connects Player 1. Use the switcher to toggle players.
        </p>
        {error && <div className="notice error" style={{ marginTop: '1rem' }}>{error}</div>}
        {isConnecting && <div className="notice info" style={{ marginTop: '1rem' }}>Connecting...</div>}
      </div>
    );
  }

  return (
    <ZkombatGame
      userAddress={userAddress}
      currentEpoch={1}
      availablePoints={1000000000n}
      onStandingsRefresh={() => {}}
      onGameComplete={() => {}}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>
  );
}
