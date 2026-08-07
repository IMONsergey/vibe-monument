import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/product.css';
import './styles/protocol.css';
import './styles/preview.css';

const root = document.getElementById('root');
if (!root) throw new Error('Monument root element is missing');

createRoot(root).render(<App />);
