import React from 'react'; // we import react
import ReactDOM from 'react-dom/client'; // we import react dom for rendering
import App from './App'; // we import our main app component

// we render the app component to the root element in html
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode> {/* we use strict mode to highlight potential problems */}
    <App />
  </React.StrictMode>
);
