import baseController from "./base.controller"
import { validationMiddleware, authMiddleware} from '../middleware';
import { checkoutSessionDto, reportCheckoutSessionDto } from '../dtos';


class paymentController extends baseController {

    constructor() {
        super('/payment')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/create-checkout-session`, validationMiddleware(checkoutSessionDto), this.createCheckoutSession);  
        this.router.post(`${this.parentRouterPath}/report-checkout`, validationMiddleware(reportCheckoutSessionDto), this.createReportCheckoutSession);  
    }

    createCheckoutSession = async(req, res, next) => {
        try {
            const data = await this._paymentService.createCheckoutSession(req);
            if(data.status && data.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message))
            }
            else{ 
                res.send(this._responseTemplate('Success', data, undefined))
            } 
        } catch (error) {
            next(error)
        }
    }

      createReportCheckoutSession = async(req, res, next) => {
        try {
            const data = await this._paymentService.createReportCheckoutSession(req);
            if(data.status && data.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message))
            }
            else{ 
                res.send(this._responseTemplate('Success', data, undefined))
            } 
        } catch (error) {
            next(error)
        }
    }
}

export default paymentController;
