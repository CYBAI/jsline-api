import Promise from 'bluebird'
// Promise.longStackTraces()
import ttypes from 'curve-thrift/line_types';

import { LineAPI } from './api';
import { LineRoom, LineGroup, LineContact, LineMessage } from './models';

export class LineClient extends LineAPI {
  /**
   * Constructor of LineClient, initiate basic info for login
   * @param  {String}  id          =   null    [Default to null, account id of client]
   * @param  {String}  password    =   null    [Default to null, password of client]
   * @param  {String}  authToken   =   null    [Default to null, authentication token of LINE]
   * @param  {String}  certificate =   null    [Default to null, certification of LINE]
   */
  constructor(id = null, password = null, authToken = null, certificate = null) {
    super();
    if (!(authToken || id && password)) {
      throw new Error('id and password or authToken is needed');
    }

    this.id = id;
    this.password = password;
    this.certificate = certificate;

    if (this.config.platform === 'MAC') {
      this.config.Headers['User-Agent'] = `DESKTOP:MAC:${this.config.version}(10.9.4-MAVERICKS-x64)`;
      this.config.Headers['X-Line-Application'] = `DESKTOPMAC\t${this.config.version}\tMAC\t10.9.4-MAVERICKS-x64`;
    }

    if (authToken) {
      this.authToken = authToken;
      this.config.Headers['X-Line-Access'] = authToken;
    } else {
      this._setProvider(id);
    }

    this.contacts = [];
    this.rooms = [];
    this.groups = [];
  }

  /**
   * Login to LINE
   * @return {Promise} [If login successfully return result with authToken
   *                   and certificate, or return error message]
   */
  login() {
    let loginPromise = this.authToken ? this._tokenLogin(this.authToken, this.certificate) : this._login(this.id, this.password);
    return loginPromise.then((result) => {
      if (result.authToken && !this.authToken) {
        this.authToken = result.authToken;
      }
      if (result.certificate && !this.certificate) {
        this.certificate = result.certificate;
      }
      return Promise.join(this.getLastOpRevision(), this.getProfile(), this.refreshContacts(), this.refreshGroups(), this.refreshActiveRooms(), (lastOp, profile, contacts, groups, rooms) => {
        console.log('Promise.join finished!');
        // console.log(lastOp);
        // console.log(profile);
        // console.log(contacts);
        // console.log(groups);
        // console.log(rooms);
        // console.log(this);
      }).then(_ => {
        console.log('Login Successfully');
        return result;
      }).catch(err => {
        console.error(err);
        return err;
      });
    });
  }

