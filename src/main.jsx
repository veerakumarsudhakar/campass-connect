import React from 'react';
import { createRoot } from 'react-dom/client';
import { CampusPassApp } from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><CampusPassApp /></React.StrictMode>);
