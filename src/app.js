import express from "express";
import cors from "cors";
import { controllers } from "./controllers";
import bodyParser from "body-parser";
import { errorMiddleware } from "./middleware";
import fileUpload from 'express-fileupload';
import http from 'http';
import { sequelize } from './utils/database.js';
import { Server as SocketIOServer } from "socket.io";
const path = require('path');
import { getLogFile } from "./utils/logs.js";
import UserModel from "./models/auth.model.js";
import GalleryPhotoModel from "./models/gallery_photo.model.js";
import Stripe from 'stripe';
import {Env} from './config';
import moment from 'moment';
//const moment_timezone = require('moment-timezone');
const {createAppLogger, createPaymentLogger} = require('./utils/logs.js');
import {setPaidInterest} from './utils/mailchimp/payment.js';
import { manageTags } from "./utils/mailchimp/tags.js";
import PhotoModel from "./models/photo.model.js";
import { updateGalleryHuntScorePoints } from "./utils/genericFunctions.js";
import { Op } from 'sequelize';
import { getSecrets } from "./utils/secret-manager.js";
import {updateBoostedPhotos} from './updateBoostPhotos.js';

// Create a logs/payments directory
const paymentLogDirectory = path.join(__dirname, 'logs', 'payments');
const paymentLogger = createPaymentLogger(paymentLogDirectory);

const appLogsDirectory =  path.join(__dirname, 'logs', 'appLogs');
const appLogger = createAppLogger(appLogsDirectory);
global.appLogger = appLogger;
const schedule = require('node-schedule');
const photoQueue =  new Map();


class App {
    app;