  /**
   * Get last operation revision
   * @return {Promise} [return revision when promise successfully,
   *                    or return promise with error message]
   */
  getLastOpRevision() {
    if (this._checkAuth()) {
      return this._getLastOpRevision().then((revision) => this.revision = revision);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Get profile of client
   * @return {Promise} [return profile when promise successfully,
   *                    or return promise with error message]
   */
  getProfile() {
    if (this._checkAuth()) {
      return this._getProfile().then((profile) => this.profile = new LineContact(this, profile))
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Get the LineContact searching by name
   * @param  {String} name [contact name which want to find]
   * @return {LineContact} [LineContact which name matches the passing parameter]
   */
  getContactByName(name) {
    for (let i = 0, len = this.contacts.length; i < len; i++) {
      if (this.contacts[i].name === name) {
        return this.contacts[i];
      }
    }
  }

  /**
   * Get the LineContact searching by id
   * @param  {String} id   [contact id which want to find]
   * @return {LineContact} [LineContact which id matches the passing parameter]
   */
  getContactById(id) {
    for (let i = 0, len = this.contacts.length; i < len; i++) {
      if (this.contacts[i].id === id) {
        return this.contacts[i];
      }
    }
  }

  /**
   * Get a LineContact or LineRoom or LineGroup searching by id
   * @param  {String} id [user id which want to find]
   * @return {LineContact|LineRoom|LineGroup}    [LineContact/LineRoom/LineGroup which id matches the passing parameter]
   */
  getContactOrRoomOrGroupById(id) {
    return this.getContactById(id) || this.getRoomById(id) || this.getGroupById(id);
  }

  /**
   * Get groups from groupIds, initiate them into LineGroup, and push to this.groups
   * @param {Array}  groupIds         [an array of group ids]
   * @param {Boolean} isJoined = true [a boolean value to determine user joined the group or not]
   * @return {Promise}                [return initiated this.groups when promise successfully,
   *                                   or return promise with error message]
   */
  addGroupsWithIds(groupIds, isJoined = true) {
    if (this._checkAuth()) {
      return this._getGroups(groupIds).then(newGroups => {
        let newGroupsContext = newGroups.map(group => new LineGroup(this, group, isJoined))
        this.groups = this.groups.concat(newGroupsContext);
        this.groups.sort((a, b) => a.id - b.id);
        return this.groups;
      }).catch(err => err);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Get contacts, initiate them into LineContact, and push to this.contacts
   * @return {Promise} [return initiated this.contacts when promise successfully,
   *                    or return promise with error message]
   */
  refreshContacts() {
    if (this._checkAuth()) {
      return this._getAllContactIds().then(contactIds => {
        return this._getContacts(contactIds).then(contacts => {
          this.contacts = contacts.map((contact) => new LineContact(this, contact));
          this.contacts.sort((a, b) => a.id - b.id);
          return this.contacts;
        });
      }).catch(err => {
        if (err.code === 8) {
          this.authToken = null;
          this.certificate = null;
          this._client.alertOrConsoleLog(`${err.reason}, please login again`);
        }
        return err;
      });
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Call addGroupsWithIds to initiate groups
   * @return {Promise} [return initiated this.groups when promise successfully,
   *                    or return promise with error message]
   */
  refreshGroups() {
    if (this._checkAuth()) {
      this._getGroupIdsJoined().then(groupIdsJoined => this.addGroupsWithIds(groupIdsJoined));
      this._getGroupIdsInvited().then(groupIdsInvited => this.addGroupsWithIds(groupIdsInvited, false));
      return Promise.resolve(this.groups);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Reresh active rooms and initiate rooms into LineRoom
   * @return {Promise} [return initiated this.rooms when promise successfully,
   *                    or return promise with error message]
   */
  refreshActiveRooms() {
    if (this._checkAuth()) {
      let start = 1;
      let count = 50;
      while (true) {
        let checkChannel = 0
        this._getMessageBoxCompactWrapUpList(start, count)
        .then((channel) => {
          if (!channel.messageBoxWrapUpList) return false
          checkChannel = channel.messageBoxWrapUpList.length;
          for (let i = 0, len = channel.messageBoxWrapUpList; i < len; i++) {
            let box = channel.messageBoxWrapUpList[i];
            if (box.messageBox.midType === ttypes.MIDType.ROOM) {
              this._getRoom(box.messageBox.id)
                .then((room) => this.rooms.push(new LineRoom(this, room)));
            }
          }
          return channel;
        }).done((channel) => {
          if (!channel) {
            checkChannel = 50;
          }
          console.log('Done this Channel: ');
          console.dir(channel);
        });

        if (checkChannel === count) {
          start += count;
        } else {
          break;
        }
      }
      return Promise.resolve(this.rooms);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Create group with LineContact ids
   * @param  {String} name    [name of created LineGroup]
   * @param  {Array} ids = [] [Default value to empty array, or it should contain LineContact ids]
   * @return {Promise}        [return created LineGroup when promise successfully,
   *                           or return promise with error message]
   */
  createGroupWithIds(name, ids = []) {
    if (this._checkAuth()) {
      return this._createGroup(name, ids)
        .then(created => {
          let group = new LineGroup(this, created);
          this.groups.push(group);
          return group;
        });
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Create group with LineContact instances
   * @param  {String} name         [name of created LineGroup]
   * @param  {Array} contacts = [] [Default value to empty array, or
   *                          			it should contain LineContact instances]
   * @return {Promise}             [return created LineGroup when promise successfully,
   *                                or return promise with error message]
   */
  createGroupWithContacts(name, contacts = []) {
    if (this._checkAuth()) {
      let contactIds = [];
      for (let i = 0, len = contacts.length; i < len; i++) {
        contactIds.push(contacts[i].id);
      }
      return this._createGroup(name, contactIds)
        .then((created) => {
          let group = new LineGroup(this, created);
          this.groups.push(group);
          return group;
        });
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Get LineGroup instance by name of group
   * @param  {String} name [name of group which want to get]
   * @return {LineGroup}   [LineGroup instance which name is equal to the name in param]
   */
  getGroupByName(name) {
    for (let i = 0, len = this.groups.length; i < len; i++) {
      if (this.groups[i].name === name) {
        return this.groups[i];
      }
    }
  }

  /**
   * Get LineGroup instance by id of group
   * @param  {String} id [id of group which want to get]
   * @return {LineGroup} [LineGroup instance which id is equal to the id in param]
   */
  getGroupById(id) {
    for (let i = 0, len = this.groups.length; i < len; i++) {
      if (this.groups[i].id === id) {
        return this.groups[i];
      }
    }
  }

  /**
   * Invite contact(s) into a LineGroup
   * @param  {LineGroup} group      [LineGroup instance which client want to invite contact(s) into]
   * @param  {Array} contacts = []  [Array of LineContact(s) which will be invited into the group]
   * @return {Promise}              [handle result by promise or receive
   *                                 promise with error message directly]
   */
  inviteIntoGroup(group, contacts = []) {
    if (this._checkAuth()) {
      let contactIds = [];
      for (let i = 0, len = this.contacts.length; i < len; i++) {
        contactIds.push(this.contacts[i].id);
      }
      return this._inviteIntoGroup(group.id, contactIds);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  /**
   * Accept group invitation
   * @param  {LineGroup} group [LineGroup instance which client want to accept]
   * @return {Promise}         [handle result by promise or receive
   *                            promise with error message directly]
   */
  acceptGroupInvitation(group) {
    if (this._checkAuth()) {
      return this._acceptGroupInvitation(group.id);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  leaveGroup(group) {
    if (this._checkAuth()) {
      return this._leaveGroup(group.id)
      .then(() => {
        this.groups = this.groups.filter((gp) => gp.id !== group.id);
        return true;
      }, () => false);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  createRoomWithIds(ids = []) {
    if (this._checkAuth()) {
      return this._createRoom(ids)
      .then((created) => {
        let room = new LineRoom(this, created);
        this.rooms.push(room);
        return room;
      });
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  createRoomWithContacts(contacts = []) {
    if (this._checkAuth()) {
      let contactIds = [];
      for (let i = 0, len = contacts.length; i < len; i++) {
        contacts.push(contact.id);
      }
      return this._createRoom(contactIds)
        .then((created) => {
          let room = new LineRoom(this, created);
          this.rooms.push(room);
          return room;
        });
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  getRoomById(id) {
    for (let i = 0, len = this.rooms.length; i < len; i++) {
      if (rooms[i].id === id) {
        return rooms[i];
      }
    }
  }

  inviteIntoRoom(room, contacts = []) {
    if (this._checkAuth()) {
      let contactIds = [];
      for (let i = 0, len = contacts.length; i < len; i++) {
        contacts.push(contact.id);
      }
      return this._inviteIntoRoom(room.id, contactIds);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  leaveRoom(room) {
    if (this._checkAuth()) {
      return this._leaveRoom(room.id)
        .then(() => {
          this.rooms = this.rooms.filter((rm) => rm.id !== room.id);
          return true;
        }, () => false);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  sendMessage(message, seq = 0) {
    if (this._checkAuth()) {
      return this._sendMessage(message, seq);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  sendChatChecked(consumer, lastMessageId, seq = 0) {
    if (this._checkAuth()) {
      return this._sendChatChecked(consumer, lastMessageId, seq);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  getMessageBox(id) {
    if (this._checkAuth()) {
      return this._getMessageBoxCompactWrapUp(id)
        .then((messageBoxWrapUp) => messageBoxWrapUp.messageBox);
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  getRecentMessages(messageBox, count) {
    if (this._checkAuth()) {
      return this._getRecentMessages(messageBox.id, count)
        .then((messages) => this.getLineMessageFromMessage(messages));
    } else {
      return Promise.reject(new Error('Please Login first'));
    }
  }

  // longPoll(count = 50) {
  //   if (this._checkAuth()) {
  //     let OT = ttypes.OpType;
  //     let TalkException = ttypes.TalkException;
  //     setInterval(
  //       Promise.coroutine(
  //         () => {
  //           try {
  //             let operations = yield this._fetchOperations(this.revision, count);
  //             for (let i = 0, opLen = operations.length; i < opLen; i++) {
  //               let operation = operations[i];
  //               console.dir(operation);
  //               switch (operation.type) {
  //                 case OT.END_OF_OPERATION:
  //                 case OT.SEND_MESSAGE:
  //                 case OT.RECEIVE_MESSAGE:
  //                   let message = new LineMessage(this, operation.message);
  //
  //                   let rawSender = operation.message.from;
  //                   let rawReceiver = operation.message.to;
  //
  //                   let sender = this.getContactOrRoomOrGroupById(rawSender);
  //                   let receiver = this.getContactOrRoomOrGroupById(rawReceiver);
  //
  //                   if (!sender && typeof receiver === LineGroup) {
  //                     for (let j = 0, memLen = receiver.members; j < memLen; j++) {
  //                       if (receiver.members[j].id === rawSender) {
  //                         sender = receiver.members[j].id;
  //                       }
  //                     }
  //                   }
  //
  //                   if (!sender || !receiver) {
  //                     this.refreshGroups();
  //                     this.refreshContacts();
  //                     this.refreshActiveRooms();
  //                     sender = this.getContactOrRoomOrGroupById(rawSender);
  //                     receiver = this.getContactOrRoomOrGroupById(rawReceiver);
  //                   }
  //
  //                   yield [sender, receiver, message];
  //                   break;
  //                 default:
  //                   console.log(`[*] ${OT._VALUES_TO_NAMES[operation.type]}`)
  //                   console.dir(operation);
  //                   break;
  //               }
  //
  //               this.revision = Math.max(operation.revision, this.revision);
  //               return this.revision;
  //             }
  //           } catch (err) {
  //             console.error(err);
  //             if (err instanceof TalkException && err.code === 9) {
  //               throw new Error('user logged in on another machine');
  //             }
  //           }
  //       }), 3000);
  //   }
  // }

  createContactOrRoomOrGroupByMessage(message) {
    switch (message.toType) {
      case ttypes.MIDType.USER:
      case ttypes.MIDType.ROOM:
      case ttypes.MIDType.GROUP:
        console.log(message.toType);
        break;
      default:
        console.log(message.toType);
    }
  }

  getLineMessageFromMessage(messages = []) {
    return messages.map((msg) => new LineMessage(this, msg));
  }

  _checkAuth() {
    return !!this.authToken;
  }
}
