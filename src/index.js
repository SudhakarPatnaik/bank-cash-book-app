
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import ExcelViewer from './components/ExcelViewer';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ExcelViewer />
  </React.StrictMode>
);