    constructor() {
        this.app = express()
        //this.syncDatabase();
       /*this.app.use(cors({
            origin: '*', 
            methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
        }));

        */
        

        this.app.use(cors({ origin: '*' }));

          
        this.app.use(express.static("public"));
        this.app.use(express.static("uploads"));
    

        
    
        //webhook
        this.app.post('/webhook', express.raw({ type: 'application/json' }), async(req, res) => {
            try {
                paymentLogger.info('[Start] Executing webhook');
                const stripe = new Stripe(Env.stripeSecretKey, { apiVersion: '2020-08-27' });
                const signature = req.headers['stripe-signature'];
                let event;
                try {
                    // Verify the event by checking the signature
                    event = stripe.webhooks.constructEvent(req.body, signature, Env.STRIPE_WEBHOOK_SECRET);
                } 
                catch (err) {
                    paymentLogger.error({ message: 'Webhook signature verification failed', error: err.message });
                    return res.status(400).send('Webhook signature verification failed');
                }

                
                paymentLogger.info(`Received event type: ${event.type}`);
                
                const session = event.data.object;

                paymentLogger.info(`Session Mode: ${session.mode}`);

                switch (event.type) {
                    case 'invoice.created':
                        if (session?.mode === 'subscription' || session.subscription) {
                            paymentLogger.info({ 
                                message: 'Inside invoice.created Event',
                                event_type: event.type
                            });
            
                            let Invoice = event["data"]["object"]; 
                            try{                                                                   
                                const updatedInvoice = await stripe.invoices.retrieve(Invoice.id);   
                                paymentLogger.info({
                                    message: 'finalize invoice', 
                                    status: updatedInvoice.status
                                });

                                if (updatedInvoice.status != 'paid' && updatedInvoice.status != 'open') {
                                    const finalizedInvoice = await stripe.invoices.finalizeInvoice(Invoice.id, null, {
                                        idempotencyKey: `invoice-finalized-${Invoice.id}`,
                                    });
                                    
                                    paymentLogger.info({
                                        message: 'Successfully Finalized invoice',
                                        currentStatus: finalizedInvoice.status
                                    });
                                }   
                            }
                            catch(err){
                                const subscription = await stripe.subscriptions.retrieve(Invoice.subscription);
                                if(subscription.status != 'canceled'){
                                    // await cancelSubscription(Invoice.subscription);
                                    await UserModel.update({
                                        isPaid: false,
                                        subscriptionStatus: 'invoice_creation_error'
                                    }, {
                                        where:{
                                            email: Invoice.customer_email
                                        }
                                    });
                                    paymentLogger.error({ message: 'Error finalizing draft invoices', error: err.message});
                                }
                            }      
                        }
                        break;

                    case 'invoice.finalized':
                        if (session?.mode === 'subscription'|| session.subscription) {
                            const invoice = event["data"]["object"];
                            try{                            
                                paymentLogger.info({ 
                                    message: 'Inside Confirming Payment Intent',
                                    event_type: event.type,
                                    invoice: invoice,
                                    payment_intent: invoice.payment_intent
                                });

                                if(invoice.payment_intent){
                                    const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent);
                                    paymentLogger.info({
                                        message: 'Get Payment Intent Status',
                                        status: paymentIntent.status
                                    });
                                    
                                    if (paymentIntent.status === 'requires_confirmation') {
                                        await stripe.paymentIntents.confirm(paymentIntent.id);
                                    }
                                }
                            } 
                            catch (error) {                     
                                paymentLogger.error({
                                    message: 'Error Confirming Payment Intent',
                                    error: error.message
                                });

                                const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                                if(subscription.status != 'canceled'){
                                    //await cancelSubscription(invoice.subscription);
                                    await UserModel.update({
                                        isPaid: false,
                                        subscriptionStatus: 'invoice_finalization_error'
                                    }, {
                                        where:{
                                            email: invoice.customer_email
                                        }
                                    });
                                }
                            }

                            paymentLogger.info({ 
                                message: 'Invoice has been finalized',
                                event_type: event.type,
                                customer_email: invoice.customer_email
                            });
                        }             
                        break;

                    case 'invoice.voided':
                        if (session?.mode === 'subscription' || session.subscription) {
                            const invoiceData = event["data"]["object"];
                            paymentLogger.info({ 
                                message: 'Invoice has been voided',
                                event_type: event.type,
                                customer_email: invoiceData.customer_email,
                                subscription: invoiceData.subscription,
                                invoice: invoiceData
                            });

                            const subscription = await stripe.subscriptions.retrieve(invoiceData.subscription);
                            if(subscription.status != 'canceled'){
                            // await cancelSubscription(invoiceData.subscription);
                                await UserModel.update({
                                    isPaid: false,
                                    subscriptionStatus: 'invoice_voided'
                                    }, {
                                        where:{
                                            email: invoiceData.customer_email
                                    }
                                });
                            }       
                        }            
                        break;

                    case 'invoice.payment_succeeded': 
                        if (session?.mode === 'subscription' || session.subscription) {     
                            await handlePaymentSuccess(event["data"]["object"]);
                        }
                        break;

                    case 'invoice.payment_failed':    
                        if (session?.mode === 'subscription' || session.subscription) {                       
                            let data = event["data"]["object"];
                            paymentLogger.info({ message: 'payment failed', customer_email: data.customer_email, event_type: event.type});   
                            try{
                                await UserModel.update({
                                    subscriptionStatus: 'payment_failed',
                                    isPaid: false
                                    }, {
                                        where:{
                                            email: data.customer_email
                                    }
                                });

                                try{
                                    let invoiceId = data?.id;
                                    if(invoiceId && data?.auto_advance == false){
                                        await stripe.invoices.update(invoiceId, {
                                            auto_advance: true
                                        });
                                    }
                                }
                                catch(err){
                                    global.appLogger.error(err.message);
                                }

                                const user = await UserModel.findOne({
                                    where:{
                                        email: data.customer_email
                                    },
                                    attributes:['id', 'payment_frequency']
                                });


                                await PhotoModel.update({
                                    isFreezed: true
                                }, {
                                    where:{
                                        user_id: user.dataValues.id,
                                        isQueued: true,
                                        weekDay: {
                                            [Op.ne]: '1'
                                        }
                                    }
                                });

                            
                                if(user && user.dataValues.payment_frequency == 'first_time:false'){
                                    const galleryPhotos = await GalleryPhotoModel.findAll({
                                        where:{
                                            user_id: user.dataValues.id
                                        },
                                        order:[['createdAt', 'ASC']],
                                        offset:5,
                                        attributes:['id']
                                    });

                                    paymentLogger.info({
                                        message:'Fetch User Gallery Photos',
                                        galleryPhotosLength: galleryPhotos.length
                                    })

                                    if(galleryPhotos.length > 0){
                                        for(let i=0; i<galleryPhotos.length; i++){
                                            paymentLogger.info({
                                                message:'Get Grayed Out Gallery Photos',
                                                Photo: i,
                                                galleryPhotoId: galleryPhotos[i]['dataValues']['id']
                                            })
            
                                            await GalleryPhotoModel.update({
                                                photo_display_status: 'true'
                                            }, {
                                                where:{
                                                    id: galleryPhotos[i]['dataValues']['id']
                                                }
                                            })
                                        }

                                        const now = new Date();
                                        let userId = user.dataValues.id;
                                        if (photoQueue.has(userId)) {
                                            const job = photoQueue.get(userId);
                                            job.cancel();
                                        }
                                        const ninetyDaysLater = new Date(now.setDate(now.getDate() + 90))
                                        //new Date(Date.now() + 1 * 60 * 1000); 
                                    
                                        //const twominutesLater = new Date(Date.now() + 2 * 60 * 1000); 
                                        const job = schedule.scheduleJob(ninetyDaysLater, async () => {
                                            try {
                                                const user = await UserModel.findOne({
                                                    where:{
                                                        email: data.customer_email
                                                    },
                                                    attributes:['isPaid', 'id']
                                                });
                                                if(user.dataValues.isPaid == false){
                                                    const falsyGalleryPhotos = await GalleryPhotoModel.count({
                                                        where:{
                                                            user_id: user.dataValues.id,
                                                            photo_display_status: 'false'
                                                        }
                                                    });
                                
                                                    const truthyGalleryPhotos = await GalleryPhotoModel.count({
                                                        where:{
                                                            user_id: user.dataValues.id,
                                                            photo_display_status: 'true'
                                                        }
                                                    });
                                
                                                    if(falsyGalleryPhotos < 5 && truthyGalleryPhotos){
                                                        let updatedPhotos = 5 - falsyGalleryPhotos;   // 2
                                                        const photos = await GalleryPhotoModel.findAll({
                                                            where:{
                                                                user_id: user.dataValues.id,
                                                                photo_display_status: 'true'
                                                            },
                                                            attributes:['id'],
                                                            order:[['createdAt', 'ASC']],
                                                            limit: updatedPhotos
                                                        });
                                
                                                        for(let i=0; i< photos.length; i++){
                                                            await GalleryPhotoModel.update({
                                                                photo_display_status: 'false'
                                                                }, {
                                                                    where:{
                                                                    id: photos[i]['dataValues']['id']
                                                                    }
                                
                                                            })
                                                        }
                                                    }

                                                    global.appLogger.info('Successfully Update Scheduled');
                                                    await GalleryPhotoModel.update({
                                                        photo_display_status: 'expired'
                                                    }, {
                                                        where:{
                                                            user_id: user.dataValues.id,
                                                            photo_display_status: 'true'
                                                        }
                                                    })
                                                }
                                            }
                                            catch(err){
                                                paymentLogger.error({
                                                    message: 'Error in scheduling',
                                                    error: err.message
                                                })
                                            }
                                            finally{
                                                photoQueue.delete(userId);
                                            }
                                        })

                                        photoQueue.set(userId, job);
                                    }                      
                                }
                            }
                            catch(err){
                                paymentLogger.error({
                                    message:'Error Inside invoice.payment_failed event',
                                    error: err.message
                                })
                            }
                        }
                        break;

                    case 'customer.subscription.deleted':
                         if (session?.object === 'subscription' || session.subscription) {     
                            paymentLogger.info({ message: 'subscription deleted', event: event.data, event_type: event.type});
                            await handleSubscriptionExpired(event);
                         }
                        break;

                    case 'customer.subscription.updated':
                        if (session?.object === 'subscription' || session.subscription) {     
                            paymentLogger.info({ message: 'subscription updated', event: event.data, event_type: event.type});
                            await handleSubscriptionExpired(event);
                        }
                        break;





                    default:
                        paymentLogger.error({ message: 'Unhandled event type', event_type: event.type});
                        break;
                }
        
                res.status(200).json({
                    message: 'Webhook successfully processed.',
                    event_type: event.type
                });
            } 
            catch (error) {
                paymentLogger.error({ message: 'Error handling webhook', error: error.message});
                res.status(500).send({
                    message: 'An error occurred while processing the webhook.',
                    error: error.message
                });
            }
        });


