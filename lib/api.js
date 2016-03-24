import util from 'util';
import thrift from 'thrift';
import unirest from 'unirest';
import Promise from 'bluebird';
import ttypes from 'curve-thrift/line_types';
import TalkService from 'curve-thrift/TalkService';

import { PinVerifier } from './pinVerifier';
import { config } from './config';

export class LineAPI {
  constructor() {
    this.config = config;
    if (this.config.platform === 'darwin') {
      this.config.platform = 'MAC';
    }
  }

  setTHttpClient(options = {
    protocol: thrift.TCompactProtocol,
    headers: this.config.Headers,
    path: this.config.LINE_HTTP_URL
  }) {
    this.connection = thrift.createHttpConnection(this.config.LINE_DOMAIN, 443, options)
    this.connection.on('error', (err) => console.dir(err))
    this._client = thrift.createHttpClient(TalkService, this.connection)
  }

  _tokenLogin(authToken, certificate) {
    this.config.Headers['X-Line-Access'] = authToken;
    this.setTHttpClient();
    return Promise.resolve({ authToken, certificate });
  }

  _login(id, password) {
    let pinVerifier = new PinVerifier(id, password);
    let defer = Promise.pending();
    this._setProvider(id)
    .then(json => pinVerifier.getRSACrypto(json))
    .then ((rsaCrypto) => {
      this.setTHttpClient();
      this._client.loginWithIdentityCredentialForCertificate(
        this.provider, rsaCrypto.keyname, rsaCrypto.credentials, true, this.config.hostname, this.config.platform, rsaCrypto.message,
        (err, result) => {
          if (err) { console.log('LoginFailed'); console.error(err); throw (err); }
          console.log(result);
          this._client.pinCode = result.pinCode;
          if (typeof alert !== 'undefined') { // if using api in browser, Pincode will alert.
            alert(`Enter Pincode ${result.pinCode} to your mobile phone in 2 minutes`);
          } else {
            console.log(`Enter Pincode ${result.pinCode} to your mobile phone in 2 minutes`);
          }
          this._checkLoginResultType(result.type, result);
          this._loginWithVerifier(result)
          .then((verifierResult) => {
            this._checkLoginResultType(verifierResult.type, verifierResult);
            defer.resolve(verifierResult);
          });
        });
    });
    return defer.promise;
  }

  _loginWithVerifier(result) {
    return this.getJson(this.config.LINE_CERTIFICATE_URL)
    .then(
      (json) => this._client.loginWithVerifierForCertificate(json.result.verifier)
      ,(err) => console.log(`LoginWithVerifierForCertificate Error: ${err}`)
    );
  }

  _setProvider(id) {
    this.provider = this.config.EMAIL_REGEX.test(id) ? ttypes.IdentityProvider.LINE : ttypes.IdentityProvider.NAVER_KR;
    if (this.provider === ttypes.IdentityProvider.LINE) {
      return this.getJson(this.config.LINE_SESSION_LINE_URL);
    } else {
      return this.getJson(this.config.LINE_SESSION_NAVER_URL);
    }
  }

  _checkLoginResultType(type, result) {
    this.config.Headers['X-Line-Access'] = result.authToken || result.verifier;
    if (result.type === ttypes.LoginResultType.SUCCESS) {
      this.certificate = result.certificate;
      this.authToken = result.authToken;
    } else if (result.type === ttypes.LoginResultType.REQUIRE_QRCODE) {
      console.log('require QR code');
    } else if (result.type === ttypes.LoginResultType.REQUIRE_DEVICE_CONFIRM) {
      console.log('require device confirm');
    } else {
      throw new Error('unkown type');
    }
    return result;
  }

  _getProfile() {
    return this._client.getProfile();
  }

  _getAllContactIds() {
    return this._client.getAllContactIds();
  }

  _getBlockedContactIds() {
    return this._client.getBlockedContactIds();
  }

  _getContacts(ids) {
    if (!Array.isArray(ids)) {
      throw new Error('argument should be array of contact ids');
    }
    return this._client.getContacts(ids);
  }

  _createRoom(ids, seq = 0) {
    return this._client.createRoom(seq, ids);
  }

  _getRoom(id) {
    return this._client.getRoom(id);
  }

  _inviteIntoRoom(roomId, contactIds = []) {
    return this._client.inviteIntoRoom(0, roomId, contactIds);
  }

  _leaveRoom(id) {
    return this._client.leaveRoom(0, id);
  }

  _createGroup(name, ids, seq = 0) {
    return this._client.createGroup(seq, name, ids);
  }

  _getGroups(ids) {
    if (!Array.isArray(ids)) {
      throw new Error('argument should be array of group ids');
    }
    return this._client.getGroups(ids);
  }

  _getGroupIdsJoined() {
    return this._client.getGroupIdsJoined();
  }

  _getGroupIdsInvited() {
    return this._client.getGroupIdsInvited();
  }

  _acceptGroupInvitation(groupId, seq = 0) {
    return this._client.acceptGroupInvitation(seq, groupId);
  }
  _cancelGroupInvitation(groupId, contactIds = [], seq = 0) {
    return this._client.cancelGroupInvitation(seq, groupId, contactIds);
  }

  _inviteIntoGroup(groupId, contactIds = [], seq = 0) {
    return this._client.inviteIntoGroup(seq, groupId, contactIds);
  }

  _leaveGroup(id) {
    return this._client.leaveGroup(0, id);
  }

  _getRecentMessages(id, count = 1) {
    return this._client.getRecentMessages(id, count);
  }

  _sendMessage(message, seq = 0) {
    return this._client.sendMessage(seq, message);
  }

  _getLastOpRevision() {
    return this._client.getLastOpRevision();
  }

  _fetchOperations(revision, count = 50) {
    return this._client.fetchOperations(revision, count);
  }

  _getMessageBoxCompactWrapUp(id) {
    return this._client.getMessageBoxCompactWrapUp(id);
  }

  _getMessageBoxCompactWrapUpList(start = 1, count = 50) {
    return this._client.getMessageBoxCompactWrapUpList(start, count);
  }

  getJson(path) {
    let defer = Promise.pending();
    unirest.get(`http://${this.config.LINE_DOMAIN}${path}`)
      .headers(this.config.Headers)
      .timeout(120000)
      .end((res) => defer.resolve(res.body));
    return defer.promise;
  }
}
