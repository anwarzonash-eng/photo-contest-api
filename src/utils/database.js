import { Sequelize } from 'sequelize';
import { Env } from "../config";

export const sequelize = new Sequelize(Env.DB_string, { logging: false,  dialectOptions: {
    useUTC: false, // Prevents Sequelize from converting dates to UTC
     statement_timeout: 300000, // PostgreSQL: max 5minutes per query
},  timezone: 'America/New_York', 

pool: {
    max: 50,       // max number of connections in pool
    min: 0,        // min number of connections
    acquire: 30000, // max time (ms) to try getting connection before throwing
    idle: 10000,    // how long a connection stays idle before release
    evict: 1000,    // how often to check for idle connections
  },})

// Set the timezone on the PostgreSQL server for each connection
sequelize.afterConnect(async (connection) => {
    // Set timezone for the current session
    await connection.query("SET TIME ZONE 'America/New_York';");
  });
