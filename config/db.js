const mongoose = require("mongoose");

const connectDB = async (overrideUri) => {
  const uri = overrideUri || process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI is not set. Database connection skipped.");
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB disconnected (SIGINT)");
      process.exit(0);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log("MongoDB disconnected");
  }
};

module.exports = { connectDB, disconnectDB };
