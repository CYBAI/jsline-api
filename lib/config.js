import os from 'os';
import ttypes from 'curve-thrift/line_types';

export const config = {
  LINE_DOMAIN: 'gd2.line.naver.jp',
  LINE_OS_URL: 'os.line.naver.jp',
  LINE_HTTP_URL: '/api/v4/TalkService.do',
  LINE_STICKER_URL: 'dl.stickershop.line.naver.jp/products/',
  LINE_POLL_URL: '/P4',
  LINE_CERTIFICATE_URL: '/Q',
  LINE_SHOP_PATH: '/SHOP4',
  LINE_SESSION_LINE_URL: '/authct/v1/keys/line',
  LINE_SESSION_NAVER_URL: '/authct/v1/keys/naver',
  ip: '127.0.0.1',
  version: '5.1.2',
  revision: 0,
  hostname: os.hostname(),
  platform: os.platform(),
  EMAIL_REGEX: /[^@]+@[^@]+\.[^@]+/,
  Headers: {
    'User-Agent': 'DESKTOP:WIN:${config.version}(5.1.2600-XP-x64)',
    'X-Line-Application': 'DESKTOPWIN\t${config.version}\tWINDOWS\t5.1.2600-XP-x64'
  },
  OT: ttypes.OpType,
  TalkException: ttypes.TalkException,
}

// module.exports =
//   LineAPIConfig: config
//   LineAPI: LineAPI
//   LineClient: LineClient
//   LineRoom: LineRoom
//   LineGroup: LineGroup
//   LineContact: LineContact
//   LineMessage: LineMessage
