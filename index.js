const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('cookie-session');
const apolloServer = require('./apollo');
const env = require('./env');
const aws = require('./aws');

// ==============
// Initial Config
// ==============
const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
apolloServer.applyMiddleware({ app })
app.use('/graphql', () => {})

// ====
// CORS
// ====
app.use((req, res, next) => {
  const allowedOrigins = [];

  allowedOrigins.forEach(origin => {
    res.header('Access-Control-Allow-Origin', origin);
  })

  if(app.settings.env !== 'production') res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
	res.header("Access-Control-Allow-Headers", "Authorization, Origin, X-Requested-With, Content-Type, Accept");
	next();
});

// ==========
// Middleware
// ==========
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/static', express.static('static/'));
app.use(session({secret: env.PASSPORT_SECRET}));
app.use(passport.initialize());

// ====
// Auth
// ====
require('./auth/strategies')(passport);
app.use('/auth', require('./auth/routes')(passport));

// ===
// API
// ===
app.post('/aws/s3/sign', aws.sign_s3);

// ===================
// Production Settings
// ===================
if(app.settings.env === 'production') {
	app.use(express.static('./client/build'));
  app.post('*', function (req, res) {
    res.sendFile('./client/build/index.html', {"root": __dirname});
  });
}

// ======
// Server
// ======
server.listen(port, () => console.log(`Listening on port ${port}, ${apolloServer.graphqlPath}`));
module.exports = app;
