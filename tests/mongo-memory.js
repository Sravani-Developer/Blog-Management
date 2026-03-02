const { MongoMemoryServer } = require("mongodb-memory-server");
const { connectDB, disconnectDB } = require("../config/db");

let mongoServer = null;

const startTestDatabase = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectDB(uri);
};

const clearCollections = async (models) => {
  await Promise.all(models.map((model) => model.deleteMany({})));
};

const stopTestDatabase = async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

module.exports = {
  startTestDatabase,
  clearCollections,
  stopTestDatabase
};
