import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Server is running',
    time: new Date().toISOString(),
    openai: process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('API available at:', `http://localhost:${PORT}/api/health`);
});
