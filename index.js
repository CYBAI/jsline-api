"use strict";
var LineAPI, Promise, TalkService, thrift, ttypes, unirest, util;

util = require("util");

Promise = require("bluebird");

unirest = require("unirest");

thrift = require("thrift");

ttypes = require("curve-thrift/line_types");

TalkService = require("curve-thrift/TalkService");

LineAPI = (function () {
  function LineAPI() {
    this.config = config;
  }

  LineAPI.prototype.setTHttpClient = function (options) {
    if (options == null) {
      options = {
        protocol: thrift.TCompactProtocol,
        headers: this.config.Headers,
        path: this.config.LINE_HTTP_URL
      };
    }
    this.connection = thrift.createHttpConnection(this.config.LINE_DOMAIN, 443, options);
    this.connection.on("error", function (err) {
      return console.dir(err);
    });
    return this._client = thrift.createHttpClient(TalkService, this.connection);
  };

  LineAPI.prototype._tokenLogin = function (authToken) {
    this.config.Headers["X-Line-Access"] = authToken;
    this.setTHttpClient();
    return Promise.resolve();
  };

  LineAPI.prototype._login = function (id, password) {
    var defer, pinVerifier;
    pinVerifier = new PinVerifier(id, password);
    defer = Promise.defer();
    this._setProvider(id).then(function (json) {
      return pinVerifier.getRSACrypto(json);
    }).then((function (_this) {
      return function (rsaCrypto) {
        _this.setTHttpClient();
        return _this._client.loginWithIdentityCredentialForCertificate(_this.provider, id, password, true, "", _this.config.hostname, rsaCrypto.crypto, function (err, result) {
          if (err) {
            console.log(err);
          }
          console.log("Enter Pincode " + result.pinCode + " to your mobile phone in 2 minutes");
          _this._checkLoginResultType(result.type, result);
          return _this._loginWithVerifier(result).then(function (verifierResult) {
            _this._checkLoginResultType(verifierResult.type, verifierResult);
            return defer.resolve(verifierResult);
          });
        }, function (err) {
          return console.log("LoginWithIdentityCredentialForCertificate Error: " + err);
        });
      };
    })(this));
    return defer.promise;
  };

  LineAPI.prototype._loginWithVerifier = function (result) {
    return this.getJson(this.config.LINE_CERTIFICATE_URL).then((function (_this) {
      return function (json) {
        return _this._client.loginWithVerifierForCertificate(json.result.verifier);
      };
    })(this), function (err) {
      return console.log("LoginWithVerifierForCertificate Error: " + err);
    });
  };

  LineAPI.prototype._setProvider = function (id) {
    this.provider = this.config.EMAIL_REGEX.test(id) ? ttypes.IdentityProvider.LINE : ttypes.IdentityProvider.NAVER_KR;
    if (this.provider === ttypes.IdentityProvider.LINE) {
      return this.getJson(this.config.LINE_SESSION_LINE_URL);
    } else {
      return this.getJson(this.config.LINE_SESSION_NAVER_URL);
    }
  };

  LineAPI.prototype._checkLoginResultType = function (type, result) {
    this.config.Headers["X-Line-Access"] = result.authToken || result.verifier;
    if (result.type === ttypes.LoginResultType.SUCCESS) {
      this.certificate = result.certificate;
      this.authToken = result.authToken;
    } else if (result.type === ttypes.LoginResultType.REQUIRE_QRCODE) {
      console.log("require QR code");
    } else if (result.type === ttypes.LoginResultType.REQUIRE_DEVICE_CONFIRM) {
      console.log("require device confirm");
    } else {
      throw new Error("unkown type");
    }
    return result;
  };

  LineAPI.prototype._getProfile = function () {
    return this._client.getProfile();
  };

  LineAPI.prototype._getAllContactIds = function () {
    return this._client.getAllContactIds();
  };

  LineAPI.prototype._getBlockedContactIds = function () {
    return this._client.getBlockedContactIds();
  };

  LineAPI.prototype._getContacts = function (ids) {
    if (!Array.isArray(ids)) {
      throw new Error("argument should be array of contact ids");
    }
    return this._client.getContacts(ids);
  };

  LineAPI.prototype._createRoom = function (ids, seq) {
    if (seq == null) {
      seq = 0;
    }
    return this._client.createRoom(seq, ids);
  };

  LineAPI.prototype._getRoom = function (id) {
    return this._client.getRoom(id);
  };

  LineAPI.prototype._inviteIntoRoom = function (roomId, contactIds) {
    if (contactIds == null) {
      contactIds = [];
    }
    return this._client.inviteIntoRoom(0, roomId, contactIds);
  };

  LineAPI.prototype._leaveRoom = function (id) {
    return this._client.leaveRoom(0, id);
  };

  LineAPI.prototype._createGroup = function (name, ids, seq) {
    if (seq == null) {
      seq = 0;
    }
    return this._client.createGroup(seq, name, ids);
  };

  LineAPI.prototype._getGroups = function (ids) {
    if (!Array.isArray(ids)) {
      throw new Error("argument should be array of group ids");
    }
    return this._client.getGroups(ids);
  };

  LineAPI.prototype._getGroupIdsJoined = function () {
    return this._client.getGroupIdsJoined();
  };

  LineAPI.prototype._getGroupIdsInvited = function () {
    return this._client.getGroupIdsInvited();
  };

  LineAPI.prototype._acceptGroupInvitation = function (groupId, seq) {
    if (seq == null) {
      seq = 0;
    }
    return this._client.acceptGroupInvitation(seq, groupId);
  };

  LineAPI.prototype._cancelGroupInvitation = function (groupId, contactIds, seq) {
    if (contactIds == null) {
      contactIds = [];
    }
    if (seq == null) {
      seq = 0;
    }
    return this._client.cancelGroupInvitation(seq, groupId, contactIds);
  };

  LineAPI.prototype._inviteIntoGroup = function (groupId, contactIds, seq) {
    if (contactIds == null) {
      contactIds = [];
    }
    if (seq == null) {
      seq = 0;
    }
    return this._client.inviteIntoGroup(seq, groupId, contactIds);
  };

  LineAPI.prototype._leaveGroup = function (id) {
    return this._client.leaveGroup(0, id);
  };

  LineAPI.prototype._getRecentMessages = function (id, count) {
    if (count == null) {
      count = 1;
    }
    return this._client.getRecentMessages(id, count);
  };

  LineAPI.prototype._sendMessage = function (message, seq) {
    if (seq == null) {
      seq = 0;
    }
    return this._client.sendMessage(seq, message);
  };

  LineAPI.prototype._getLastOpRevision = function () {
    return this._client.getLastOpRevision();
  };

  LineAPI.prototype._fetchOperations = function (revision, count) {
    if (count == null) {
      count = 50;
    }
    return this._client.fetchOperations(revision, count);
  };

  LineAPI.prototype._getMessageBoxCompactWrapUp = function (id) {
    return this._client.getMessageBoxCompactWrapUp(id);
  };

  LineAPI.prototype._getMessageBoxCompactWrapUpList = function (start, count) {
    if (start == null) {
      start = 1;
    }
    if (count == null) {
      count = 50;
    }
    return this._client.getMessageBoxCompactWrapUpList(start, count);
  };

  LineAPI.prototype.getJson = function (path) {
    var defer;
    defer = Promise.defer();
    unirest.get("http://" + this.config.LINE_DOMAIN + path).headers(this.config.Headers).timeout(120000).end(function (res) {
      return defer.resolve(res.body);
    });
    return defer.promise;
  };

  return LineAPI;
})();
"use strict";
var LineClient,
    Promise,
    ttypes,
    util,
    __extends = function (child, parent) {
  for (var key in parent) {
    if (__hasProp.call(parent, key)) child[key] = parent[key];
  }function ctor() {
    this.constructor = child;
  }ctor.prototype = parent.prototype;child.prototype = new ctor();child.__super__ = parent.prototype;return child;
},
    __hasProp = ({}).hasOwnProperty;

