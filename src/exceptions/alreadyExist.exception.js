import baseException from "./base.exception";

class alreadyExistException extends baseException {
  constructor(object = "Object") {
    super(500, `${object} Already Exists`);
  }
}

export default alreadyExistException ;
