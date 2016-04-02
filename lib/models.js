import fs from 'fs';
import unirest from 'unirest';
import Promise from 'bluebird';
import { Message, ContentType } from 'curve-thrift/line_types';
import { config } from './config';

class LineMessage {
  /**
   * LineMessage constructor
   * @param  {Thrift HttpClient} client  [client object of who logged in]
   * @param  {String} message            [LineMessage object]
   */
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

  /**
   * Override toString method
   * @return {String} [Print some important info of LineMessage]
   */
  toString() {
    return `
      LineMessage
      (contentType=${ContentType._VALUES_TO_NAMES[this.contentType]},
        sender=${this.sender}, receiver=${this.receiver}, msg=\"${this.text}\")
    `;
  }
}

class LineBase {
  /**
   * Constructor of base class of each line users, including groups, rooms, and contacts
   * and initiate message box for each user object
   */
  constructor() {
    this._messageBox = null;
  }

  /**
   * Send text message
   * @param  {String} text [content of text message]
   * @return {Promise}     [return sendMessage promise to handle result or error]
   */
  sendMessage(text) {
    let message = new Message({ to: this.id, text: text });
    return this._client.sendMessage(message);
  }

  /**
   * Send sticker message
   * @param  {String} stickerId='13'       [default value to 13, a string number of sticker id]
   * @param  {String} stickerPackageId='1' [default value to 1, a string number of sticker package id]
   * @param  {String} stickerVersion='100' [default value to 100, a string number of sticker version]
   * @param  {String} stickerText='[null]' [default value to null, a string of sticker text]
   * @return {Promise}                     [return sendSticker promise to handle result or error]
   */
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

    return this._client.sendMessage(message);
  }

  /**
   * Send image message from a path
   * @param  {String} path [full path string to read the file]
   * @return {Promise}     [return fs promise to handle result or error]
   */
  sendImage(path) {
    let defer = Promise.pending();
    fs.readFile(path, (readFileErr, buf) => {
      if (readFileErr) { return defer.reject(readFileErr); }
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
      return defer.resolve(this._client.sendMessage(message));
    });
    return defer.promise;
  }

  /**
   * Send image message from an URL
   * @param  {String} url [image URL]
   * @return {Promise}    [return promise of sending image with url to handle result or error]
   */
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
      return this._client.sendMessage(message, 1);
    }, (err) => {
      if (err) console.error(err);
      return err;
    });
  }

  /**
   * Get recent messages
   * @param  {Number} count=1 [default value to 1, number of messages wanna get]
   * @return {Promise}        [return promise of getRecentMessages to handle result or error]
   */
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

  /**
   * Override valueOf method to compare value with ID
   * @return {String} [return id of an user, including groups or rooms or contacts]
   */
  valueOf() {
    return this.id;
  }
}

class LineGroup extends LineBase {
  /**
   * Constructor of LineGroup, initiate base info of a group context
   * @param  {Thrift HttpClient}  client [Client context of the group]
   * @param  {LineGroup}  group          [original group context, and using it to initiate `this`]
   * @param  {Boolean} isJoined=true     [default value to true, if use has joined the group, it will be true]
   */
  constructor(client, group, isJoined=true) {
    super();
    this._client = client;
    this._group = group;
    this.isJoined = isJoined;
    if (!group) {
      this.id = null;
      this.name = null;
      this.creator = null;
      this.invitee = [];
      this.members = [];
    } else {
      this.id = group.id;
      this.name = group.name;
      this.creator = group.creator ? new LineContact(client, group.creator) : null;
      this.invitee = group.invitee ? group.invitee.map(inv => new LineContact(client, inv)) : [];
      this.members = group.members ? group.members.map(member => new LineContact(client, member)) : [];
    }
  }

  /**
   * Accept a group invitation
   * @return {Promise} [if user has joined the group,
   *                   then user will just get a `Boolean` value of false
   *                   from Promise.resolve. ]
   */
  acceptGroupInvitation() {
    if (!this.isJoined) {
      return this._client.acceptGroupInvitation(this);
    } else {
      return Promise.resolve({
        success: false,
        message: 'You are already in group'
      });
    }
  }

  /**
   * Leave group method to each LineGroup
   * @return {Promise} [User will only get result from _client.leaveGroup
   *                   when leaving successfully. Besides, user will get `false`
   *                   from Promise.resolve immediately when not joining the group]
   */
  leave() {
    if (this.isJoined) {
      return this._client.leaveGroup(this);
    } else {
      return Promise.resolve({
        success: false,
        message: 'You are not joined to group'
      });
    }
  }

