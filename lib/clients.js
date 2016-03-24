'use strict'

import util from 'util';
import Promise from 'bluebird'
// Promise.longStackTraces()
import ttypes from 'curve-thrift/line_types';

import { LineAPI } from './api';
import { LineRoom, LineGroup, LineContact, LineMessage } from './models';

ttypes.OpType._VALUES_TO_NAMES = (type) => {
  for (let obj in ttypes.OpType) {
    if (type === obj.typeNumber) {
      return obj.name;
    }
  }
}

export class LineClient extends LineAPI {
  constructor(id = null, password = null, authToken = null, certificate = null, is_mac = false, com_name = 'cybai') {
    super(); // super config
    console.log(this.config);
    if (!(authToken || id && password)) {
      throw new Error('id and password or authToken is needed');
    }

    if (this.config.platform === 'MAC') {
      is_mac = true;
      this.config.Headers['User-Agent'] = `DESKTOP:MAC:${this.config.version}(10.9.4-MAVERICKS-x64)`;
      this.config.Headers['X-Line-Application'] = `DESKTOPMAC\t${this.config.version}\tMAC\t10.9.4-MAVERICKS-x64`;
    }

    if (authToken) {
      this.authToken = authToken;
      this.config.Headers['X-Line-Access'] = authToken;
    } else {
      this._setProvider(id);
      this.id = id;
      this.password = password;
      this.is_mac = is_mac;
    }

    if (certificate) {
      this.certificate = certificate;
    }
  }

  login() {
    let defer = Promise.pending();
    let loginPromise = this.authToken ? this._tokenLogin(this.authToken, this.certificate) : this._login(this.id, this.password);
    loginPromise.then((result) => {
      if (result.authToken && !this.authToken) {
        this.authToken = result.authToken;
      }
      if (result.certificate && !this.certificate) {
        this.certificate = result.certificate;
      }
      return Promise.join(this.getLastOpRevision(), this.getProfile(), this.refreshContacts(), this.refreshGroups(), this.refreshActiveRooms(), (lastOp, profile, groups, contacts, rooms) => {
        console.log('Promise.join finished!');
        console.log(lastOp);
        console.log(profile);
        console.log(contacts);
        console.log(groups);
        console.log(rooms);
        console.log(this);
      })
      .then(() => {
        console.log('Login Successfully');
        defer.resolve(result);
      }, (err) => {
        console.error(err);
        return false;
      });
    });
    return defer.promise;
  }

  getLastOpRevision() {
    if (this._check_auth()) {
      return this._getLastOpRevision().then((revision) => this.revision = revision);
    }
  }

  getProfile() {
    if (this._check_auth()) {
      return this._getProfile().then((profile) => this.profile = new LineContact(this, profile))
    }
  }

  getContactByName(name) {
    for (let i = 0, len = this.contacts.length; i < len; i++) {
      if (this.contacts[i].name === name) {
        return this.contacts[i];
      }
    }
  }

  getContactById(id) {
    for (let i = 0, len = this.contacts.length; i < len; i++) {
      if (this.contacts[i].id === id) {
        return this.contacts[i];
      }
    }
  }

  getContactOrRoomOrGroupById(id) {
    return this.getContactById(id) || this.getRoomById(id) || this.getGroupById(id);
  }

  addGroupsWithIds(groupIds, isJoined = true) {
    if (this._check_auth()) {
      return this._getGroups(groupIds).then((newGroups) => {
        this.groups = newGroups.map((group) => new LineGroup(this, group, isJoined));
        this.groups.sort((a, b) => a.id - b.id);
        return true;
      }, () => false);
    }
  }

  refreshContacts() {
    if (this._check_auth()) {
      this.contacts = [];
      return this._getAllContactIds().then((contactIds) => {
        return this._getContacts(contactIds).then((contacts) => {
          this.contacts = contacts.map((contact) => new LineContact(this, contact));
          this.contacts.sort((a, b) => a.id - b.id);
          return this.contacts;
        });
      }).catch(err => {
        if (err.code === 8) {
          this.authToken = null;
          this.certificate = null;
          let errMsg = `${err.reason}, please login again`;
          typeof alert === 'undefined' ? console.log(errMsg) : alert(errMsg);
        }
      });
    }
  }

