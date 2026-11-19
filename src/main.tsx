import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initMobileShell} from './utils/platform';

void initMobileShell();

createRoot(document.getElementById('root')!).render(<App />);
