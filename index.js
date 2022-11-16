const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

//used for dotenv purpose
require("dotenv").config();

//midle ware
app.use(cors());
app.use(express.json());

//this function is used for all MongoDB works inside the try section.
async function run() {
  try {
  } finally {
  }
}

//call the run function
run().catch((error) => console.error(error));

//basic testing API
app.get("/", (req, res) => {
  res.send("Doctors portal server is running");
});

//app listen API
app.listen(port, () => console.log("server is running on port:", port));
