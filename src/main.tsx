import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import PasswordGate from './components/auth/PasswordGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordGate>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </PasswordGate>
  </StrictMode>
);
