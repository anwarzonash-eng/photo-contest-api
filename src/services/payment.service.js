import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
import { Env } from '../config';
const Stripe = require('stripe');


export class paymentService extends baseService {
    async createCheckoutSession(req) {
        try
        {
          
                const stripe = Stripe(Env.stripeSecretKey);
                let { email, productId, successUrl, cancelUrl } = req.body;
                const products = {     
                        [Env.monthly_productId]: Env.monthly_priceId,
                        [Env.annual_productId]: Env.annual_priceId,
                        [Env.one_day_productId]: Env.one_day_priceId,
                        [Env.annual_big_pro_membership_productId]: Env.annual_big_pro_membership_priceId,
                        [Env.monthly_big_pro_membership_productId]: Env.monthly_big_pro_membership_priceId
                };


                const customerEmail = email !== '' ? { customer_email: email } : {};

                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card', 'link'],
                    payment_method_collection: "always",
                    ...customerEmail,
                    line_items: [
                    {
                        price: products[productId],
                        quantity: 1,
                    },
                    ],
                    mode: 'subscription',
                    subscription_data: {
                        payment_behavior: "allow_incomplete", 
                    },
                    success_url: `${Env.Base_Url}${successUrl}`,
                    cancel_url: `${Env.Base_Url}${cancelUrl}`,
                });
          
                await this._userModel.update({
                    sessionId: session.id
                }, {
                    where:{
                        email: email
                    }
                });
                return { id: session.id };      
        }
        catch(err){
            return { status: 'Error', message: err.message };
        }

       
    }


    async createReportCheckoutSession(req){
        try{
               const stripe = Stripe(Env.stripeSecretKey);
               global.appLogger.info( `Key, ${Env.stripeSecretKey}`);
                 global.appLogger.info( `Report Price Id, ${Env.report_priceId}`)
                let { photoId, email, successUrl, cancelUrl } = req.body;
                const customerEmail = email !== '' ? { customer_email: email } : {};
                
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card', 'link'],
                    ...customerEmail,
                    line_items: [
                        {
                            price: Env.report_priceId, 
                            quantity: 1,
                        },
                    ],
                    mode: 'payment',
                    payment_intent_data: {
                        metadata: {
                            email,
                            photoId: photoId,
                            payment_mode: 'one_time'
                        },
                    },
                    success_url: `${Env.Base_Url}${successUrl}`,
                    cancel_url: `${Env.Base_Url}${cancelUrl}`,
                });

                return { id: session.id }; 
        }
        catch(err){
            return { status: 'Error', message: err.message };
        }
    }
}