util = require("util");

Promise = require("bluebird");

ttypes = require("curve-thrift/line_types");

LineClient = (function (_super) {
  __extends(LineClient, _super);

  function LineClient(id, password, authToken, is_mac, com_name) {
    if (id == null) {
      id = null;
    }
    if (password == null) {
      password = null;
    }
    if (authToken == null) {
      authToken = null;
    }
    if (is_mac == null) {
      is_mac = false;
    }
    if (com_name == null) {
      com_name = "CYBAI";
    }
    LineClient.__super__.constructor.call(this, this.config);
    if (!(authToken || id && password)) {
      throw new Error("id and password or authToken is needed");
    }
    if (is_mac) {
      this.config.Headers["X-Line-Application"] = "DESKTOPMAC\t" + this.config.version + "\tMAC\t10.9.4-MAVERICKS-x64";
    }
    if (authToken) {
      this.authToken = this.config.Headers["X-Line-Access"] = authToken;
    } else {
      this._setProvider(id);
      this.id = id;
      this.password = password;
      this.is_mac = is_mac;
    }
  }

  LineClient.prototype.login = function () {
    var loginPromise;
    loginPromise = this.authToken ? this._tokenLogin() : this._login(this.id, this.password);
    return loginPromise.then((function (_this) {
      return function (result) {
        if (result.authToken) {
          _this.authToken = result.authToken;
        }
        if (result.certificate) {
          _this.certificate = result.certificate;
        }
        return Promise.join(_this.getLastOpRevision(), _this.getProfile(), _this.refreshGroups(), _this.refreshContacts(), _this.refreshActiveRooms()).then(function () {
          console.log("Login Successfully");
          return true;
        }, function (err) {
          console.log(err);
          return false;
        });
      };
    })(this));
  };

  LineClient.prototype.getLastOpRevision = function () {
    if (this._check_auth()) {
      return this._getLastOpRevision().then((function (_this) {
        return function (revision) {
          return _this.revision = revision;
        };
      })(this));
    }
  };

  LineClient.prototype.getProfile = function () {
    if (this._check_auth()) {
      return this._getProfile().then((function (_this) {
        return function (profile) {
          return _this.profile = new LineContact(_this, profile);
        };
      })(this));
    }
  };

  LineClient.prototype.getContactByName = function (name) {
    var contact, _i, _len, _ref;
    _ref = this.contacts;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      contact = _ref[_i];
      if (contact.name === name) {
        return contact;
      }
    }
  };

  LineClient.prototype.getContactById = function (id) {
    var contact, _i, _len, _ref;
    _ref = this.contacts;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      contact = _ref[_i];
      if (contact.id === id) {
        return contact;
      }
    }
  };

  LineClient.prototype.getContactOrRoomOrGroupById = function (id) {
    return this.getContactById(id) || this.getRoomById(id) || this.getGroupById(id);
  };

  LineClient.prototype.refreshGroups = function () {
    if (this._check_auth()) {
      this.groups = [];
      return this._getGroupIdsJoined().then((function (_this) {
        return function (groupIdsJoined) {
          _this.addGroupsWithIds(groupIdsJoined);
          return _this.addGroupsWithIds(groupIdsJoined, false);
        };
      })(this));
    }
  };

  LineClient.prototype.addGroupsWithIds = function (group_ids, is_joined) {
    if (is_joined == null) {
      is_joined = true;
    }
    if (this._check_auth()) {
      return this._getGroups(group_ids).then((function (_this) {
        return function (new_groups) {
          _this.groups = new_groups.map(function (group) {
            return new LineGroup(_this, group, is_joined);
          });
          return _this.groups.sort(function (a, b) {
            return a.id - b.id;
          });
        };
      })(this));
    }
  };

  LineClient.prototype.refreshContacts = function () {
    if (this._check_auth()) {
      return this._getAllContactIds().then((function (_this) {
        return function (contact_ids) {
          return _this._getContacts(contact_ids).then(function (contacts) {
            _this.contacts = contacts.map(function (contact) {
              return new LineContact(_this, contact);
            });
            return _this.contacts.sort(function (a, b) {
              return a.id - b.id;
            });
          });
        };
      })(this));
    }
  };

  LineClient.prototype.refreshActiveRooms = function () {
    var checkChannel, count, start;
    if (this._check_auth()) {
      start = 1;
      count = 50;
      this.rooms = [];
      while (true) {
        checkChannel = 0;
        this._getMessageBoxCompactWrapUpList(start, count).then((function (_this) {
          return function (channel) {
            var box, _i, _len, _ref;
            if (!channel.messageBoxWrapUpList) {
              return false;
            }
            checkChannel = channel.messageBoxWrapUpList.length;
            _ref = channel.messageBoxWrapUpList;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              box = _ref[_i];
              if (box.messageBox.midType === ttypes.MIDType.ROOM) {
                _this._getRoom(box.messageBox.id).then(function (room) {
                  return _this.rooms.push(new LineRoom(_this, room));
                });
              }
            }
            return channel;
          };
        })(this)).done(function (channel) {
          if (!channel) {
            checkChannel = 50;
          }
          console.log("Done this Channel: ");
          return console.dir(channel);
        });
        if (checkChannel === count) {
          start += count;
        } else {
          break;
        }
      }
      return true;
    }
  };

  LineClient.prototype.createGroupWithIds = function (ids) {
    if (ids == null) {
      ids = [];
    }
    if (this._check_auth()) {
      return this._createGroup("", ids).then((function (_this) {
        return function (created) {
          var group;
          group = new LineGroup(_this, created);
          _this.groups.push(created);
          return group;
        };
      })(this));
    }
  };

  LineClient.prototype.createGroupWithContacts = function (name, contacts) {
    var contact, contact_ids;
    if (contacts == null) {
      contacts = [];
    }
    if (this._check_auth()) {
      contact_ids = (function () {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = contacts.length; _i < _len; _i++) {
          contact = contacts[_i];
          _results.push(contact.id);
        }
        return _results;
      })();
      return this._createGroup(name, contact_ids).then((function (_this) {
        return function (created) {
          var group;
          group = new LineGroup(_this, created);
          _this.groups.push(group);
          return group;
        };
      })(this));
    }
  };

  LineClient.prototype.getGroupByName = function (name) {
    var group, _i, _len, _ref;
    _ref = this.groups;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      group = _ref[_i];
      if (name === group.name) {
        return group;
      }
    }
  };

  LineClient.prototype.getGroupById = function (id) {
    var group, _i, _len, _ref;
    _ref = this.groups;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      group = _ref[_i];
      if (id === group.id) {
        return group;
      }
    }
  };

  LineClient.prototype.inviteIntoGroup = function (group, contacts) {
    var contact, contact_ids;
    if (contacts == null) {
      contacts = [];
    }
    if (this._check_auth()) {
      contact_ids = (function () {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = contacts.length; _i < _len; _i++) {
          contact = contacts[_i];
          _results.push(contact.id);
        }
        return _results;
      })();
      return this._inviteIntoGroup(group.id, contact_ids);
    }
  };

  LineClient.prototype.acceptGroupInvitation = function (group) {
    if (this._check_auth()) {
      return this._acceptGroupInvitation(group.id).then(function () {
        return true;
      }, function () {
        return false;
      });
    }
  };

  LineClient.prototype.leaveGroup = function (group) {
    if (this._check_auth()) {
      return this._leaveGroup(group.id).then((function (_this) {
        return function () {
          _this.groups = _this.groups.filter(function (gp) {
            return gp.id !== group.id;
          });
          return true;
        };
      })(this), function () {
        return false;
      });
    }
  };

  LineClient.prototype.createRoomWithIds = function (ids) {
    if (ids == null) {
      ids = [];
    }
    if (this._check_auth()) {
      return this._createRoom(ids).then((function (_this) {
        return function (created) {
          var room;
          room = new LineRoom(_this, created);
          _this.rooms.push(room);
          return room;
        };
      })(this));
    }
  };

  LineClient.prototype.createRoomWithContacts = function (contacts) {
    var contact, contact_ids;
    if (contacts == null) {
      contacts = [];
    }
    if (this._check_auth()) {
      contact_ids = (function () {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = contacts.length; _i < _len; _i++) {
          contact = contacts[_i];
          _results.push(contact.id);
        }
        return _results;
      })();
      return this._createRoom(contact_ids).then((function (_this) {
        return function (created) {
          var room;
          room = new LineRoom(_this, created);
          _this.rooms.push(room);
          return room;
        };
      })(this));
    }
  };

  LineClient.prototype.getRoomById = function (id) {
    var room, _i, _len, _ref;
    _ref = this.rooms;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      room = _ref[_i];
      if (room.id === id) {
        return room;
      }
    }
  };

  LineClient.prototype.inviteIntoRoom = function (room, contacts) {
    var contact, contact_ids;
    if (contacts == null) {
      contacts = [];
    }
    if (this._check_auth()) {
      contact_ids = (function () {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = contacts.length; _i < _len; _i++) {
          contact = contacts[_i];
          _results.push(contact.id);
        }
        return _results;
      })();
      return this._inviteIntoRoom(room.id, contact_ids);
    }
  };

  LineClient.prototype.leaveRoom = function (room) {
    if (this._check_auth()) {
      return this._leaveRoom(room.id).then(function () {
        this.rooms = this.rooms.filter(function (rm) {
          return rm.id !== room.id;
        });
        return true;
      }, function () {
        return false;
      });
    }
  };

  LineClient.prototype.sendMessage = function (message, seq) {
    if (seq == null) {
      seq = 0;
    }
    if (this._check_auth()) {
      return this._sendMessage(message, seq);
    }
  };

  LineClient.prototype.getMessageBox = function (id) {
    if (this._check_auth()) {
      return this._getMessageBoxCompactWrapUp(id).then(function (messageBoxWrapUp) {
        return messageBoxWrapUp.messageBox;
      });
    }
  };

  LineClient.prototype.getRecentMessages = function (messageBox, count) {
    if (this._check_auth()) {
      return this._getRecentMessages(messageBox.id, count).then((function (_this) {
        return function (messages) {
          return _this.getLineMessageFromMessage(messages);
        };
      })(this));
    }
  };

  LineClient.prototype.longPoll = function (count) {
    var OT, TalkException;
    if (count == null) {
      count = 50;
    }
    if (this._check_auth()) {
      OT = ttypes.OpType;
      TalkException = ttypes.TalkException;
      return setInterval(Promise.coroutine((function (_this) {
        return regeneratorRuntime.mark(function callee$3$0() {
          var err, member, message, operation, operations, raw_receiver, raw_sender, receiver, sender, _i, _j, _len, _len1, _ref, _results;
          return regeneratorRuntime.wrap(function callee$3$0$(context$4$0) {
            while (1) switch (context$4$0.prev = context$4$0.next) {
              case 0:
                context$4$0.prev = 0;
                context$4$0.next = 3;
                return _this._fetchOperations(_this.revision, count);
              case 3:
                operations = context$4$0.sent;
                _results = [];
                _i = 0, _len = operations.length;
              case 6:
                if (!(_i < _len)) {
                  context$4$0.next = 30;
                  break;
                }
                operation = operations[_i];
                console.dir(operation);
                context$4$0.t0 = operation.type;
                context$4$0.next = context$4$0.t0 === OT.END_OF_OPERATION ? 12 : context$4$0.t0 === OT.SEND_MESSAGE ? 13 : context$4$0.t0 === OT.RECEIVE_MESSAGE ? 14 : 24;
                break;
              case 12:
                return context$4$0.abrupt("continue", 27);
              case 13:
                return context$4$0.abrupt("continue", 27);
              case 14:
                message = new LineMessage(operation.message);
                raw_sender = operation.message.from;
                raw_receiver = operation.message.to;
                sender = _this.getContactOrRoomOrGroupById(raw_sender);
                receiver = _this.getContactOrRoomOrGroupById(raw_receiver);
                if (!sender && typeof receiver === LineGroup) {
                  _ref = receiver.members;
                  for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
                    member = _ref[_j];
                    if (member.id === raw_sender) {
                      sender = member;
                    }
                  }
                }
                if (!sender || !receiver) {
                  _this.refreshGroups();
                  _this.refreshContacts();
                  _this.refreshActiveRooms();
                  sender = _this.getContactOrRoomOrGroupById(raw_sender);
                  receiver = _this.getContactOrRoomOrGroupById(raw_receiver);
                }
                context$4$0.next = 23;
                return [sender, receiver, message];
              case 23:
                return context$4$0.abrupt("break", 26);
              case 24:
                console.log("[*] " + OT._VALUES_TO_NAMES[operation.type]);
                console.dir(operation);
              case 26:
                _results.push(_this.revision = Math.max(operation.revision, _this.revision));
              case 27:
                _i++;
                context$4$0.next = 6;
                break;
              case 30:
                return context$4$0.abrupt("return", _results);
              case 33:
                context$4$0.prev = 33;
                context$4$0.t1 = context$4$0["catch"](0);
                err = context$4$0.t1;
                if (!(err instanceof TalkException && err.code === 9)) {
                  context$4$0.next = 38;
                  break;
                }
                throw new Error("user logged in on another machine");
              case 38:
              case "end":
                return context$4$0.stop();
            }
          }, callee$3$0, this, [[0, 33]]);
        });
      })(this)), 3000);
    }
  };

  LineClient.prototype.createContactOrRoomOrGroupByMessage = function (message) {
    if (message.toType === ttypes.MIDType.USER) {
      return console.log(message.toType);
    } else if (message.toType === ttypes.MIDType.ROOM) {
      return console.log(message.toType);
    } else if (message.toType === ttypes.MIDType.GROUP) {
      return console.log(message.toType);
    }
  };

  LineClient.prototype.getLineMessageFromMessage = function (messages) {
    if (messages == null) {
      messages = [];
    }
    return messages.map((function (_this) {
      return function (msg) {
        return new LineMessage(_this, msg);
      };
    })(this));
  };

  LineClient.prototype._check_auth = function () {
    if (this.authToken) {
      return true;
    } else {
      throw new Error("You need to login");
    }
  };

  return LineClient;
})(LineAPI);
"use strict";

