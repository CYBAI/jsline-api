os = require 'os'
LINE_DOMAIN = 'gd2.line.naver.jp'

config = {
  LINE_DOMAIN: LINE_DOMAIN
  LINE_OS_URL: 'os.line.naver.jp'
  LINE_HTTP_URL: '/api/v4/TalkService.do'
  LINE_STICKER_URL: 'dl.stickershop.line.naver.jp/products/'
  LINE_POLL_URL: '/P4'
  LINE_CERTIFICATE_URL: '/Q'
  LINE_SHOP_PATH: '/SHOP4'
  LINE_SESSION_LINE_URL: '/authct/v1/keys/line'
  LINE_SESSION_NAVER_URL: '/authct/v1/keys/naver'
  ip: '127.0.0.1'
  version: '3.7.0'
  revision: 0
  hostname: os.hostname()
  EMAIL_REGEX: /[^@]+@[^@]+\.[^@]+/
  Headers: {
    'User-Agent': 'jsline (LINE DesktopApp for Linux)'
    'X-Line-Application': 'DESKTOPWIN\t3.2.1.83\tWINDOWS\t5.1.2600-XP-x64'
  }
  OT: ttypes.OpType
  TalkException: ttypes.TalkException
}

module.exports =
  LineAPIConfig: config
  LineAPI: LineAPI
  LineClient: LineClient
  LineRoom: LineRoom
  LineGroup: LineGroup
  LineContact: LineContact
  LineMessage: LineMessage
