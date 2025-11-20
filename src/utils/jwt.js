import * as jwt from "jsonwebtoken";
import {getSecrets} from './secret-manager';



export async function createToken(user) {
    try{
        const secretKey = await getSecrets();
        if(secretKey){
            const secret = secretKey.JWT_SECRET;
            const dataStoredInToken = {
                _id: user.id,
                tokentype: 1
            };
            const token = jwt.sign(dataStoredInToken, secret);
            return {
                token
            };
        }
    }
    catch{}
}


export async function decodeToken(token) {
    try {
        const secretKey = await getSecrets();
        if(secretKey){
            const JWT_SECRET = secretKey.JWT_SECRET;
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded;
        }
    } catch (error) {
        return null;
    }
}



export async function verifyToken(token) {
    try{
        const secretKey = await getSecrets();
        if(secretKey){
            const JWT_SECRET = secretKey.JWT_SECRET;
            const user = await jwt.verify(token, JWT_SECRET);
            return user;
        }
    }
    catch{}
}