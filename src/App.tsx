import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import ChatPage from './screens/Chat/ChatPage';
import SettingsPage from './screens/Settings/SettingsPage';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AppThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function AppContent() {
  const { theme, themeMode } = useTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={themeMode === 'dark' ? 'dark' : 'light'}
      />
      <Router>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Legacy routes for backward compatibility - redirect to unified settings */}
          <Route path="/mcp-settings" element={<SettingsPage />} />
          <Route path="/server-config" element={<SettingsPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
}
