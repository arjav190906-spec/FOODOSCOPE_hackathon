require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.static('public'));

// /api/... ki har request Foodoscope ko forward hoti hai (key server par safe rehti hai)
app.use('/api', async (req, res) => {
  if (!process.env.FOODOSCOPE_BASE_URL) {
    return res.status(503).json({ error: 'FOODOSCOPE_BASE_URL not set in .env' });
  }
  const url = process.env.FOODOSCOPE_BASE_URL + req.url;
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.FOODOSCOPE_API_KEY}` }
      // Agar docs mein x-api-key likha ho to upar ki line aise badlein:
      // headers: { 'x-api-key': process.env.FOODOSCOPE_API_KEY }
    });
    const text = await r.text();
    res.status(r.status).type('json').send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('Open http://localhost:3000'));