var LINE_DOMAIN, config, os;

os = require("os");

LINE_DOMAIN = "gd2.line.naver.jp";

config = module.exports = {
  LINE_DOMAIN: LINE_DOMAIN,
  LINE_OS_URL: "os.line.naver.jp",
  LINE_HTTP_URL: "/api/v4/TalkService.do",
  LINE_STICKER_URL: "dl.stickershop.line.naver.jp/products/",
  LINE_POLL_URL: "/P4",
  LINE_CERTIFICATE_URL: "/Q",
  LINE_SHOP_PATH: "/SHOP4",
  LINE_SESSION_LINE_URL: "/authct/v1/keys/line",
  LINE_SESSION_NAVER_URL: "/authct/v1/keys/naver",
  ip: "127.0.0.1",
  version: "3.7.0",
  revision: 0,
  hostname: os.hostname(),
  EMAIL_REGEX: /[^@]+@[^@]+\.[^@]+/,
  Headers: {
    "User-Agent": "jsline (LINE DesktopApp for Linux)",
    "X-Line-Application": "DESKTOPWIN\t3.2.1.83\tWINDOWS\t5.1.2600-XP-x64"
  }
};

module.exports = {
  LineAPI: LineAPI,
  LineClient: LineClient,
  LineRoom: LineRoom,
  LineGroup: LineGroup,
  LineContact: LineContact,
  LineMessage: LineMessage
};
"use strict";
var ContentType,
    LineBase,
    LineContact,
    LineGroup,
    LineMessage,
    LineRoom,
    Message,
    Promise,
    fs,
    unirest,
    __extends = function (child, parent) {
  for (var key in parent) {
    if (__hasProp.call(parent, key)) child[key] = parent[key];
  }function ctor() {
    this.constructor = child;
  }ctor.prototype = parent.prototype;child.prototype = new ctor();child.__super__ = parent.prototype;return child;
},
    __hasProp = ({}).hasOwnProperty,
    __indexOf = [].indexOf || function (item) {
  for (var i = 0, l = this.length; i < l; i++) {
    if (i in this && this[i] === item) return i;
  }return -1;
};

