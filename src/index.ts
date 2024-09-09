import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use(bodyParser.json());
app.use('/api/v1', routes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
