const { ApolloServer, gql } = require('apollo-server-express');
const models = require('./models');

const typeDefs = gql`
	type User {
    _id: ID
		name: String
    email: String
    company: Company
  }
  type Voucher {
    _id: ID
    code: String
    points: Int
    validated: Boolean
    reward: Reward
    company: Company
    user: User
    expiration_date: String
    created: String
  }
  type Reward {
    _id: ID
    name: String
    description: String
    points: Int
    images: [String]
    stock: Int
    company: Company
    user: User
    created: String
  }
  type Company {
    _id: ID
    name: String
    logo: String
    locations: [Location]
    parent: Company
    created: String
  }

  type Location {
    name: String
    address: String
  }
  
  type Query {
    users(user: UserInput): [User]
    user(_id: ID): User
    vouchers(voucher: VoucherInput): [Voucher]
    voucher(_id: ID): Voucher
    rewards(reward: RewardInput): [Reward]
    reward(_id: ID): Reward
    companies(company: CompanyInput): [Company]
    company(_id: ID): Company
  }

  type Mutation {
    addVoucher(voucher: VoucherInput): Voucher
    editVoucher(voucher: VoucherInput): Voucher
    removeVoucher(voucher: VoucherInput): Voucher

    addReward(reward: RewardInput): Reward
    editReward(reward: RewardInput): Reward
    removeReward(reward: RewardInput): Reward

    addCompany(company: CompanyInput): Company
    editCompany(company: CompanyInput): Company
    removeCompany(company: CompanyInput): Company
  }

  input UserInput {
    _id: ID
		name: String
    email: String
    company_id: ID
  }
  input VoucherInput {
    _id: ID
    code: String
    points: Int
    points_lte: Int
    validated: Boolean
    reward_id: ID
    company_id: ID
    user_id: ID
    expiration_date: String
    created: String
  }
  input RewardInput {
    _id: ID
    name: String
    points: Int
    points_lte: Int
    description: String
    images: [String]
    stock: Int
    stock_gte: Int
    company_id: ID
    user_id: ID
    created: String
  }
  input CompanyInput {
    _id: ID
    name: String
    logo: String
    locations: [LocationInput]
    parent_id: ID
    created: String
  }
  input LocationInput {
    name: String,
    address: String,
  }
`;

const globalConfig = {
  models: {
    Company: {
      plural: 'Companies'
    }
  }
}

// ==================
// Auxiliar Functions
// ==================

const prepare = (obj) => {
  if(obj) {
    obj = obj.toObject()
  obj._id = String(obj._id)
  return obj
  } else {
    return null
  }
}

const getModelPluralName = (ModelName) => {
  return globalConfig.models && globalConfig.models[ModelName] && globalConfig.models[ModelName].plural ?
    globalConfig.models[ModelName].plural : `${ModelName}s`
}

const getInfo = (info, config = {}) => {
  const ModelName = info.returnType.toString().replace('[','').replace(']','')
  const modelName = ModelName.replace(/^\w/, c => c.toLowerCase());
  
  const Model = models[getModelPluralName(ModelName)]

  const ParentName = info.parentType.toString()
  const parentName = ParentName.replace(/^\w/, c => c.toLowerCase());
  const ParentModel = models[getModelPluralName(ParentName)]

  const isCollection = info.returnType.toString().indexOf('[') >=0
  
  return { Model, modelName, ParentModel, parentName, isCollection }
}

const linkToParent = config => async (parent, args, context, info) => {
  if(!config) config = {
    habtm: false
  }
  const { Model, modelName, parentName, isCollection } = getInfo(info)

  if(config.habtm) {
    let field = Object.keys(Model.schema.obj).find(field => field === `${parentName}_ids`)
    if(typeof field === 'undefined') {
      const possibleValues = parent[`${config.fieldName ? config.fieldName : modelName+'_ids' }`];
      return (await Model.find({ '_id': { $in: possibleValues } }).exec()).map(prepare)
    }
  }
  return isCollection ?
    (await Model.find({[`${parentName}_id${config.habtm ? 's' : ''}`]: parent._id}).exec()).map(prepare) :
    prepare(await Model.findOne({_id: parent[`${modelName}_id`]}))
}

