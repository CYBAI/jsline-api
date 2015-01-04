'use strict'

fs = require 'fs'
unirest = require 'unirest'
Promise = require 'bluebird'
Message = require('curve-thrift/line_types').Message
ContentType = require('curve-thrift/line_types').ContentType

Function::property = (prop, desc) ->
  Object.defineProperty @prototype, prop, desc

class LineMessage
  constructor: (client, message) ->
    @_client = client
    @id = message.id
    @text = message.text
    @hasContent = message.hasContent
    @contentType = message.contentType
    @contentPreview = message.contentPreview
    @contentMetaData = message.contentMetadata
    @sender = client.getContactOrRoomOrGroupById message._from
    @receiver = client.getContactOrRoomOrGroupById message.to
    @toType = message.toType
    @createdTime = new Date message.createdTime
  toString: () ->
    """LineMessage (contentType=#{ContentType._VALUES_TO_NAMES[@contentType]}, sender=#{@sender}, receiver=#{@receiver}, msg="#{@text}")"""

class LineBase
  constructor: () ->
    @_messageBox = null

  sendMessage: (text) ->
    message = Message
      to: @id
      text: text
    @_client.sendMessage message
    .then (result) ->
      true
    , (err) ->
      console.log err if err
      false

  sendSticker: (stickerId='13', stickerPackageId='1', stickerVersion='100', stickerText='[null]') ->    
    message = Message
      to: @id
      text: ''

    message.contentType = ContentType.STICKER
    message.contentMetadata =
      STKID: stickerId
      STKPKGID: stickerPackageId
      STKVER: stickerVersion
      STKTXT: stickerText

    @_client.sendMessage message
    .then (result) ->
      true
    , (err) ->
      console.log err if err
      false

  sendImage: (path) ->
    fs_readFile = Promise.promisify fs.readFile
    fs_readFile path
    .then (buf) =>
      message = Message
        to: @id
        text: ''
      message.contentType = ContentType.IMAGE
      message.contentPreview = buf.toString 'base64'
      message.contentMetadata =
        PREVIEW_URL: null
        DOWNLOAD_URL: null
        PUBLIC: true

      @_client.sendMessage message
      .then () ->
        true
      , (err) ->
        console.log err if err
        false

  sendImageWithURL: (url) ->
    defer = Promise.defer()
    unirest.get
      url: url
      encoding: 'binary'
    .end (err, res, buf) ->
      throw err if err
      defer.resolve buf

    defer.promise.then () =>
      message = Message
        to: @id
        text: null
      message.contentType = ContentType.IMAGE
      message.contentPreview = buf.toString 'base64'
      message.contentMetadata =
        PREVIEW_URL: url
        DOWNLOAD_URL: url
        PUBLIC: true
      @_client.sendMessage message, 1
      true
    , (err) ->
      console.log err if err
      false

  getRecentMessages: (count = 1) ->
    if @_messageBox
      @_client.getRecentMessages @_messageBox, count
    else
      @_client.getMessageBox @id
      .then (messageBox) =>
        @_messageBox = messageBox
        @_client.getRecentMessages @_messageBox, count

  valueOf: () ->
    @id

class LineGroup extends LineBase
  constructor: (client, group=null, is_joined=true) ->
    @_client = client
    @_group = group
    @id = group.id
    @is_joined = is_joined
    try
      @creator = new LineContact client, group.creator
    catch
      @creator = null
    @members = group.members.map (member) ->
      return new LineContact(client,member)
    if group.invitee
      @invitee = group.invitee.map (inv) ->
        return new LineContact(client,inv)
    else
      @invitee = []

  acceptGroupInvitation: () ->
    if not @is_joined
      @_client.acceptGroupInvitation @
    else
      console.log 'You are already in group'
      false

  leave: () ->
    if @is_joined
      try
        @leaveGroup @
        return true
      catch err
        return false
    else
      console.log 'You are not joined to group'
      false

  getMemberIds: () ->
    (member.id for member in @members)

  _containId: (id) ->
    id in @members

  toString: () ->
    if @is_joined
      "<LineGroup #{@name} ##{@members.length}>"
    else
      "<LineGroup #{@name} ##{@members.length} (invited)>"

class LineRoom extends LineBase
  constructor: (client, room) ->
    @_client = client
    @_room = room
    @id = room.mid
    @contacts = room.contacts.map (contact) =>
      new LineContact(client,contact)

  leave: () ->
    try
      @leaveRoom @
      return true
    catch err
      return false

  invite: (contact) ->
    try
      @_client.inviteIntoRoom @, new LineContact(@_client, contact)
    catch err
      throw err

  getContactIds: () ->
    (contact.id for contact in @contacts)

  _containId: (id) ->
    id in @contacts

  toString: () ->
    "<LineRoom #{@contacts}>"

class LineContact extends LineBase
  constructor: (client, contact) ->
    @_client = client
    @_contact = contact
    @id = contact.mid
    @name = contact.displayName
    @statusMessage = contact.statusMessage

  @property 'rooms',
    get: () ->
      @_client.rooms.map (room) =>
        if room._containId @id
          return room

    set: (rooms) ->
      @rooms = rooms

  @property 'groups',
    get: () ->
      @_client.groups.map (group) ->
        if group._containId @id
          return group
    
    set: (groups) ->
      @groups = groups

  toString: () ->
    "<LineContact #{@name}>"

module.exports =
  LineRoom: LineRoom
  LineGroup: LineGroup
  LineContact: LineContact
  LineMessage: LineMessage

