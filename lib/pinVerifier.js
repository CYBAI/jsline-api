import utf8 from 'utf8'
import RSA from 'node-bignumber'

export class PinVerifier {
  constructor(id, password) {
    this.id = id;
    this.password = password;
  }

  getRSACrypto(json) {
    let rsa = new RSA.Key();
    let chr = String.fromCharCode;
    let sessionKey = json['session_key'];
    let message = utf8.encode(chr(sessionKey.length) + sessionKey + chr(this.id.length) + this.id + chr(this.password.length) + this.password);
    let [keyname, n, e] = json['rsa_key'].split(',');
    rsa.setPublic(n, e);
    let credentials = rsa.encrypt(message);
    return { keyname, credentials, message };
  }
}
