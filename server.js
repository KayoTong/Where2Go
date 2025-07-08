const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Sample restroom data
const restrooms = [
  {
    id: 1,
    name: 'Central Park Restroom',
    address: '123 Park Ave, Cityville',
    lat: 40.785091,
    lng: -73.968285
  },
  {
    id: 2,
    name: 'Downtown Public Toilet',
    address: '456 Main St, Cityville',
    lat: 40.712776,
    lng: -74.005974
  },
  {
    id: 3,
    name: 'Mall Restroom',
    address: '789 Shopping Blvd, Cityville',
    lat: 40.758896,
    lng: -73.985130
  }
];

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// API endpoint to get restrooms
app.get('/api/restrooms', (req, res) => {
  res.json(restrooms);
});

// Serve the finder.html file
app.get('/finder', (req, res) => {
  res.sendFile(__dirname + '/finder.html');
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Finder page available at http://localhost:${PORT}/finder`);
}); 