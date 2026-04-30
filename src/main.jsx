import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'   // ← 建議保留這行
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)