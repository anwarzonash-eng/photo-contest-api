import baseException from "./base.exception";

class blockedUserException extends baseException {
  constructor() {
    super(403, `Your Account is Blocked`);
  }
}

export default blockedUserException;
