import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