fs = require("fs");

unirest = require("unirest");

Promise = require("bluebird");

Message = require("curve-thrift/line_types").Message;

ContentType = require("curve-thrift/line_types").ContentType;

Function.prototype.property = function (prop, desc) {
  return Object.defineProperty(this.prototype, prop, desc);
};

LineMessage = (function () {
  function LineMessage(client, message) {
    this._client = client;
    this.id = message.id;
    this.text = message.text;
    this.hasContent = message.hasContent;
    this.contentType = message.contentType;
    this.contentPreview = message.contentPreview;
    this.contentMetaData = message.contentMetadata;
    this.sender = client.getContactOrRoomOrGroupById(message._from);
    this.receiver = client.getContactOrRoomOrGroupById(message.to);
    this.toType = message.toType;
    this.createdTime = new Date(message.createdTime);
  }

  LineMessage.prototype.toString = function () {
    return "LineMessage (contentType=" + ContentType._VALUES_TO_NAMES[this.contentType] + ", sender=" + this.sender + ", receiver=" + this.receiver + ", msg=\"" + this.text + "\")";
  };

  return LineMessage;
})();

LineBase = (function () {
  function LineBase() {
    this._messageBox = null;
  }

  LineBase.prototype.sendMessage = function (text) {
    var message;
    message = new Message({
      to: this.id,
      text: text
    });
    return this._client.sendMessage(message).then(function (result) {
      return true;
    }, function (err) {
      if (err) {
        console.log(err);
      }
      return false;
    });
  };

  LineBase.prototype.sendSticker = function (stickerId, stickerPackageId, stickerVersion, stickerText) {
    var message;
    if (stickerId == null) {
      stickerId = "13";
    }
    if (stickerPackageId == null) {
      stickerPackageId = "1";
    }
    if (stickerVersion == null) {
      stickerVersion = "100";
    }
    if (stickerText == null) {
      stickerText = "[null]";
    }
    message = new Message({
      to: this.id,
      text: ""
    });
    message.contentType = ContentType.STICKER;
    message.contentMetadata = {
      STKID: stickerId,
      STKPKGID: stickerPackageId,
      STKVER: stickerVersion,
      STKTXT: stickerText
    };
    return this._client.sendMessage(message).then(function (result) {
      console.log(result);
      return true;
    }, function (err) {
      if (err) {
        console.log(err);
      }
      return false;
    });
  };

  LineBase.prototype.sendImage = function (path) {
    var defer;
    defer = Promise.defer();
    fs.readFile(path, (function (_this) {
      return function (readFileErr, buf) {
        var message;
        message = new Message({
          to: _this.id,
          text: "",
          contentType: ContentType.IMAGE,
          contentPreview: buf.toString("hex"),
          contentMetadata: {
            PREVIEW_URL: "",
            DOWNLOAD_URL: "",
            PUBLIC: "true"
          }
        });
        return _this._client.sendMessage(message).then(function (result) {
          console.log(result);
          return defer.resolve(true);
        }, function (err) {
          if (err) {
            console.log(err);
          }
          return defer.reject(false);
        });
      };
    })(this));
    return defer.promise;
  };

  LineBase.prototype.sendImageWithURL = function (url) {
    var defer;
    defer = Promise.defer();
    unirest.get(url).end(function (res) {
      if (res.error) {
        throw err;
      }
      return defer.resolve(res.raw_body);
    });
    return defer.promise.then((function (_this) {
      return function (image) {
        var message;
        message = new Message({
          to: _this.id,
          text: "",
          contentType: ContentType.IMAGE,
          contentPreview: image,
          contentMetadata: {
            PREVIEW_URL: url,
            DOWNLOAD_URL: url,
            PUBLIC: "true"
          }
        });
        _this._client.sendMessage(message, 1);
        return true;
      };
    })(this), function (err) {
      if (err) {
        console.log(err);
      }
      return false;
    });
  };

  LineBase.prototype.getRecentMessages = function (count) {
    if (count == null) {
      count = 1;
    }
    if (this._messageBox) {
      return this._client.getRecentMessages(this._messageBox, count);
    } else {
      return this._client.getMessageBox(this.id).then((function (_this) {
        return function (messageBox) {
          _this._messageBox = messageBox;
          return _this._client.getRecentMessages(_this._messageBox, count);
        };
      })(this));
    }
  };

  LineBase.prototype.valueOf = function () {
    return this.id;
  };

  return LineBase;
})();