  refreshGroups() {
    if (this._check_auth()) {
      this.groups = []
      this._getGroupIdsJoined().then((groupIdsJoined) => this.addGroupsWithIds(groupIdsJoined));
      this._getGroupIdsInvited().then((groupIdsInvited) => this.addGroupsWithIds(groupIdsInvited, false));
      return this.groups;
    }
  }

  refreshActiveRooms() {
    if (this._check_auth()) {
      let checkChannel = 0;
      let start = 1;
      let count = 50;
      this.rooms = [];
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
      return this.rooms;
    }
  }

  createGroupWithIds(ids = []) {
    if (this._check_auth()) {
      return this._createGroup('', ids)
      .then((created) => {
        let group = new LineGroup(this, created);
        this.groups.push(created);
        return group;
      })
    }
  }

  createGroupWithContacts(name, contacts = []) {
    if (this._check_auth()) {
      let contactIds = [];
      for (let i = 0, len = contacts.length; i < len; i++) {
        contactIds.push(contacts[i].id);
      }
      return this._createGroup(name, contactIds)
      .then((created) => {
        let group = new LineGroup(this, created);
        this.groups.push(group);
        return group;
      })
    }
  }

  getGroupByName(name) {
    for (let i = 0, len = this.groups.length; i < len; i++) {
      if (groups[i].name === name) {
        return groups[i];
      }
    }
  }

  getGroupById(id) {
    for (let i = 0, len = this.groups.length; i < len; i++) {
      if (groups[i].id === id) {
        return groups[i];
      }
    }
  }

  inviteIntoGroup(group, contacts = []) {
    if (this._check_auth()) {
      let contactIds = [];
      for (let i = 0, len = contacts.length; i < len; i++) {
        contacts.push(contact.id);
      }
      return this._inviteIntoGroup(group.id, contactIds);
    }
  }

  acceptGroupInvitation(group) {
    if (this._check_auth()) {
      return this._acceptGroupInvitation(group.id)
        .then(() => true, () => false);
    }
  }

  leaveGroup(group) {
    if (this._check_auth()) {
      return this._leaveGroup(group.id)
      .then(() => {
        this.groups = this.groups.filter((gp) => gp.id !== group.id);
        return true;
      }, () => false);
    }
  }

  createRoomWithIds(ids = []) {
    if (this._check_auth()) {
      return this._createRoom(ids)
      .then((created) => {
        let room = new LineRoom(this, created);
        this.rooms.push(room);
        return room;
      });
    }
  }

  createRoomWithContacts(contacts = []) {
    if (this._check_auth()) {
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
    if (this._check_auth()) {
      let contactIds = [];
      for (let i = 0, len = contacts.length; i < len; i++) {
        contacts.push(contact.id);
      }
      return this._inviteIntoRoom(room.id, contactIds);
    }
  }

  leaveRoom(room) {
    if (this._check_auth()) {
      return this._leaveRoom(room.id)
        .then(() => {
          this.rooms = this.rooms.filter((rm) => rm.id !== room.id);
          return true;
        }, () => false);
    }
  }

  sendMessage(message, seq = 0) {
    if (this._check_auth()) {
      return this._sendMessage(message, seq);
    }
  }

  getMessageBox(id) {
    if (this._check_auth()) {
      return this._getMessageBoxCompactWrapUp(id)
        .then((messageBoxWrapUp) => messageBoxWrapUp.messageBox);
    }
  }

  getRecentMessages(messageBox, count) {
    if (this._check_auth()) {
      return this._getRecentMessages(messageBox.id, count)
        .then((messages) => this.getLineMessageFromMessage(messages));
    }
  }

  // longPoll(count = 50) {
  //   if (this._check_auth()) {
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

  _check_auth() {
    if (this.authToken) {
      return true;
    } else {
      throw new Error('Still not login, please login first.');
    }
  }
}
