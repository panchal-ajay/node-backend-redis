const express = require("express");
const mongoose = require("mongoose");

const app = express();

const PORT = 3001;

let redisConnect = require("redis");
console.log("redis",redisConnect)
const redisClient = redisConnect.createClient({
  url: "redis://127.0.0.1:6379",
});

redisClient.connect().catch(console.error);

redisClient.on("connect", () => {
  console.log("Redis connected successfully");
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Middleware to parse JSON bodies
app.use(express.json());

const mongoURI = "mongodb://127.0.0.1:27017/userdb"; // Replace with your MongoDB URI
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Define the User schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// Middleware to parse JSON bodies
app.use(express.json());

app.post("/user", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "User ID and name are required" });
  }

  // const keyName = `user:${name}`;

  try {
    // First, store in MongoDB
    const newUser = new User({ name });
    await newUser.save();

    // Then, clone in Redis
    let result = { id: newUser._id, name };
    // await redisClient.set(keyName, JSON.stringify(result), { EX: 30 });

    res.status(200).json(result);
  } catch (err) {
    console.error("Operation error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/user/:id", async (req, res) => {
  const { id } = req.params;
  const keyName = `user:${id}`;

  try {
    // Check Redis cache first
    let cachedUser = await redisClient.get(keyName);

    if (cachedUser) {
      let user = JSON.parse(cachedUser);
      console.log("GET from Redis:", user);
      res.status(200).json(user);
    } else {
      // Fetch user from MongoDB by _id
      const user = await User.findById(id);

      if (user) {
        console.log("GET from MongoDB:", user);
        // Store user in Redis cache
        await redisClient.set(keyName, JSON.stringify(user), { EX: 30 });
        res.status(200).json(user);
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  } catch (err) {
    console.error("Operation error:", err);
    res.status(500).send("Internal Server Error");
  }
});
// app.get("/users", async (req, res) => {
//   try {
//     const users = await User.find(); // Fetch all users from MongoDB
//     console.log("Users retrieved from MongoDB:", users);

//     // Prepare keys and values for Redis storage
//     const redisOperations = [];
//     const userKeys = [];

//     for (const user of users) {
//       const keyName = `user:${user._id}`;
//       redisOperations.push(["set", keyName, JSON.stringify(user)]);
//       userKeys.push(keyName);
//     }

//     // Store all users in Redis
//     // await redisClient.multi(redisOperations).exec();
//     // await redisClient.sAdd("userKeys", userKeys);

//     res.status(200).json(users);
//   } catch (err) {
//     console.error("Error fetching or storing users:", err);
//     res.status(500).send("Internal Server Error");
//   }
// });

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
