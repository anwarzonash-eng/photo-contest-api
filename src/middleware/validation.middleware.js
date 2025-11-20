import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { responseTemplate } from '../enums/responseTemplate.enum';


export function validationMiddleware(dtoClass, skipMissingProperties = false, whitelist = false) {

  return (req, res, next) => {
    // Merge req.body and req.files into a single object
    const merged = Object.assign({}, req.body, req.files);

    const dto = plainToClass(dtoClass, merged);
    validate(dto, {
      skipMissingProperties,
      whitelist,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false
    }).then(errors => {
      if (errors.length > 0) {
        const constraintsErrors = [];
        const validationErrors = [];

        errors.forEach(error => {
          const traverseChildren = (errorObj) => {
            if (errorObj.children && errorObj.children.length > 0) {
              errorObj.children.forEach(child => traverseChildren(child));
            }
            if (errorObj.constraints) {
              for (let constraintKey in errorObj.constraints) {
                constraintsErrors.push(errorObj.constraints[constraintKey]);
              }
            }
          };
          traverseChildren(error);
        });

        if (constraintsErrors.length > 0) {
          // Use Set to remove duplicates
          const uniqueErrors = Array.from(new Set(constraintsErrors));
          validationErrors.push(...uniqueErrors);
        }
        
        if(validationErrors && validationErrors[0] == 'offset limit exceed'){
          const message=[];
          return res.status(200).json(responseTemplate('Success', message, undefined));
        }
        return res.status(400).json(responseTemplate('Error', undefined, validationErrors));
      } else {
        next();
      }
    }).catch(error => {
      next();
    });
  }
}