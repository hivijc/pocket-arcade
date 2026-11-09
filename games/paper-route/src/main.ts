import './style.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (ctx) {
  ctx.fillStyle = '#9fd8ee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
