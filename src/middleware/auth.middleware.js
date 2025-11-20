import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";
import blockedUserException from "../exceptions/blockedUser.exception";
import {UserModel} from "../models";
import { verifyToken } from "../utils/jwt";


export function authMiddleware(isSkipAuthorization = false) {
  return async (req, res, next) => {

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token)
      next(new userNotAuthorizedException())
    else {

      try {

        const user = await verifyToken(token);
        if (user) {
          const user_id = user._id;
          let isUserExist = await UserModel.findByPk(user_id)
          
          if (!isUserExist) {
              next(new userNotAuthorizedException())
          }

          if(isUserExist && isUserExist.dataValues.isBlocked == true){
            next(new blockedUserException())
          } 

          req.userData = user
          next()

        }
        else {

          next(new userNotAuthorizedException())

        }
      } catch (error) {
        next(error)
      }
    }
  }
}


export const conditionalAuthMiddleware = (req, res, next) => {
  if ((req.body.userType && req.body.userType !== 'all') || (!req.body.userType && !req.body.batchId)) {
    return authMiddleware()(req, res, next);
  }
  next();
};