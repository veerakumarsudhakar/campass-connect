import React from 'react';
import { createRoot } from 'react-dom/client';
import { CampusPassApp } from './App';
import './styles.css';
import './watermark.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CampusPassApp />
    <div className="developer-watermark">Developed by Sudhakar--Veerakumar</div>
  </React.StrictMode>
);
