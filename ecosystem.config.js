module.exports = {
  apps: [{
    name: "backend",
    script: "./src/server.js",
    interpreter: "./node_modules/.bin/babel-node",
    watch: true,
    env_file: ".env",
    env: {
      NODE_ENV: "development",
    }
  }]
}