const linkToModel = config => async (parent, args, context, info) => {
  const { Model, modelName, isCollection } = getInfo(info, config)
  
  if(typeof args[modelName] !== 'undefined')
    args = args[modelName];

  Object.keys(args).map(key => {
    if(key.includes('_ids') && Array.isArray(args[key])) {
      args[key] = { $all: args[key]}
    }

    // If we pass, for instance, points_lte: 4, turns it to points: { $lte: 4 }
    if(key.endsWith('_lte')) {
      args[key.split('_lte')[0]] = { $lte: args[key]}
      delete args[key];
    }

    if(key.endsWith('_gte')) {
      args[key.split('_gte')[0]] = { $gte: args[key]}
      delete args[key];
    }

  });

  console.log(args);

  return isCollection ?
    (await Model.find(args).exec()).map(prepare) :
    prepare(await Model.findOne(args).exec())
}

const addMutation = (config) => async (parent, args, context, info) => {
  const Model = config.model;
  const model = Model.replace(/^\w/, c => c.toLowerCase());
  
  if (config.multiple) {
    console.log(getModelPluralName(Model));
    const res = (await models[getModelPluralName(Model)].insertMany(args[`${model}s`])).map(prepare);
    if(typeof config.postHook === 'function') config.postHook(args[`${model}s`]);
    return res;

  } else {
    const res = prepare(await models[getModelPluralName(Model)].create(args[model]));
    if(typeof config.postHook === 'function') config.postHook(args[model]);
    return res;
  }

  
}

const editMutation = (config) => async (parent, args, context, info) => {
  const Model = config.model;
  const model = Model.replace(/^\w/, c => c.toLowerCase());
  const {_id} = args[model];
  const setArgs = { ...args[model]}
  delete setArgs._id
  await models[getModelPluralName(Model)].update({_id}, {$set: setArgs})
  return prepare(await models[getModelPluralName(Model)].findOne({_id}).exec())
}

const removeMutation = (config) => async (parent, args, context, info) => {
  const Model = config.model;
  const model = Model.replace(/^\w/, c => c.toLowerCase());
  const {_id} = args[model];
  await models[getModelPluralName(Model)].remove({_id}).exec()
  return {_id};
}

// =========
// Resolvers
// =========

const resolvers = {
  // ============
  // Custom Types
  // ============
  User: {
    company: linkToParent(),
  },
  Voucher: {
    reward: linkToParent(),
    company: linkToParent(),
  },
  Reward: {
    company: linkToParent(),
    user: linkToParent(),
  },
  Company: {
    parent: linkToParent({fieldName: 'parent'}),
  },
  
  // =====
  // Query
  // =====
  Query: {
		users: linkToModel(),
    user: linkToModel(),

    vouchers: linkToModel(),
    voucher: linkToModel(),

    rewards: linkToModel(),
    reward: linkToModel(),

    companies: linkToModel(),
    company: linkToModel(),
  },

  // ========
  // Mutation
  // ========
  Mutation: {
    addVoucher: addMutation({model: 'Voucher'}),
    editVoucher: editMutation({model: 'Voucher'}),
    removeVoucher: removeMutation({model: 'Voucher'}),

    addReward: addMutation({model: 'Reward'}),
    editReward: editMutation({model: 'Reward'}),
    removeReward: removeMutation({model: 'Reward'}),

    addCompany: addMutation({model: 'Company'}),
    editCompany: editMutation({model: 'Company'}),
    removeCompany: removeMutation({model: 'Company'}),
  }
};

const apolloServer = new ApolloServer({ typeDefs, resolvers, playground: {
	settings: {'editor.cursorShape': 'line'}
}});

module.exports = apolloServer;