const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('./env');

// ===============
// Database Config
// ===============
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;
const mongoosePromise = mongoose.connect(env.MONGO_URL, {useNewUrlParser: true, useUnifiedTopology: true});
mongoosePromise.catch((reason) => {console.log(reason)});

// =======
// Schemas
// =======

// User
const usersSchema = new Schema({
    email: String,
    password: String,
    company_id: Schema.ObjectId,
    created: { type: Date, default: Date.now }
  },
  { strict: false }
);

usersSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8));
};

usersSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

// Vouchers
const vouchersSchema = new Schema({
  code: { type: String, unique: true },
  points: Number,
  validated: Boolean,
  reward_id: Schema.ObjectId,
  company_id: Schema.ObjectId,
  user_id: Schema.ObjectId,
  expiration_date: Date,
  created: { type: Date, default: Date.now },
},
{ strict: false }
);

vouchersSchema.pre('save', function(next) {
  if(typeof this.code === 'undefined' || !this.code) {
    this.code = Math.random().toString(36).substring(7).toUpperCase();
  }
  next();
});

// Rewards
const rewardsSchema = new Schema({
  name: String,
  description: String,
  points: Number,
  images: [String],
  stock: Number,
  company_id: Schema.ObjectId,
  user_id: Schema.ObjectId,
  created: { type: Date, default: Date.now },
},
{ strict: false }
);

// Companies
const companiesSchema = new Schema({
  name: String,
  logo: String,
  locations: [{
    name: String,
    address: String,
  }],
  parent: Schema.ObjectId,
  created: { type: Date, default: Date.now },
},
{ strict: false }
);

const models = {};
models.Users = mongoose.model('users', usersSchema);
models.Vouchers = mongoose.model('vouchers', vouchersSchema);
models.Rewards = mongoose.model('rewards', rewardsSchema);
models.Companies = mongoose.model('companies', companiesSchema);

module.exports = models;
