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
    //appointment options collection
    const appointmentOptionsCollection = client
      .db("doctors-portal")
      .collection("appointmentOptions");

    //bookings colloection
    const bookingsCollection = client
      .db("doctors-portal")
      .collection("bookings");

    //get data from appointments collection
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;

      //used for options collection
      const optionsQuery = {};
      const options = await appointmentOptionsCollection.find(optionsQuery).toArray();
      //used for bookins collection
      const bookingQuery = { selectedDate: date };
      const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

      //used for filtering slots form option collection
      options.forEach(option => {
        const optionsBooked = alreadyBooked.filter(booked => booked.treatmentName === option.name)
        const bookedSlots = optionsBooked.map(booked => booked.selectedTime)
        const remainigSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
        option.slots = remainigSlots
      })
      res.send(options);
    });

    //create data for booking collection
    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
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