LineGroup = (function (_super) {
  __extends(LineGroup, _super);

  function LineGroup(client, group, is_joined) {
    if (group == null) {
      group = null;
    }
    if (is_joined == null) {
      is_joined = true;
    }
    this._client = client;
    this._group = group;
    this.id = group.id;
    this.is_joined = is_joined;
    try {
      this.creator = new LineContact(client, group.creator);
    } catch (_error) {
      this.creator = null;
    }
    this.members = group.members.map(function (member) {
      return new LineContact(client, member);
    });
    if (group.invitee) {
      this.invitee = group.invitee.map(function (inv) {
        return new LineContact(client, inv);
      });
    } else {
      this.invitee = [];
    }
  }

  LineGroup.prototype.acceptGroupInvitation = function () {
    if (!this.is_joined) {
      return this._client.acceptGroupInvitation(this);
    } else {
      console.log("You are already in group");
      return false;
    }
  };

  LineGroup.prototype.leave = function () {
    var err;
    if (this.is_joined) {
      try {
        this.leaveGroup(this);
        return true;
      } catch (_error) {
        err = _error;
        return false;
      }
    } else {
      console.log("You are not joined to group");
      return false;
    }
  };

  LineGroup.prototype.getMemberIds = function () {
    var member, _i, _len, _ref, _results;
    _ref = this.members;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      member = _ref[_i];
      _results.push(member.id);
    }
    return _results;
  };

  LineGroup.prototype._containId = function (id) {
    return __indexOf.call(this.members, id) >= 0;
  };

  LineGroup.prototype.toString = function () {
    if (this.is_joined) {
      return "<LineGroup " + this.name + " #" + this.members.length + ">";
    } else {
      return "<LineGroup " + this.name + " #" + this.members.length + " (invited)>";
    }
  };

  return LineGroup;
})(LineBase);