        const updateQueuedPhotos = async(user) => {
            try{
                    const queuedPhotos = await PhotoModel.findAll({
                        where:{
                            user_id: user.dataValues.id,
                            isQueued: true,
                            isFreezed: true
                        },
                        attributes:['id', 'weekDay', 'day'],
                        order:[['weekDay', 'ASC']]
                    })

                    if(queuedPhotos.length > 0){
                        const daysOfWeek = {
                            Monday: 0,
                            Tuesday: 1,
                            Wednesday: 2,
                            Thursday: 3,
                            Friday: 4,                           
                            Saturday: 5,
                            Sunday: 6
                        };
      
                        let today = new Date(); 
                        let dayOfWeek = today.getUTCDay(); 
                        let daysUntilNextMonday = (8 - dayOfWeek) % 7; 
                        
                        if (daysUntilNextMonday === 0) {
                            daysUntilNextMonday = 7; // If today is Monday, get next Monday
                        }             
                        let week1MondayDate = new Date(today.getTime() + (daysUntilNextMonday * 24 * 60 * 60 * 1000));   

                        for(let i=0; i< queuedPhotos.length; i++){              
                            let day = queuedPhotos[i]['day'];
                        
                            let nextMondayDate = new Date(week1MondayDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));          
                            let uploadAtDate = new Date(nextMondayDate.getTime() + (daysOfWeek[day] * 24 * 60 * 60 * 1000));
                            //let createdAt =  moment_timezone.tz(uploadAtDate, 'America/New_York').format('YYYY-MM-DD HH:mm:ss.SSSSSS')
                            const createdAt = moment(uploadAtDate).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss.SSSSSSZ');
                            
                            await PhotoModel.update({
                                createdAt: createdAt,
                                isFreezed: false
                            }, {
                                where:{
                                    id: queuedPhotos[i]['id']
                                }
                            });
                        }
                    }
            }
            catch{ }
        }




        const handleSubscriptionExpired = async (event) => {    
            try { 
                let subscription = event["data"]["object"];
                paymentLogger.info({
                    message: 'Subscription expired function started',
                    subscription: subscription
                });
                const stripe = new Stripe(Env.stripeSecretKey, { apiVersion: '2020-08-27' });
                const customerId = subscription.customer;
                const customer = await stripe.customers.retrieve(customerId);
                const email = customer.email; 

                const user = await UserModel.findOne({    
                    where: { email },
                    attributes: ['isPaid', 'member_id', 'membershipPlan', 'subscriptionStatus'] 
                });
                

                if(user.dataValues.subscriptionStatus != 'payment_failed'){
                    paymentLogger.info({
                        message: 'Inside subscription expired',
                        email: email,
                        data: subscription,
                        subscription_status: subscription.status
                    });

                    let subscription_status = subscription.status; 
                    let isPaid = false; 
                    if(subscription_status == 'active' || subscription_status == 'trialing'){
                        isPaid = true;
                        subscription_status = 'active';
                    }
                    else{
                        await UserModel.update({
                                subscriptionStatus: subscription_status,
                                isPaid: isPaid                 
                            }, {
                                where: { email }
                        });
                    }             
                    
                    setTimeout(async () => { 
                        try{
                            if(user.dataValues.isPaid == true && isPaid == false){
                                const secretKey = await getSecrets();
                                let mailchimpListId = secretKey.listId;
                                await manageTags(user.dataValues.member_id, mailchimpListId, 'Paid_But_Unsubed', 'active');
                                await manageTags(user.dataValues.member_id, mailchimpListId, 'Warning_Paid_Account_Stopped', 'active');

                            }
                        }
                        catch(error){
                            paymentLogger.error({ message: 'Error adding mailchimp tag', error: error.message });
                        }
                    },0);
                }
            } 
            catch (error) {
                paymentLogger.error({
                    message: 'An error occurred while updating subscription status.',
                    error: error.message
                });
            }  
        } 


     
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());
        this.app.use(fileUpload({
            useTempFiles : true, 
            tempFileDir : '/tmp/', 
            limits: {fileSize: 200 * 1024 *1024},
        }));

        this.app.get("/", function (req, res) {      
            res.sendFile("/index.html");
        });
    
        this.app.get('/api/logs', (req, res) => {
            try{
                const { fileName, folderName } = req.query; // Extract the filename from query params
                if (!fileName || !folderName) {
                    return res.status(400).send({ status: 'Error', message: 'File or Folder name is required.' });
                }
                const LogDirectory = path.join(__dirname, `/logs/${folderName}`);
                const LogFilePath = path.join(LogDirectory, fileName); 
                getLogFile(LogFilePath, res);
             }
             catch(err){
                 return res.status(400).send({status:'Error', message: err.message});
             }
        });


        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: "*", 
                methods: ["GET", "POST"]
            }
        });
        this.configureSocketIO();

        this.initializeControllers()
        this.initializeMiddlewares()  
    }

    

    configureSocketIO() {
        let onlineUsers=[];
        const addNewUser = (userId, socketId) => {
            if(userId && socketId){
                !onlineUsers.some(user => user.id == userId ) &&
                onlineUsers.push({userId, socketId})
            }
        } 
        
        const removeUser = (socketId) => {
            if(socketId){
                onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
            }
          };

        const getUser = (userId) => {
            if(userId){
                const foundUser = onlineUsers.find((user) => user.userId === userId);   
                if (foundUser) {
                    return foundUser.socketId;
                } else {
                    return null; 
                }
            }
        }
        this.io.on('connection', (socket) => {
            socket.on("newUser", (userId)=>{
                if(userId){
                    addNewUser(userId, socket.id)
                }
            })

            socket.on("sendNotification", ({senderID, receiverID}) => {
                if(senderID && receiverID){
                    const receiver = getUser(receiverID);
                    this.io.to(receiver).emit("getNotification", {
                        senderID
                    });
                }
            })

            socket.on('disconnect', () => {
                try {
                    removeUser(socket.id);
                } catch (error) {
                    console.error('Error during disconnect:', error);
                }
            });
        });

        this.io.listen(5000);
    }


    
    initializeControllers() {
        controllers().map(controller => {
            this.app.use("/", controller.router);
        });
    }

    initializeMiddlewares() {
         this.app.use(errorMiddleware())
    }
    
    async syncDatabase() {
        try {
            await sequelize.sync({ alter: true }); 
        } catch (error) {
            console.error('Error syncing database:', error);
        }
    }
}


export default App;