const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 3000;

//middleware

const corsConfig = {
  origin: '*',
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
}
// app.use(cors())
app.use(cors(corsConfig));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }

  // bearer token
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}







const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8gah9xe.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const classCollection = client.db('bongocademy').collection('classCollection')
    const userCollection = client.db('bongocademy').collection('userCollection')
    const selectedCollection = client.db('bongocademy').collection('selectedCollection')
    const paymentCollection = client.db('bongocademy').collection('paymentCollection')

    // jwt-----------------> 
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })



    // classes-------------->
    app.get('/popularClasses', async (req, res) => {
      const result = await classCollection.find().sort({ enrolled: -1 }).limit(6).toArray();
      res.send(result);
    });
    

    app.post('/allClasses', async (req, res) => {
      const newClass = req.body;
      // console.log(newToy);
      const result = await classCollection.insertOne(newClass);
      res.send(result)
    })


    app.get('/allApprovedClasses', async (req, res) => {
      const result = await classCollection.find({ status: 'Approve' }).toArray();
      res.send(result);

    })
   

    app.post('/allSelectedClasses', async (req, res) => {
      const newSelectedClass = req.body;
      const result = await selectedCollection.insertOne(newSelectedClass);
      res.send(result)
    })

    app.get('/mySelectedClasses', async (req, res) => {
      const studentEmail = req.query.student_email;
    
      try {
        const result = await selectedCollection.find({ student_email: studentEmail }).toArray();
    
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    });

    app.delete('/mySelectedClasses/:id', async (req, res) => {
      const id = req.params.id;
    
      try {
        const result = await selectedCollection.deleteOne({ select_id : id });
    
        if (result.deletedCount === 1) {
          res.json({ message: 'Selected class deleted successfully' });
        } else {
          res.status(404).json({ message: 'Selected class not found' });
        }
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    });
    

    app.get('/allSelectedClasses/:id', async (req,res) => {
      const id = req.params.id;
  
      const result = await selectedCollection.findOne({ select_id : id });
      res.send(result);
    }); 

    app.get('/allSelectedClasses', async (req, res) => {
      const result = await selectedCollection.find().toArray();
      res.send(result);
    });
    
    app.get('/allApprovedClasses/:id', async (req,res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(filter);
      res.send(result);
    }); 
    

    app.patch('/allApprovedClasses/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
    
      try {
        const classDoc = await classCollection.findOne(filter);
        if (!classDoc) {
          return res.status(404).json({ error: 'Class not found' });
        }
    
        const currentEnrolled = parseInt(classDoc.enrolled, 10);
        const updatedEnrolled = currentEnrolled + 1;
        const currentSeats = parseInt(classDoc.available_seats, 10);
        const updatedSeats = currentSeats - 1;
        const updateDoc = {
          $set: { 
            enrolled: updatedEnrolled,
            available_seats: updatedSeats 
          },
        };
    
        const result = await classCollection.updateOne(filter, updateDoc);
        res.json(result);
      } catch (error) {
        console.error('Failed to update "enrolled" field:', error);
        res.status(500).json({ error: 'Failed to update "enrolled" field' });
      }
    });
    
    app.get('/popular-instructors', async (req, res) => {
      try {
        const result = await classCollection
          .aggregate([
            { $group: { _id: '$instructor_email', instructor_name: { $first: '$instructor_name' }, instructor_photo: { $first: '$instructor_photo' }, totalStudents: { $sum: '$enrolled' } } },
            { $sort: { totalStudents: -1 } },
            { $limit: 6 }
          ])
          .toArray();
    
        if (result.length > 0) {
          const instructors = result.map(item => ({ instructor_name: item.instructor_name, instructor_photo: item.instructor_photo, totalStudents: item.totalStudents }));
          res.json(instructors);
        } else {
          res.json('No instructors found');
        }
      } catch (error) {
        console.error('Failed to get the popular instructors:', error);
        res.status(500).send('Failed to get the popular instructors');
      }
    });
    
    app.get('/all-instructors', async (req, res) => {
      try {
        const result = await classCollection
          .aggregate([
            { $group: { _id: '$instructor_email', instructor_name: { $first: '$instructor_name' }, instructor_photo: { $first: '$instructor_photo' }, totalStudents: { $sum: '$enrolled' } } },
            { $sort: { instructor_name: 1 } },
            { $limit: 12 }
          ])
          .toArray();
    
        if (result.length > 0) {
          const instructors = result.map(item => ({ instructor_name: item.instructor_name, instructor_photo: item.instructor_photo, totalStudents: item.totalStudents }));
          res.json(instructors);
        } else {
          res.json('No instructors found');
        }
      } catch (error) {
        console.error('Failed to get the popular instructors:', error);
        res.status(500).send('Failed to get the popular instructors');
      }
    });
    
   


    app.patch('/classes/statusApprove/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'Approve'
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.patch('/classes/statusDeny/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'Denied'
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.get('/myClasses', async (req, res) => {
  
      let query = {};
      if(req.query?.instructor_email){
        query = {instructor_email: req.query.instructor_email}
      }
      
      const result = await classCollection.find(query).toArray()
      
      
      res.send(result);
    })



    app.get('/allClasses/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.findOne(query);
      res.send(result);
    })



   // users------------->
   app.post('/users', async (req, res) => {
    const user = req.body;
    const query = { email: user.email }
    const existingUser = await userCollection.findOne(query)
    if (existingUser) {
      return res.send({ message: 'User already exists' })
    }
    const result = await userCollection.insertOne(user);
    res.send(result);
  });

  app.get('/users', async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result)

  });

  app.patch('/users/role/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        role: 'admin'
      },
    };
    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);

  })

 

  app.patch('/users/istructor/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        role: 'instructor'
      },
    };
    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);

  })

  app.get('/users/admin/:email', verifyJWT, async (req, res) => {
    const email = req.params.email;
    if (req.decoded.email !== email) {
      return res.send({ admin: false })
    }
    const query = { email: email };
    const user = await userCollection.findOne(query)
    const result = { admin: user?.role === 'admin' }
    res.send(result);
  })

  app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
    const email = req.params.email;
    if (req.decoded.email !== email) {
      return res.send({ instructor: false })
    }
    const query = { email: email };
    const user = await userCollection.findOne(query)
    const result = { instructor: user?.role === 'instructor' }
    res.send(result);
  })


    // Payment Intent
    app.post('/create-payment-intent', verifyJWT, async(req,res)=>{
      const {price} = req.body;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount*100,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
   
    // payment API
    app.post('/payments', verifyJWT, async(req,res)=>{
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result)
    })



  

    app.get('/payments', verifyJWT, async (req, res) => {
      const studentEmail = req.query.email;
    
      try {
        const result = await paymentCollection.find({ email: studentEmail }).toArray();
    
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    });







    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is redeployed')
})

app.listen(port, () => {
  console.log(`running on ${port}`);
})