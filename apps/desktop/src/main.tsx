import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/product.css';

const root = document.getElementById('root');
if (!root) throw new Error('Monument root element is missing');

createRoot(root).render(<App />);
