const http = require('http');
const gameData = {
  name: 'Jogo com Video',
  image_url: 'https://picsum.photos/300',
  alt_text: 'Test',
  tags: ['Ação'],
  rating: 4.5,
  category: 'acao',
  embed: '<iframe width=\"560\" height=\"315\" src=\"https://www.youtube.com/embed/dQw4w9WgXcQ\" frameborder=\"0\" allowfullscreen></iframe>'
};
const data = JSON.stringify(gameData);
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/games?email=admin@teste.com',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
};
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});
req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();
