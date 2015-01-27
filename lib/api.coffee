'use strict'

util = require 'util'
Promise = require 'bluebird'
unirest = require 'unirest'
thrift = require 'thrift'
config = require './config'
ttypes = require 'curve-thrift/line_types'
TalkService = require 'curve-thrift/TalkService'
PinVerifier = require './pinverifier'

class LineAPI
  constructor: () ->
    @config = config

  setTHttpClient: (options = {
    protocol: thrift.TCompactProtocol
    headers: @config.Headers
    path: @config.LINE_HTTP_URL
  }) ->
    @connection = thrift.createHttpConnection @config.LINE_DOMAIN, 443, options
    @connection.on 'error', (err) ->
      console.dir err
    @_client = thrift.createHttpClient TalkService, @connection

  _tokenLogin: (authToken) ->
    @config.Headers['X-Line-Access'] = authToken
    @setTHttpClient()
    Promise.resolve()

  _login: (id, password) ->
    pinVerifier = new PinVerifier id, password
    defer = Promise.defer()
    @_setProvider id
    .then (json) ->
      pinVerifier.getRSACrypto json
    .then (rsaCrypto) =>
      @setTHttpClient()
      @_client.loginWithIdentityCredentialForCertificate(
        @provider,
        id,
        password,
        true,
        '',
        @config.hostname,
        rsaCrypto.crypto,
        (err, result) =>
          console.log err if err
          console.log(
            "Enter Pincode #{result.pinCode} to your mobile phone in 2 minutes"
          )
          @_checkLoginResultType result.type, result
          @_loginWithVerifier result
          .then (verifierResult) =>
            @_checkLoginResultType verifierResult.type, verifierResult
            defer.resolve verifierResult
      , (err) ->
        console.log "LoginWithIdentityCredentialForCertificate Error: #{err}"
      )
    defer.promise

  _loginWithVerifier: (result) ->
    @getJson @config.LINE_CERTIFICATE_URL
    .then (json) =>
      @_client.loginWithVerifierForCertificate json.result.verifier
    , (err) ->
      console.log "LoginWithVerifierForCertificate Error: #{err}"

  _setProvider: (id) ->
    @provider = if @config.EMAIL_REGEX.test id then ttypes.IdentityProvider.LINE else ttypes.IdentityProvider.NAVER_KR
    if @provider is ttypes.IdentityProvider.LINE then @getJson @config.LINE_SESSION_LINE_URL else @getJson @config.LINE_SESSION_NAVER_URL

  _checkLoginResultType: (type, result) ->
    @config.Headers['X-Line-Access'] = result.authToken or result.verifier
    if result.type is ttypes.LoginResultType.SUCCESS
      @certificate = result.certificate
      @authToken = result.authToken
    else if result.type is ttypes.LoginResultType.REQUIRE_QRCODE
      console.log 'require QR code'
    else if result.type is ttypes.LoginResultType.REQUIRE_DEVICE_CONFIRM
      console.log 'require device confirm'
    else
      throw new Error 'unkown type'
    result

  _getProfile: () ->
    @_client.getProfile()

  _getAllContactIds: () ->
    @_client.getAllContactIds()

  _getBlockedContactIds: () ->
    @_client.getBlockedContactIds()

  _getContacts: (ids) ->
    if !Array.isArray ids
      throw new Error 'argument should be array of contact ids'
    @_client.getContacts ids

  _createRoom: (ids, seq = 0) ->
    @_client.createRoom seq, ids

  _getRoom: (id) ->
    @_client.getRoom id

  _inviteIntoRoom: (roomId, contactIds = []) ->
    @_client.inviteIntoRoom 0, roomId, contactIds

  _leaveRoom: (id) ->
    @_client.leaveRoom 0, id

  _createGroup: (name, ids, seq = 0) ->
    @_client.createGroup seq, name, ids

  _getGroups: (ids) ->
    if !Array.isArray ids
      throw new Error 'argument should be array of group ids'
    @_client.getGroups ids

  _getGroupIdsJoined: () ->
    @_client.getGroupIdsJoined()

  _getGroupIdsInvited: () ->
    @_client.getGroupIdsInvited()

  _acceptGroupInvitation: (groupId, seq = 0) ->
    @_client.acceptGroupInvitation seq, groupId

  _cancelGroupInvitation: (groupId, contactIds = [], seq = 0) ->
    @_client.cancelGroupInvitation seq, groupId, contactIds

  _inviteIntoGroup: (groupId, contactIds = [], seq = 0) ->
    @_client.inviteIntoGroup seq, groupId, contactIds

  _leaveGroup: (id) ->
    @_client.leaveGroup 0, id

  _getRecentMessages: (id, count = 1) ->
    @_client.getRecentMessages id, count

  _sendMessage: (message, seq = 0) ->
    @_client.sendMessage seq, message

  _getLastOpRevision: () ->
    @_client.getLastOpRevision()

  _fetchOperations: (revision, count = 50) ->
    @_client.fetchOperations revision, count

  _getMessageBoxCompactWrapUp: (id) ->
    @_client.getMessageBoxCompactWrapUp id

  _getMessageBoxCompactWrapUpList: (start = 1, count = 50) ->
    @_client.getMessageBoxCompactWrapUpList start, count

  getJson: (path) ->
    defer = Promise.defer()
    unirest.get 'http://' + @config.LINE_DOMAIN + path
      .headers @config.Headers
      .timeout 120000
      .end (res) ->
        defer.resolve res.body
    defer.promise

module.exports = LineAPI
