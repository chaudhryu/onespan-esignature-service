const express = require('express');
const cors = require('cors');
const { port } = require('./config/environment');
const packageRoutes = require('./routes/packageRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Register API Routes
app.use('/api/v1/packages', packageRoutes);

app.listen(port, () => {
  console.log(`E-Signature microservice running on port ${port}`);
});