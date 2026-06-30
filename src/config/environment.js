const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  oneSpanApiKey: process.env.ONESPAN_API_KEY,
  oneSpanApiUrl: process.env.ONESPAN_API_URL
};