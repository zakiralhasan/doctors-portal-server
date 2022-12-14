const express = require("express");
const cors = require("cors");
const app = express();

//port for run server
const port = process.env.PORT || 5000;

//used for dotenv purpose
require("dotenv").config();

//get from mongodb or used for mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//used for stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET);

//used for jwt function
const jwt = require('jsonwebtoken');



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

//this is actually a middle ware, which work for verifying jwt token
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'unauthorized access' }) //second check
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
    if (error) {
      return res.status(403).send({ message: 'forbidden access' }) //third check
    }
    req.decoded = decoded;
    next();
  })
}

//this function is used for all MongoDB works inside the try section.
async function run() {
  try {
    //appointment options collection
    const appointmentOptionsCollection = client.db("doctors-portal").collection("appointmentOptions");
    //bookings colloection
    const bookingsCollection = client.db("doctors-portal").collection("bookings");
    //bookings colloection
    const usersCollection = client.db("doctors-portal").collection("users");
    //payments colloection
    const paymentsCollection = client.db("doctors-portal").collection("payments");
    //doctors colloection
    const doctorsCollection = client.db("doctors-portal").collection("doctors");

    //Note: verify admin must be use after verify jwt middle ware
    //this is an admin verify middle ware 
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.user.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' }) //forth check
      }
      next()
    }

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
        option.slots = remainigSlots;
      })
      res.send(options);
    });

    //get only appointments name from appointment options collection
    app.get('/appointmentSpecialty', async (req, res) => {
      const query = {};
      const result = await appointmentOptionsCollection.find(query).project({ name: 1 }).toArray();
      res.send(result)
    })

    //get data from bookings collection by searching user email
    app.get('/bookings', async (req, res) => {
      const email = req.query.email;
      const query = { patientEmail: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result)
    })

    //get data from bookings collection by searching user id (it's used for payment handle)
    app.get('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingsCollection.findOne(query);
      res.send(result)
    })

    //create data for booking collection
    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;
      //verify that, is there any other slots has been booked by the current user
      const query = {
        patientEmail: bookingData.patientEmail,
        selectedDate: bookingData.selectedDate,
        treatmentName: bookingData.treatmentName
      }
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      //verify booking selections
      if (alreadyBooked.length) {
        const message = `You already have a booking on ${bookingData.selectedDate}`
        return res.send({ acknowledged: false, message })
      }
      //
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    //create user information and stor it to the user collection
    app.post('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const userInfo = req.body;
      const result = await usersCollection.insertOne(userInfo);
      res.send(result)
    })

    //get user information from user collection on mongoDB
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })

    //get admin user form user collections
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email }
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === 'admin' })
    })

    //update user info for admin role
    app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const fillter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: { role: 'admin' }
      }
      const result = await usersCollection.updateOne(fillter, updatedDoc, options);
      res.send(result);
    })

    //delete a doctor data from doctors collection on mongoDB
    app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result)
    })

    //This API is used for stripe
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = parseFloat(price * 100)

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //stored payment information on the data base
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId
      const filter = { _id: ObjectId(id) }
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    //get user from user collection and verify, then send access token to frontend
    app.get('/jwt', async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ user }, process.env.ACCESS_TOKEN, { expiresIn: '1d' }); //first check
        return res.send({ accessToken: token });
      };
      res.status(401).send({ message: 'Unauthorised access' })
    })

    //get doctor data at doctors collection on mongoDB
    app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await doctorsCollection.find(query).toArray();
      res.send(result)
    })

    //delete a doctor data from doctors collection on mongoDB
    app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result)
    })

    //create new doctor data at doctors collection on mongoDB
    app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
      const doctorData = req.body;
      const result = await doctorsCollection.insertOne(doctorData);
      res.send(result)
    })

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
