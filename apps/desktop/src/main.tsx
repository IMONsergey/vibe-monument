import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ReviewShipLayer } from './review/ReviewShipLayer';
import './styles/product.css';
import './styles/protocol.css';
import './styles/preview.css';
import './styles/evidence.css';
import './styles/browser-evidence.css';
import './styles/timeline.css';
import './styles/queue.css';
import './styles/ship.css';
import './styles/review-ship-layer.css';

const root = document.getElementById('root');
if (!root) throw new Error('Monument root element is missing');

createRoot(root).render(
  <>
    <App />
    <ReviewShipLayer />
  </>,
);
