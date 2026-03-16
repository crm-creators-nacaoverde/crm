import { useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/feature/AppLayout';
import ClientsSection from './components/ClientsSection';
import InteractionsSection from './components/InteractionsSection';
import MetricsSection from './components/MetricsSection';
import SettingsSection from './components/SettingsSection';
import KanbanSection from './components/KanbanSection';
import SystemTour from '../../components/feature/SystemTour';

export default function Home() {
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'kanban';

  const renderSection = () => {
    switch (section) {
      case 'clients':
        return <ClientsSection />;
      case 'interactions':
        return <InteractionsSection />;
      case 'metrics':
        return <MetricsSection />;
      case 'settings':
        return <SettingsSection />;
      case 'kanban':
        return <KanbanSection />;
      default:
        return <KanbanSection />;
    }
  };

  return (
    <AppLayout>
      {renderSection()}
      <SystemTour />
    </AppLayout>
  );
}
