import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ReactKeycloakProvider } from '@react-keycloak/web'; // <-- NUEVO
import keycloak from './keycloak.js'; // <-- NUEVO

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolvemos toda la App con el Provider.
      Le pasamos nuestra instancia 'keycloak' que acabamos de configurar.
    */}
    <ReactKeycloakProvider authClient={keycloak}>
      <App />
    </ReactKeycloakProvider>
  </React.StrictMode>,
);