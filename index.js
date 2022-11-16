const express = require("express");
const cors = require("cors");
const app = express();

//get from mongodb or used for mongodb
const { MongoClient, ServerApiVersion } = require("mongodb");

//port for run server
const port = process.env.PORT || 5000;

//used for dotenv purpose
require("dotenv").config();

//midle ware
app.use(cors());
app.use(express.json());

//MongoDB constant (gets from mongodb)
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.krkb3gw.mongodb.net/?retryWrites=true&w=majority`;
//MongoDB constant (gets from mongodb)
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//this function is used for all MongoDB works inside the try section.
async function run() {
  try {
    const appointmentOptionsCollection = client
      .db("doctors-portal")
      .collection("appointmentOptions");

    app.get("/appointmentOptions", async (req, res) => {
      const query = {};
      const result = await appointmentOptionsCollection.find(query).toArray();
      res.send(result);
    });
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
