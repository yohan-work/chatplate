import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CustomerApp } from './app/CustomerApp';
import './styles/tokens.css';
import './styles/global.css';
import './styles/widget.css';
import './styles/customer.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomerApp />
  </StrictMode>,
);
