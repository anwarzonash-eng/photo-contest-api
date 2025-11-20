import baseController from "./base.controller"
import { validationMiddleware, userRoleMiddleware } from '../middleware';
import { AddTownHallDto, UpdateTownHallDto, getTownhallByIdDto, UpdateMonthlyTownHallDto,
   removeTownhallDto, AddMonthlyTownHallDto
} from "../dtos";


class townhallController extends baseController {

    constructor() {
        super('/townhall')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/add`, validationMiddleware(AddTownHallDto),  userRoleMiddleware(), this.AddTownHall)
        this.router.post(`${this.parentRouterPath}/addMonthly`, validationMiddleware(AddMonthlyTownHallDto),  userRoleMiddleware(), this.AddMonthlyTownHall)
        this.router.post(`${this.parentRouterPath}/update`, validationMiddleware(UpdateTownHallDto),  userRoleMiddleware(), this.UpdateTownHall)
        this.router.post(`${this.parentRouterPath}/updateMonthly`, validationMiddleware(UpdateMonthlyTownHallDto),  userRoleMiddleware(), this.UpdateMonthlyTownHall)
        this.router.post(`${this.parentRouterPath}/id`, validationMiddleware(getTownhallByIdDto),  userRoleMiddleware(), this.getTownHallById)
        this.router.post(`${this.parentRouterPath}/monthlyTownhallId`, validationMiddleware(getTownhallByIdDto),  userRoleMiddleware(), this.getMonthlyTownHallById)
        this.router.post(`${this.parentRouterPath}/list`, this.getTownHallList)
        this.router.post(`${this.parentRouterPath}/monthly-list`, this.getMonthlyTownHallList)
        this.router.post(`${this.parentRouterPath}/delete`, validationMiddleware(removeTownhallDto),  userRoleMiddleware(), this.removeTownhall)
        this.router.post(`${this.parentRouterPath}/deleteMonthly`, validationMiddleware(removeTownhallDto),  userRoleMiddleware(), this.removeMonthlyTownhall)
    }


    AddTownHall = async (req, res, next) => {
        try {
            const data = await this._townhallService.AddTownHall(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }


    
    AddMonthlyTownHall = async (req, res, next) => {
        try {
            const data = await this._townhallService.AddMonthlyTownHall(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }

     
    UpdateTownHall = async (req, res, next) => {
        try {
            const data = await this._townhallService.UpdateTownHall(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }



    
    UpdateMonthlyTownHall = async (req, res, next) => {
        try {
            const data = await this._townhallService.UpdateMonthlyTownHall(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }

    getTownHallById = async (req, res, next) => {
        try {
            const data = await this._townhallService.getTownHallById(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }
 
     getMonthlyTownHallById = async (req, res, next) => {
        try {
            const data = await this._townhallService.getMonthlyTownHallById(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }
 
 
 
     getTownHallList = async (req, res, next) => {
        try {
            const data = await this._townhallService.getTownHallList(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }


    
 
     getMonthlyTownHallList = async (req, res, next) => {
        try {
            const data = await this._townhallService.getMonthlyTownHallList(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }


    removeTownhall = async (req, res, next) => {
        try {
            const data = await this._townhallService.removeTownHall(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }

    

    removeMonthlyTownhall = async (req, res, next) => {
        try {
            const data = await this._townhallService.removeMonthlyTownHall(req)
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }
}

export default townhallController;