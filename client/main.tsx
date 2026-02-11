/**
 * OpenSpatial - SolidJS Entry Point
 */
import { render } from 'solid-js/web';
import { App } from './App';
import './base.css';

// Mark body as loaded to trigger CSS transition
document.body.classList.add('loaded');

const root = document.getElementById('app');
if (!root) throw new Error('Root element #app not found');

render(() => <App />, root);
