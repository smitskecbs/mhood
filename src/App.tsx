import { SolanaProviders } from './app/providers';
import { ForestApp } from './app/ForestApp';

export default function App() {
  return (
    <SolanaProviders>
      <ForestApp />
    </SolanaProviders>
  );
}