LineRoom = (function (_super) {
  __extends(LineRoom, _super);

  function LineRoom(client, room) {
    this._client = client;
    this._room = room;
    this.id = room.mid;
    this.contacts = room.contacts.map(function (contact) {
      return new LineContact(client, contact);
    });
  }

  LineRoom.prototype.leave = function () {
    var err;
    try {
      this.leaveRoom(this);
      return true;
    } catch (_error) {
      err = _error;
      return false;
    }
  };

  LineRoom.prototype.invite = function (contact) {
    var err;
    try {
      return this._client.inviteIntoRoom(this, new LineContact(this._client, contact));
    } catch (_error) {
      err = _error;
      throw err;
    }
  };

  LineRoom.prototype.getContactIds = function () {
    var contact, _i, _len, _ref, _results;
    _ref = this.contacts;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      contact = _ref[_i];
      _results.push(contact.id);
    }
    return _results;
  };

  LineRoom.prototype._containId = function (id) {
    return __indexOf.call(this.contacts, id) >= 0;
  };

  LineRoom.prototype.toString = function () {
    return "<LineRoom " + this.contacts + ">";
  };

  return LineRoom;
})(LineBase);

LineContact = (function (_super) {
  __extends(LineContact, _super);

  function LineContact(client, contact) {
    this._client = client;
    this._contact = contact;
    this.id = contact.mid;
    this.name = contact.displayName;
    this.statusMessage = contact.statusMessage;
  }

  LineContact.property("rooms", {
    get: function () {
      return this._client.rooms.map((function (_this) {
        return function (room) {
          if (room._containId(_this.id)) {
            return room;
          }
        };
      })(this));
    },
    set: function (rooms) {
      return this.rooms = rooms;
    }
  });

  LineContact.property("groups", {
    get: function () {
      return this._client.groups.map(function (group) {
        if (group._containId(this.id)) {
          return group;
        }
      });
    },
    set: function (groups) {
      return this.groups = groups;
    }
  });

  LineContact.prototype.toString = function () {
    return "<LineContact " + this.name + ">";
  };

  return LineContact;
})(LineBase);
"use strict";
var PinVerifier, RSA, utf8;

utf8 = require("utf8");

RSA = require("node-bignumber");

PinVerifier = (function () {
  function PinVerifier(id, password, APIContext, config) {
    this.id = id;
    this.password = password;
    this._api = APIContext;
    this.config = config;
  }

  PinVerifier.prototype.getRSACrypto = function (json) {
    var chr, e, keyname, n, rsa, sessionKey, _ref;
    this.json = json;
    rsa = new RSA.Key();
    chr = String.fromCharCode;
    sessionKey = json.session_key;
    this.message = utf8.encode(chr(sessionKey.length) + sessionKey + chr(this.id.length) + this.id + chr(this.password.length) + this.password);
    _ref = json.rsa_key.split(","), keyname = _ref[0], n = _ref[1], e = _ref[2];
    rsa.setPublic(n.toString(16), e.toString(16));
    this.crypto = rsa.encrypt(this.message);
    return {
      crypto: this.crypto,
      message: this.message
    };
  };

  return PinVerifier;
})();