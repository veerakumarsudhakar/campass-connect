import React from 'react';
import { AcademicCatalogProvider } from './academic-catalog';
import { createRoot } from 'react-dom/client';
import { CampusPassApp } from './App';
import './styles.css';
import './watermark.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AcademicCatalogProvider><CampusPassApp /></AcademicCatalogProvider>
    <div className="developer-watermark">Developed by Sudhakar--Veerakumar</div>
  </React.StrictMode>
);
