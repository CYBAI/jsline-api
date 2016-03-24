'use strict'

import fs from 'fs';
import unirest from 'unirest';
import Promise from 'bluebird';
import { Message, ContentType } from 'curve-thrift/line_types';
import { config } from './config';

class LineMessage {
  constructor(client, message) {
    this._client = client;
    this.id = message.id;
    this.text = message.text;
    this.hasContent = message.hasContent;
    this.contentType = message.contentType;
    this.contentPreview = message.contentPreview;
    this.contentMetaData = message.contentMetadata;
    this.sender = client.getContactOrRoomOrGroupById(message._from)
    this.receiver = client.getContactOrRoomOrGroupById(message.to);
    this.toType = message.toType;
    this.createdTime = new Date(message.createdTime);
  }

  toString() {
    return `
      LineMessage
      (contentType=${ContentType._VALUES_TO_NAMES[this.contentType]},
        sender=${this.sender}, receiver=${this.receiver}, msg=\"${this.text}\")
    `;
  }
}

class LineBase {
  constructor() {
    this._messageBox = null;
  }

  sendMessage(text) {
    let message = new Message({ to: this.id, text: text });
    return this._client.sendMessage(message)
      .then((result) => {
        console.log(result);
        return true;
      }, (err) => {
        if (err) console.error(err);
        return false;
      });
  }

  sendSticker(
    stickerId='13',
    stickerPackageId='1',
    stickerVersion='100',
    stickerText='[null]') {
    let message = new Message({ to: this.id, text: '' });

    message.contentType = ContentType.STICKER;
    message.contentMetadata = {
      STKID: stickerId,
      STKPKGID: stickerPackageId,
      STKVER: stickerVersion,
      STKTXT: stickerText
    };

    return this._client.sendMessage(message)
      .then((result) => {
        console.log(result);
        return true;
      }, (err) => {
        if (err) console.error(err);
        return false;
      });
  }

  sendImage(path) {
    //  fs_readFile = Promise.promisify(fs.readFile)
    let defer = Promise.pending();
    fs.readFile(path, (readFileErr, buf) => {
      message = new Message({
        to: this.id,
        text: '',
        contentType: ContentType.IMAGE,
        contentPreview: buf.toString('hex'),
        contentMetadata: {
          PREVIEW_URL: '',
          DOWNLOAD_URL: '',
          PUBLIC: 'true'
        }
      });
      return this._client.sendMessage(message)
        .then((result) => {
          console.log(result)
          return defer.resolve(true);
        }, (err) => {
          if (err) console.error(err);
          return defer.reject(false);
        });
    });
    return defer.promise;
  }

  sendImageWithURL(url) {
    let defer = Promise.pending();
    unirest.get(url)
    .end((res) => {
      if (res.error) throw res.error;
      return defer.resolve(res.raw_body);
    })

    return defer.promise.then((image) => {
      let message = new Message({
        to: this.id,
        text: '',
        contentType: ContentType.IMAGE,
        contentPreview: image,
        contentMetadata: {
          PREVIEW_URL: url,
          DOWNLOAD_URL: url,
          PUBLIC: 'true'
        }
      });
      this._client.sendMessage(message, 1);
      return true;
    }, (err) => {
      if (err) console.error(err);
      return false;
    });
  }

  getRecentMessages(count = 1) {
    if (this._messageBox) {
      return this._client.getRecentMessages(this._messageBox, count);
    } else {
      return this._client.getMessageBox(this.id)
        .then((messageBox) => {
          this._messageBox = messageBox;
          return this._client.getRecentMessages(this._messageBox, count);
        });
    }
  }

  valueOf() {
    return this.id;
  }
}

class LineGroup extends LineBase {
  constructor(client, group=null, isJoined=true) {
    super();
    this._client = client;
    this._group = group;
    this.id = group.id;
    this.isJoined = isJoined;
    try {
      this.creator = new LineContact(client, group.creator);
    } catch(err) {
      this.creator = null;
    }
    this.members = group.members.map(member => new LineContact(client,member));
    if (group.invitee) {
      this.invitee = group.invitee.map(inv => new LineContact(client,inv));
    } else {
      this.invitee = [];
    }
  }

  acceptGroupInvitation() {
    if (!this.isJoined) {
      return this._client.acceptGroupInvitation(this);
    } else {
      console.log('You are already in group');
      return false;
    }
  }

  leave() {
    if (this.isJoined) {
      try {
        this.leaveGroup(this);
        return true;
      } catch (err) {
        console.log('Failed to leave group!');
        return false;
      }
    } else {
      console.log('You are not joined to group');
      return false;
    }
  }

  getMemberIds() {
    let memberIds = [];
    for (let i = 0, len = this.members.length; i < len; i++) {
      memberIds.push(this.members[i].id);
    }
    return memberIds;
  }

  _containId(id) {
    return Array.isArray(this.members) && this.members.indexOf(id) >= 0;
  }

  toString() {
    return this.id;
    // if (this.isJoined) {
    //   return `<LineGroup ${this.name} #${this.members.length}>`;
    // } else {
    //   return `<LineGroup ${this.name} #${this.members.length} (invited)>`;
    // }
  }
}

class LineRoom extends LineBase {
  constructor(client, room) {
    super();
    this._client = client;
    this._room = room;
    this.id = room.mid;
    this.contacts = room.contacts.map(contact => new LineContact(client,contact));
  }

  leave() {
    try {
      this.leaveRoom(this);
      return true;
    } catch (err) {
      console.log('Failed to leave room!');
      console.error(err);
      return false;
    }
  }

  invite(contact) {
    try {
      return this._client.inviteIntoRoom(this, new LineContact(this._client, contact));
    } catch (err) {
      console.log('Failed to invite sb into room');
      console.error(err);
      return false;
    }
  }

  getContactIds() {
    let contactIds = [];
    for (let i = 0, len = this.contacts.length; i < len; i++) {
      contactIds.push(this.contacts[i].id);
    }
    return contactIds;
  }

  _containId(id) {
    return Array.isArray(this.contacts) && this.contacts.indexOf(id) >= 0;
  }

  toString() {
    return `<LineRoom ${this.contacts}>`;
  }
}

class LineContact extends LineBase {
  constructor(client, contact) {
    super();
    this._client = client;
    this._contact = contact;
    this.id = contact.mid;
    this.name = contact.displayName;
    this.iconPath = `http://${config.LINE_OS_URL}${contact.picturePath}/preview`;
    this.statusMessage = contact.statusMessage;
  }

  set rooms(contactRooms) {
    this.rooms = contactRooms;
  }

  get rooms() {
    return this._client.rooms.map((room) => {
      if (room._containId(this.id)) {
        return room;
      }
    });
  }

  set groups(contactGroups) {
    this.groups = contactGroups;
  }

  get groups() {
    return this._client.groups.map((group) => {
      if (group._containId(this.id)) {
        return group;
      }
    })
  }

  toString() {
    return this.id;
    // return `<LineContact ${this.name}>`;
  }
}

export {
  LineRoom,
  LineGroup,
  LineMessage,
  LineContact,
}
