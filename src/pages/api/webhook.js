import { buffer } from "micro";
import * as admin from "firebase-admin";

const serviceAccount = require("../../../credentials.json");

const app = !admin.apps.length
  ? admin.initializeApp({
      credentials: admin.credential.cert(serviceAccount),
    })
  : admin.app();

//connect to stripe

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const endpointSecret = process.env.SIGNING_SECRET;

const fulfillOrder = async (session) => {
  //console.log(session);

  return app()
    .firestore()
    .collection("users")
    .doc(session.metadata.email)
    .collection("orders")
    .doc(session.id)
    .set({
      amount: session.amount.total / 100,
      amount_shipping: session.total_details.amount_shipping / 100,
      images: JSON.parse(session.metadata.images),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })

    .then(() => {
      console.log(`Success: Order ${session.id} added to db `);
    });
};
export default async (req, res) => {
  if (req.method === "POST") {
    const requestBuffer = await buffer(req);
    const payload = requestBuffer.toString();
    const sig = req.headers["stripe-signature"];

    let event;
    //verify that event came from stripe
    try {
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } catch (error) {
      console.log("Error", error.message);
      return res.status(400).send(`Webhook error: ${error.message}`);
    }

    //handle checkout session
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      return fulfillOrder(session)
        .then(() => res.status(200))
        .catch((error) =>
          res.status(400).send(`Webhook error: ${error.message}`)
        );
    }
  }
};

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