  /**
   * Get all of members' ids in this group
   * @return {Array} [array of members' ids in this group]
   */
  getMemberIds() {
    let memberIds = [];
    for (let i = 0, len = this.members.length; i < len; i++) {
      memberIds.push(this.members[i].id);
    }
    return memberIds;
  }

  /**
   * Check this group containing the id or not
   * @param  {String} id [id of the contact]
   * @return {Boolean}   [if id of the contact is in this.members, then return true]
   */
  _containId(id) {
    return Array.isArray(this.members) && this.members.indexOf(id) >= 0;
  }

  /**
   * Override toString method to show the group info
   * @return {String} [basic group info and joined or not]
   */
  toString() {
    if (this.isJoined) {
      return `<LineGroup ${this.name} ${this.id} #${this.members.length}>`;
    } else {
      return `<LineGroup ${this.name} ${this.id} #${this.members.length} (invited)>`;
    }
  }
}

class LineRoom extends LineBase {
  /**
   * Constructor of LineRoom, initiate base info of a Room context
   * @param  {Thrift HttpClient} client [Client context of Room]
   * @param  {LineRoom}          room   [original room context and using it to initiate `this`]
   */
  constructor(client, room) {
    super();
    this._client = client;
    this._room = room;
    this.id = room.mid;
    this.contacts = room.contacts ? room.contacts.map(contact => new LineContact(client,contact)) : [];
  }

  /**
   * Leave room method to each LineRoom
   * @return {Promise} [user can handle the result or error from promise]
   */
  leave() {
    return this._client.leaveRoom(this);
  }

  /**
   * Invite other Contact into `this`
   * @param  {LineContact} contact [LineContact who will be invited into `this`]
   * @return {Promise}             [user can handle result or error from promise.
   *                               Besides, when `contact` is not a LineContact, it will return
   *                               a promise with `false` and error message]
   */
  invite(contact) {
    if (!(contact instanceof LineContact)) {
      return Promise.resolve({
        success: false,
        message: 'You should pass a LineContact as parameter'
      });
    }
    return this._client.inviteIntoRoom(this, new LineContact(this._client, contact));
  }

  /**
   * Get contacts in `this` room
   * @return {Array} [array containing contact ids in this room]
   */
  getContactIds() {
    let contactIds = [];
    for (let i = 0, len = this.contacts.length; i < len; i++) {
      contactIds.push(this.contacts[i].id);
    }
    return contactIds;
  }

  /**
   * Check this room containing the id or not
   * @param  {String} id [id of the contact]
   * @return {Boolean}   [if id of the contact is in this.contacts, then return true]
   */
  _containId(id) {
    return Array.isArray(this.contacts) && this.contacts.indexOf(id) >= 0;
  }

  /**
   * Override toString method to show room id
   * @return {String} [show room id]
   */
  toString() {
    return `<LineRoom ${this.id}>`;
  }
}

class LineContact extends LineBase {
  /**
   * Constructor of LineContact, initiate base info of a contact context
   * @param  {Thrift HttpClient} client  [Client context of contact]
   * @param  {LineContact} contact       [original contact context and using it to initiate `this`]
   */
  constructor(client, contact) {
    super();
    this._client = client;
    this._contact = contact;
    this.id = contact.mid;
    this.name = contact.displayName;
    this.iconPath = `http://${config.LINE_OS_URL}${contact.picturePath}/preview`;
    this.statusMessage = contact.statusMessage;
  }

  /**
   * `rooms` setter of LineContact
   * @param  {Array} contactRooms [give an array of rooms joined by `this` LineContact]
   */
  set rooms(contactRooms) {
    this.rooms = contactRooms;
  }

  /**
   * `rooms` getter of LineContact
   * @return {Array} [an array of LineRoom that `this` LineContact has joined]
   */
  get rooms() {
    return this._client.rooms.filter(room => room._containId(this.id));
  }

  /**
   * `groups` setter of LineContact
   * @param  {Array} contactGroups [give an array of groups joined by `this` LineContact]
   */
  set groups(contactGroups) {
    this.groups = contactGroups;
  }

  /**
   * `groups` setter of LineContact
   * @return {Array} [an array of LineGroup that `this` LineContact has joined]
   */
  get groups() {
    return this._client.groups.map(group => group._containId(this.id));
  }

  /**
   * Override valueOf method to compare value with id
   * @return {String} [id of `this` LineContact]
   */
  valueOf() {
    return this.id;
  }

  /**
   * Override toString method to show basic info of `this` LineContact
   * @return {String} [show basic info of `this` LineContact]
   */
  toString() {
    return `<LineContact ${this.id} ${this.name}>`;
  }
}

export {
  LineRoom,
  LineGroup,
  LineMessage,
  LineContact,
}
