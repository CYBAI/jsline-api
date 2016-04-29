require('babel-core/register');
require('babel-polyfill');

const LineModel = require('./lib/models');
const LineAPI = require('./lib/api').LineAPI;
const LineConfig = require('./lib/config').config;
const LineClient = require('./lib/clients').LineClient;

module.exports = {
  LineAPI,
  LineConfig,
  LineClient,
  LineRoom: LineModel.LineRoom,
  LineGroup: LineModel.LineGroup,
  LineContact: LineModel.LineContact,
  LineMessage: LineModel.LineMessage
};
