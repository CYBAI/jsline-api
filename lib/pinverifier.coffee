'use strict'

utf8 = require 'utf8'
RSA = require 'node-bignumber'

class PinVerifier
  constructor: (id, password, APIContext, config) ->
    @id = id
    @password = password
    @_api = APIContext
    @config = config

  getRSACrypto: (json) ->
    @json = json
    rsa = new RSA.Key()
    chr = String.fromCharCode
    sessionKey = json['session_key']
    @message = utf8.encode(chr(sessionKey.length) + sessionKey + chr(@id.length) + @id + chr(@password.length) + @password)
    [keyname, n, e] = json['rsa_key'].split(',')
    rsa.setPublic n.toString(16), e.toString(16)
    @crypto = rsa.encrypt @message
    return {
      crypto: @crypto
      message: @message
    }
