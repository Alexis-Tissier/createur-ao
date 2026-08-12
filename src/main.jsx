import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './AppV4.jsx';
import './styles.css';
import './styles-v4.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
