import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";
import { UserModel } from "../models";
import { verifyToken } from "../utils/jwt";



export function userRoleMiddleware() {
  return async (req, res, next) => {
    try {
    
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];
      if (!token) {
        return next(new userNotAuthorizedException());
      }

      const user = await verifyToken(token);
      if (!user || !user._id) {
        return next(new userNotAuthorizedException());
      }

      const userRecord = await UserModel.findByPk(user._id);
      if (!userRecord || !userRecord.isAdmin) {
        return next(new userNotAuthorizedException());
      }

      req.adminUser = user;

      next();
    } 
    catch (error) {
      next(error);
    }
  };
}