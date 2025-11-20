import winston from 'winston';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import moment from 'moment';


const createPaymentLogger = (logDirectory) => {
    try{
      const dayName = moment().format('dddd');
      return winston.createLogger({
          format: winston.format.combine(
            winston.format.timestamp({
              format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.json(),
            // Custom formatter to add a line space after each log
            winston.format.printf((info) => {
              return `${JSON.stringify(info)}\n`;
            })
          ),
          transports: [
            new DailyRotateFile({
              dirname: logDirectory, 
               filename: `${dayName}-%DATE%.log`,
              zippedArchive: false,
              maxFiles: '7d', // Keep logs for 7 days
              level: 'info' 
            })
          ]
        });
    }
    catch(err){
      console.error('Error creating payment logger:', err.message);
    }
  }

  const createAppLogger = (logDirectory) => {
    try{
        const dayName = moment().format('dddd');

        return winston.createLogger({
          level: 'info', 
          format: winston.format.combine(
            winston.format.timestamp({
              format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.printf((info) => {
              const { timestamp, level, message, stack } = info;
              return stack
                ? `${timestamp} [${level.toUpperCase()}]: ${message} - ${stack}`
                : `${timestamp} [${level.toUpperCase()}]: ${message}`;
            })
          ),
          transports: [
            new DailyRotateFile({
              dirname: logDirectory,
              filename: `warnings-%DATE%.log`,
              zippedArchive: false,
              maxFiles: '7d',
              level: 'warn' // Logs warnings and errors to file
            }),
            
            new DailyRotateFile({
              dirname: logDirectory,
              filename: `${dayName}-%DATE%.log`,
              zippedArchive: false, 
              maxFiles: '7d',
              level: 'info',
            }),
           
            new DailyRotateFile({
              dirname: logDirectory,
              filename: `errors-%DATE%.log`,
              zippedArchive: false,
              maxFiles: '7d', 
              level: 'error', 
            })
          ],
          exceptionHandlers: [
            new DailyRotateFile({
              dirname: logDirectory,
              filename: 'exceptions-%DATE%.log',
              zippedArchive: false,
              maxFiles: '7d',
              level: 'error',
            })
          ],
          rejectionHandlers: [
            new DailyRotateFile({
              dirname: logDirectory,
              filename: 'rejections-%DATE%.log',
              zippedArchive: false,
              maxFiles: '7d',
              level: 'error',
            }),
          ]
        });
    }
    catch(err){
      console.error('Error creating app logger:', err.message);
    }
  }

  

const getLogFile = (logFilePath, res) => {
    try{
        if(logFilePath){
            fs.readFile(logFilePath, { encoding: 'utf-8' }, (err, data) => {
                if (err) {
                    return res.status(500).send(`${logFilePath} does not Exist`);
                }
                res.type('text').send(data);
            });
        }
        else{
            return res.status(500).send(`No File Exist`);
        }
    }
    catch(err){
        throw err;
    }
}

module.exports = {createPaymentLogger, createAppLogger, getLogFile};