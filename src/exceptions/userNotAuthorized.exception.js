import baseException from "./base.exception";

class userNotAuthorizedException extends baseException {
  constructor() {
    super(401, `User is not Authorized`);
  }
}

export default userNotAuthorizedException;
