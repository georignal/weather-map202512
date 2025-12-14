import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// Ensure Leaflet CSS is loaded via JS import for compatibility across setups
import 'leaflet/dist/leaflet.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // 开发时可以暂时注释掉 StrictMode 来测试
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
