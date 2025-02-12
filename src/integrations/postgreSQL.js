const { Sequelize } = require("sequelize");
const { postgreString } = require("../config");

const sequelize = new Sequelize(
  postgreString,
  {
    logging: false,
    native: false,
  }
);

module.exports = { sequelize };
